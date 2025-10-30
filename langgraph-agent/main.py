"""
FastAPI server for LangGraph agent with MCP
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Optional, AsyncIterator
import json
import asyncio
from agent.graph import agent_graph
from agent.mcp_client import mcp_client
import uvicorn
from langchain_core.messages import BaseMessage, AIMessage

app = FastAPI(
    title="LangGraph Agent with MCP",
    description="AI Agent using MCP for tool integration"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def generate_document_content(title: str, kind: str, description: str):
    """
    Generate document content using LLM with streaming
    
    Args:
        title: Document title
        kind: Document type ('text', 'code', 'sheet')
        description: Description of what to generate
    
    Yields:
        Content chunks as they're generated
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.7,
        streaming=True,
        max_output_tokens=8000
    )
    
    # Create appropriate prompt based on document kind
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
    
    prompt = prompts.get(kind, prompts["text"])
    
    async for chunk in llm.astream(prompt):
        if chunk.content:
            yield chunk.content

@app.on_event("startup")
async def startup_event():
    """Start MCP servers on application startup"""
    print("[Startup] Spawning MCP servers as subprocesses via stdio...")
    await mcp_client.start()
    print("[Startup] MCP servers ready (stdio communication)")

@app.on_event("shutdown")
async def shutdown_event():
    """Close MCP servers on application shutdown"""
    print("[Shutdown] Terminating MCP server subprocesses...")
    await mcp_client.close()
    print("[Shutdown] MCP servers terminated")

class ChatRequest(BaseModel):
    message: str
    session_id: str
    user_id: Optional[str] = None

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "agent": "langgraph-mcp",
        "mcp_protocol": "stdio (JSON-RPC 2.0)",
        "mcp_servers": {
            "weather": "started" if "weather" in mcp_client.sessions else "not started",
            "document": "started" if "document" in mcp_client.sessions else "not started"
        }
    }

@app.post("/chat")
async def chat(request: ChatRequest) -> Dict:
    """
    Process a chat message through the agent
    """
    try:
        initial_state = {
            "messages": [],
            "user_input": request.message,
            "session_id": request.session_id,
            "user_id": request.user_id,
            "tool_calls": [],
            "tool_results": [],
            "should_continue": False
        }
        
        result = await agent_graph.ainvoke(initial_state)
        
        messages = result.get("messages", [])
        final_message = messages[-1] if messages else None
        
        return {
            "response": final_message.content if final_message else "No response",
            "tool_results": result.get("tool_results", []),
            "session_id": request.session_id
        }
        
    except Exception as e:
        import traceback
        print("ERROR TRACEBACK")
        traceback.print_exc()
        return {"error": str(e)}

