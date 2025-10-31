"""
Real MCP Document Server using official MCP SDK
Communicates via stdio (stdin/stdout) using JSON-RPC 2.0
"""
import asyncio
import json
import os
from typing import Any
from datetime import datetime
import uuid

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize MCP server
app = Server("document-server")

@app.list_tools()
async def list_tools() -> list[Tool]:
    """
    List available document tools
    """
    return [
        Tool(
            name="create_document",
            description="Generate and create a new document artifact using AI. Provide a title, description of what to generate, and document type.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Document title"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what content to generate (e.g., 'about Python lists', 'REST API tutorial')"
                    },
                    "type": {
                        "type": "string",
                        "description": "Document type: text, code, or sheet",
                        "enum": ["text", "code", "sheet"]
                    }
                },
                "required": ["title", "description", "type"]
            }
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """
    Execute tool - called by MCP client when tool is invoked
    """
    if name == "create_document":
        return await create_document(arguments)
    else:
        return [TextContent(
            type="text",
            text=f"Unknown tool: {name}"
        )]

async def generate_document_content(title: str, doc_type: str, description: str) -> str:
    """
    Generate document content using Google Gemini AI
    
    Args:
        title: Document title
        doc_type: Document type (text, code, sheet)
        description: What to generate
    
    Returns:
        Generated content as string
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage
    
    # Get API key from environment
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment variables")
    
    # Create LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.7,
        google_api_key=api_key,
        max_output_tokens=8000
    )
    
    # Create appropriate prompt based on document type
    prompts = {
        "text": f"""Write a focused, concise, structured document on: {title}

User Request: {description}

Requirements:
- Length: 500–800 words
- Stay strictly on topic
- Sections: Introduction, 2–4 key sections, Key points/impact
- Use bold for keywords, bullet points where helpful
- Include specific facts, dates, examples, and numbers""",
        
        "code": f"""Write a programming tutorial/guide on: {title}

User Request: {description}

Requirements:
- Include clear explanations with code examples
- Use proper markdown formatting with code blocks
- Show practical, working examples
- Include comments in code""",
        
        "sheet": f"""Create a data table/spreadsheet for: {title}

User Request: {description}

Requirements:
- Use markdown table format
- Include headers and proper alignment
- Add relevant data rows
- Keep it organized and readable"""
    }
    
    prompt = prompts.get(doc_type, prompts["text"])
    
    # Generate content
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content

async def create_document(arguments: dict) -> list[TextContent]:
    """
    Generate document content using AI and create document
    
    Args:
        arguments: {"title": "...", "description": "...", "type": "text|code|sheet"}
    
    Returns:
        Document info as JSON TextContent
    """
    try:
        title = arguments.get("title")
        description = arguments.get("description")
        doc_type = arguments.get("type", "text")
        
        if not title or not description:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "title and description are required"})
            )]
        
        # Generate content using AI
        print(f"[DOCUMENT_SERVER] Generating document: {title}, type: {doc_type}")
        print(f"[DOCUMENT_SERVER] Description: {description}")
        
        content = await generate_document_content(title, doc_type, description)
        
        print(f"[DOCUMENT_SERVER] Generated content length: {len(content)}")
        
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
        import traceback
        print(f"[DOCUMENT_SERVER] Error: {str(e)}")
        traceback.print_exc()
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Failed to create document: {str(e)}"})
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
