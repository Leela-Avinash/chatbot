import asyncio
import os
import sys
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters

load_dotenv()


class MCPClient:
    """
    Real MCP Client using Model Context Protocol
    Spawns MCP tool servers via stdio and calls tools via JSON-RPC
    """

    def __init__(self):
        self.sessions: Dict[str, ClientSession] = {}
        self.contexts: Dict[str, Any] = {}

        # MCP servers are spawned as subprocesses (no HTTP)
        self.weather_server_path = os.getenv("MCP_WEATHER_CMD", "mcp_servers/weather_server.py")
        self.document_server_path = os.getenv("MCP_DOC_CMD", "mcp_servers/document_server.py")

    async def start_server(self, name: str, server_path: str):
        """
        Start an MCP server as subprocess via stdio
        Spawns Python subprocess and communicates via stdin/stdout
        """
        python_exec = sys.executable
        params = StdioServerParameters(
            command=python_exec,
            args=[server_path]  # Just the path, not split
        )

        context = stdio_client(params)
        read_stream, write_stream = await context.__aenter__()
        session = ClientSession(read_stream, write_stream)
        await session.__aenter__()
        
        # Initialize the MCP session
        await session.initialize()
        
        self.sessions[name] = session
        self.contexts[name] = context
        print(f"[MCP] Started server: {name} (subprocess via stdio) - PID: {context._process.pid if hasattr(context, '_process') else 'unknown'}")

    async def start(self):
        """
        Boot all MCP servers as subprocesses
        No HTTP servers - pure stdio communication
        """
        try:
            await self.start_server("weather", self.weather_server_path)
            print("[MCP] Weather server started successfully")
        except Exception as e:
            print(f"[MCP] Failed to start weather server: {e}")
            
        try:
            await self.start_server("document", self.document_server_path)
            print("[MCP] Document server started successfully")
        except Exception as e:
            print(f"[MCP] Failed to start document server: {e}")

    async def call_tool(self, server: str, tool: str, args: Dict[str, Any]):
        """
        Call an MCP tool via JSON-RPC
        """
        session = self.sessions.get(server)
        if not session:
            return {"error": f"MCP server not running: {server}"}

        try:
            print(f"[MCP] Calling tool {tool} on server {server} with args: {args}")
            print(f"[MCP] Args type: {type(args)}, Args value: {args}")
            
            # Ensure arguments are in the correct format
            if not isinstance(args, dict):
                args = {"value": args}
            
            response = await session.call_tool(tool, arguments=args)
            print(f"[MCP] Got response from {server}: {response}")
            
            if not response or not response.content:
                return {"error": "Empty MCP response"}

            text = response.content[0].text
            print(f"[MCP] Response text: {text}")

            # Try parse JSON result
            try:
                import json
                parsed = json.loads(text)
                print(f"[MCP] Parsed JSON: {parsed}")
                return parsed
            except Exception as parse_error:
                print(f"[MCP] Failed to parse JSON: {parse_error}, returning as text")
                return {"result": text}

        except Exception as e:
            print(f"[MCP] Tool call failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def get_weather(self, city: str):
        return await self.call_tool("weather", "get_weather", {"city": city})

    async def create_document(self, title: str, content: str, type: str = "text"):
        return await self.call_tool("document", "create_document", {
            "title": title,
            "content": content,
            "type": type,
        })

    async def close(self):
        print("[MCP] Shutting down MCP sessions...")
        for name, session in self.sessions.items():
            await session.__aexit__(None, None, None)
            print(f"[MCP] Closed session: {name}")

        for name, context in self.contexts.items():
            await context.__aexit__(None, None, None)
            print(f"[MCP] Stopped server: {name}")

        self.sessions.clear()
        self.contexts.clear()


# Global instance
mcp_client = MCPClient()