def serialize_event(event: Dict) -> Dict:
    """Convert LangChain messages to JSON-serializable format"""
    serialized = {}
    for key, value in event.items():
        if key == "messages":
            # Convert message objects to dicts
            serialized[key] = [
                {
                    "type": msg.__class__.__name__,
                    "content": msg.content,
                    "role": getattr(msg, "role", None)
                }
                for msg in value
                if isinstance(msg, BaseMessage)
            ]
        elif isinstance(value, list):
            # Handle lists that might contain non-serializable objects
            serialized[key] = [
                str(item) if not isinstance(item, (str, int, float, bool, dict, list)) else item
                for item in value
            ]
        elif isinstance(value, (str, int, float, bool, dict, list, type(None))):
            serialized[key] = value
        else:
            # Convert other objects to string
            serialized[key] = str(value)
    return serialized

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat responses token-by-token
    """
    async def generate() -> AsyncIterator[str]:
        try:
            print(f"\n[STREAM] Starting chat for session: {request.session_id}")
            print(f"[STREAM] Message: {request.message}")
            
            # Instead of using the graph, we'll directly stream from the LLM
            # This gives us true token-by-token streaming
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import SystemMessage, HumanMessage
            from agent.nodes import SYSTEM_PROMPT, get_weather, create_document
            
            # Build messages
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=request.message)
            ]
            
            # Create LLM with streaming
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.7,
                streaming=True
            )
            tools = [get_weather, create_document]
            llm_with_tools = llm.bind_tools(tools)
            
            print(f"[STREAM] Starting LLM stream...")
            
            # Stream tokens
            full_content = ""
            final_chunk = None
            tool_calls_detected = []
            stream_error = None
            
            try:
                async for chunk in llm_with_tools.astream(messages):
                    if hasattr(chunk, 'content') and chunk.content:
                        token = chunk.content
                        full_content += token
                        # Emit each token
                        yield f"data: {json.dumps({'token': token})}\n\n"
                    
                    # Collect tool calls if present
                    if hasattr(chunk, 'tool_call_chunks') and chunk.tool_call_chunks:
                        for tool_chunk in chunk.tool_call_chunks:
                            if tool_chunk:
                                tool_calls_detected.append(tool_chunk)
                    
                    final_chunk = chunk
                
                print(f"[STREAM] LLM stream completed. Full content length: {len(full_content)}")
                
            except AttributeError as e:
                # Handle the finish_reason.name error gracefully
                if "'int' object has no attribute 'name'" in str(e):
                    print(f"[STREAM] Warning: finish_reason enum issue encountered (harmless)")
                    stream_error = e
                    # The stream is essentially complete, we just couldn't process the final metadata
                    # Continue with what we have
                else:
                    raise
            except Exception as e:
                print(f"[STREAM] Stream error: {str(e)}")
                import traceback
                traceback.print_exc()
                stream_error = e
                # Try to continue with partial results
            
            print(f"[STREAM] Stream processing completed. Full content length: {len(full_content)}")
            
            # If we had a stream error and don't have tool calls, try to get them via ainvoke
            has_tool_calls = hasattr(final_chunk, 'tool_calls') and final_chunk.tool_calls
            
            if stream_error and not has_tool_calls:
                print(f"[STREAM] Attempting to recover tool calls via ainvoke after stream error...")
                try:
                    # Use ainvoke to get the complete response with tool calls
                    complete_response = await llm_with_tools.ainvoke(messages)
                    if hasattr(complete_response, 'tool_calls') and complete_response.tool_calls:
                        final_chunk = complete_response
                        has_tool_calls = True
                        print(f"[STREAM] Successfully recovered {len(complete_response.tool_calls)} tool calls")
                except Exception as recovery_error:
                    print(f"[STREAM] Could not recover tool calls: {recovery_error}")
            
            # Check if we need to call tools
            if has_tool_calls:
                print(f"[STREAM] Tool calls detected: {len(final_chunk.tool_calls)}")
                
                for tool_call in final_chunk.tool_calls:
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("args", {})
                    
                    print(f"[STREAM] Executing tool: {tool_name}")
                    print(f"[STREAM] Tool args: {tool_args}")  # Debug logging
                    
                    try:
                        if tool_name == "get_weather":
                            # Check if MCP client is ready
                            if "weather" not in mcp_client.sessions:
                                result = {"error": "Weather MCP server not started"}
                            else:
                                # Call MCP weather server directly
                                # Handle both 'city' and 'location' parameter names for compatibility
                                city = tool_args.get('city') or tool_args.get('location')
                                if not city:
                                    result = {"error": "No city or location specified"}
                                else:
                                    result = await mcp_client.get_weather(city)
                            print(f"[STREAM] Weather result: {result}")
                            yield f"data: {json.dumps({'tool': 'get_weather', 'result': result})}\n\n"
                        elif tool_name == "create_document":
                            # Get document parameters
                            print(f"[DEBUG] tool_args: {tool_args}")
                            
                            title = tool_args.get('title', 'Document')
                            description = tool_args.get('content', '')  # This is the description, not actual content
                            doc_type = tool_args.get('type', 'text')  # Match the tool parameter name
                            
                            print(f"[STREAM] Generating document: {title}, type: {doc_type}")
                            print(f"[DEBUG] Description: {description}")
                            
                            # Send initial document metadata
                            yield f"data: {json.dumps({'tool': 'create_document', 'action': 'start', 'title': title, 'type': doc_type})}\n\n"
                            
                            # Generate the actual content using LLM
                            full_generated_content = ""
                            
                            # Stream the generated content as it's being created
                            async for content_chunk in generate_document_content(
                                title=title,
                                kind=doc_type,
                                description=description
                            ):
                                full_generated_content += content_chunk
                                # Stream each chunk to frontend
                                yield f"data: {json.dumps({'tool': 'create_document', 'action': 'stream', 'chunk': content_chunk})}\n\n"
                            
                            print(f"[STREAM] Document generation complete. Content length: {len(full_generated_content)}")
                            
                            # Store the document via MCP
                            result = await mcp_client.create_document(
                                title=title,
                                content=full_generated_content,
                                type=doc_type
                            )
                            
                            # Send completion with full content
                            final_result = {
                                'title': title,
                                'content': full_generated_content,
                                'kind': doc_type,
                                'doc_type': doc_type,
                                'status': 'complete',
                                'success': True
                            }
                            
                            yield f"data: {json.dumps({'tool': 'create_document', 'action': 'complete', 'result': final_result})}\n\n"
                    except Exception as tool_error:
                        import traceback
                        print(f"[STREAM] Tool error: {tool_error}")
                        traceback.print_exc()
                        yield f"data: {json.dumps({'error': f'Tool execution failed: {str(tool_error)}'})}\n\n"
            
            yield "data: {\"type\": \"done\"}\n\n"
            print(f"[STREAM] Stream completed successfully")
            
        except Exception as e:
            import traceback
            print(f"[STREAM] ERROR: {str(e)}")
            traceback.print_exc()
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )

@app.get("/mcp/status")
async def mcp_status():
    """Check MCP servers status"""
    return {
        "protocol": "stdio (JSON-RPC 2.0)",
        "weather_server": {
            "status": "started" if "weather" in mcp_client.sessions else "not started",
            "transport": "stdio/subprocess"
        },
        "document_server": {
            "status": "started" if "document" in mcp_client.sessions else "not started",
            "transport": "stdio/subprocess"
        }
    }

if __name__ == "__main__":
    print("Starting LangGraph Agent with Real MCP...")
    print("MCP Protocol: stdio (JSON-RPC 2.0)")
    print("Servers will be spawned as subprocesses on startup")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
