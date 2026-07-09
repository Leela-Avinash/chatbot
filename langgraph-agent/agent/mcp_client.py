import asyncio
import os
import sys
import json
import traceback
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters

load_dotenv()

# Per-tool call timeouts: weather is a couple of quick HTTP calls, while
# document generation runs a full LLM completion (up to 8000 output tokens)
# and legitimately needs much more time.
DEFAULT_TOOL_CALL_TIMEOUT_SECONDS = 30
TOOL_CALL_TIMEOUTS = {
    "get_weather": 15,
    "create_document": 120,
}


class MCPClient:
    """
    Real MCP Client using Model Context Protocol
    Spawns MCP tool servers via stdio and calls tools via JSON-RPC
    """

    def __init__(self):
        self.sessions: Dict[str, ClientSession] = {}
        self.contexts: Dict[str, Any] = {}

        self.server_paths = {
            "weather": os.getenv("MCP_WEATHER_CMD", "mcp_servers/weather_server.py"),
            "document": os.getenv("MCP_DOC_CMD", "mcp_servers/document_server.py"),
        }

    async def start_server(self, name: str, server_path: str):
        """
        Start an MCP server as subprocess via stdio
        Spawns Python subprocess and communicates via stdin/stdout
        """
        python_exec = sys.executable
        params = StdioServerParameters(
            command=python_exec,
            args=[server_path]  
        )

        context = stdio_client(params)
        read_stream, write_stream = await context.__aenter__()
        session = ClientSession(read_stream, write_stream)
        await session.__aenter__()

        try:
            await session.initialize()
        except Exception:
            # Handshake failed after the subprocess was already spawned —
            # tear down what we opened instead of leaking the process.
            await session.__aexit__(None, None, None)
            await context.__aexit__(None, None, None)
            raise

        self.sessions[name] = session
        self.contexts[name] = context
        print(f"[MCP] Started server: {name} (subprocess via stdio) - PID: {context._process.pid if hasattr(context, '_process') else 'unknown'}")

    async def start(self):
        """
        Boot all MCP servers as subprocesses
        No HTTP servers - pure stdio communication
        """
        try:
            await self.start_server("weather", self.server_paths["weather"])
            print("[MCP] Weather server started successfully")
        except Exception as e:
            print(f"[MCP] Failed to start weather server: {e}")

        try:
            await self.start_server("document", self.server_paths["document"])
            print("[MCP] Document server started successfully")
        except Exception as e:
            print(f"[MCP] Failed to start document server: {e}")

    async def _restart_server(self, server: str):
        """Tear down and respawn a single MCP server (used after a dead/wedged session)."""
        session = self.sessions.pop(server, None)
        context = self.contexts.pop(server, None)
        if session is not None:
            try:
                await session.__aexit__(None, None, None)
            except Exception:
                pass
        if context is not None:
            try:
                await context.__aexit__(None, None, None)
            except Exception:
                pass

        await self.start_server(server, self.server_paths[server])

    async def _call_tool_once(self, session: ClientSession, tool: str, args: Dict[str, Any], timeout: float):
        response = await asyncio.wait_for(
            session.call_tool(tool, arguments=args),
            timeout=timeout,
        )
        print(f"[MCP] Got response: {response}")

        if not response or not response.content:
            return {"error": "Empty MCP response"}

        text = response.content[0].text

        try:
            return json.loads(text)
        except Exception:
            return {"result": text}

    async def call_tool(self, server: str, tool: str, args: Dict[str, Any]):
        """
        Call an MCP tool via JSON-RPC. If the session is dead or the call fails
        with a transport-level error, restart that server once and retry.
        """
        session = self.sessions.get(server)
        if not session:
            return {"error": f"MCP server not running: {server}"}

        if not isinstance(args, dict):
            args = {"value": args}

        timeout = TOOL_CALL_TIMEOUTS.get(tool, DEFAULT_TOOL_CALL_TIMEOUT_SECONDS)
        print(f"[MCP] Calling tool {tool} on server {server} with args: {args}")

        try:
            return await self._call_tool_once(session, tool, args, timeout)
        except asyncio.TimeoutError:
            print(f"[MCP] Tool call to {server}.{tool} timed out after {timeout}s")
            return {"error": f"Tool '{tool}' timed out"}
        except Exception as e:
            print(f"[MCP] Tool call to {server}.{tool} failed ({e}); restarting server and retrying once")
            traceback.print_exc()
            try:
                await self._restart_server(server)
                session = self.sessions[server]
                return await self._call_tool_once(session, tool, args, timeout)
            except Exception as retry_error:
                print(f"[MCP] Retry after restart failed: {retry_error}")
                traceback.print_exc()
                return {"error": str(retry_error)}

    async def get_weather(self, city: str):
        return await self.call_tool("weather", "get_weather", {"city": city})

    async def create_document(self, title: str, description: str, type: str = "text"):
        return await self.call_tool("document", "create_document", {
            "title": title,
            "description": description,
            "type": type,
        })

    async def close(self):
        print("[MCP] Shutting down MCP sessions...")
        for name, session in self.sessions.items():
            try:
                await session.__aexit__(None, None, None)
                print(f"[MCP] Closed session: {name}")
            except Exception as e:
                print(f"[MCP] Failed to close session {name}: {e}")

        for name, context in self.contexts.items():
            try:
                await context.__aexit__(None, None, None)
                print(f"[MCP] Stopped server: {name}")
            except Exception as e:
                print(f"[MCP] Failed to stop server {name}: {e}")

        self.sessions.clear()
        self.contexts.clear()

mcp_client = MCPClient()
