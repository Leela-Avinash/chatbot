"""
Real MCP Document Server using official MCP SDK
Communicates via stdio (stdin/stdout) using JSON-RPC 2.0
Stores documents in-memory
"""
import asyncio
import json
from typing import Any
from datetime import datetime
import uuid

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Initialize MCP server
app = Server("document-server")

# In-memory document storage
documents = {}

@app.list_tools()
async def list_tools() -> list[Tool]:
    """
    List available document tools
    """
    return [
        Tool(
            name="create_document",
            description="Create a new document artifact",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Document title"
                    },
                    "content": {
                        "type": "string",
                        "description": "Document content"
                    },
                    "type": {
                        "type": "string",
                        "description": "Document type: text, code, or sheet",
                        "enum": ["text", "code", "sheet"]
                    }
                },
                "required": ["title", "content", "type"]
            }
        ),
        Tool(
            name="get_document",
            description="Retrieve a document by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Document ID"
                    }
                },
                "required": ["id"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """
    Execute tool - called by MCP client when tool is invoked
    """
    if name == "create_document":
        return await create_document(arguments)
    elif name == "get_document":
        return await get_document(arguments)
    else:
        return [TextContent(
            type="text",
            text=f"Unknown tool: {name}"
        )]

async def create_document(arguments: dict) -> list[TextContent]:
    """
    Create a new document and store in memory
    
    Args:
        arguments: {"title": "...", "content": "...", "type": "text|code|sheet"}
    
    Returns:
        Document info as JSON TextContent
    """
    try:
        title = arguments.get("title")
        content = arguments.get("content")
        doc_type = arguments.get("type", "text")
        
        if not title or not content:
            return [TextContent(
                type="text",
                text="Error: title and content are required"
            )]
        
        # Create document
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        document = {
            "id": doc_id,
            "title": title,
            "content": content,
            "type": doc_type,
            "created_at": now,
            "updated_at": now
        }
        
        # Store in memory
        documents[doc_id] = document
        
        # Return as JSON to maintain data structure
        result = {
            "success": True,
            "document": document
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(result)
        )]
        
    except Exception as e:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Failed to create document: {str(e)}"})
        )]

async def get_document(arguments: dict) -> list[TextContent]:
    """
    Retrieve a document from memory
    
    Args:
        arguments: {"id": "document-id"}
    
    Returns:
        Document data as JSON TextContent
    """
    try:
        doc_id = arguments.get("id")
        
        if not doc_id:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "Document ID is required"})
            )]
        
        if doc_id not in documents:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Document not found: {doc_id}"})
            )]
        
        result = {
            "success": True,
            "document": documents[doc_id]
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(result)
        )]
        
    except Exception as e:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Failed to retrieve document: {str(e)}"})
        )]

async def main():
    """
    Main entry point - runs MCP server with stdio transport
    """
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
