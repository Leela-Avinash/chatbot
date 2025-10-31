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
import traceback
from agent.graph import agent_graph
from agent.mcp_client import mcp_client
import uvicorn
from langchain_core.messages import BaseMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from agent.nodes import SYSTEM_PROMPT, get_weather, create_document, tool_node

           
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
    Stream chat responses token-by-token using LangGraph agent
    """
    async def generate() -> AsyncIterator[str]:
        try:
            yield ": connected\n\n"
            
            print(f"\n[STREAM] Starting chat for session: {request.session_id}")
            print(f"[STREAM] Message: {request.message}")
             
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=request.message)
            ]
            
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.7,
                streaming=True
            )
            tools = [get_weather, create_document]
            llm_with_tools = llm.bind_tools(tools)
            
            print(f"[STREAM] Starting LLM stream...")
            
            full_content = ""
            final_chunk = None
            stream_error = None
            
            try:
                async for chunk in llm_with_tools.astream(messages):
                    if hasattr(chunk, 'content') and chunk.content:
                        token = chunk.content
                        full_content += token
                        yield f"data: {json.dumps({'token': token}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                    
                    final_chunk = chunk
                
                print(f"[STREAM] LLM stream completed. Full content length: {len(full_content)}")
                
            except AttributeError as e:
                if "'int' object has no attribute 'name'" in str(e):
                    print(f"[STREAM] Warning: finish_reason enum issue encountered (harmless)")
                    stream_error = e
                else:
                    raise
            except Exception as e:
                print(f"[STREAM] Stream error: {str(e)}")
                traceback.print_exc()
                stream_error = e
            
            has_tool_calls = hasattr(final_chunk, 'tool_calls') and final_chunk.tool_calls
            
            if stream_error and not has_tool_calls:
                print(f"[STREAM] Attempting to recover tool calls via ainvoke...")
                try:
                    complete_response = await llm_with_tools.ainvoke(messages)
                    if hasattr(complete_response, 'tool_calls') and complete_response.tool_calls:
                        final_chunk = complete_response
                        has_tool_calls = True
                        print(f"[STREAM] Successfully recovered {len(complete_response.tool_calls)} tool calls")
                except Exception as recovery_error:
                    print(f"[STREAM] Could not recover tool calls: {recovery_error}")
            
            # Step 3: If there are tool calls, use the agent graph to execute them
            if has_tool_calls:
                print(f"[STREAM] Tool calls detected: {len(final_chunk.tool_calls)}")
                
                messages.append(final_chunk)
                
                tool_state = {
                    "messages": messages,
                    "user_input": "",
                    "session_id": request.session_id,
                    "user_id": request.user_id,
                    "tool_calls": final_chunk.tool_calls,
                    "tool_results": [],
                    "should_continue": True
                }
                                
                print(f"[STREAM] Executing tools via agent graph...")
                tool_result_state = await tool_node(tool_state)
                
                tool_results = tool_result_state.get("tool_results", [])
                
                for tool_result in tool_results:
                    tool_name = tool_result.get("tool")
                    result = tool_result.get("result", {})
                    
                    print(f"[STREAM] Tool result for {tool_name}: {result}")
                    
                    if tool_name == "get_weather":
                        yield f"data: {json.dumps({'tool': 'get_weather', 'result': result}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                    
                    elif tool_name == "create_document":
                        if result.get('success') and result.get('document'):
                            doc = result['document']
                            title = doc.get('title', 'Document')
                            doc_type = doc.get('type', 'text')
                            full_generated_content = doc.get('content', '')
                            
                            print(f"[STREAM] Streaming document: {title}, type: {doc_type}, length: {len(full_generated_content)}")
                            
                            yield f"data: {json.dumps({'tool': 'create_document', 'action': 'start', 'title': title, 'type': doc_type}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                            
                            chunk_size = 10  # Characters per chunk
                            last_heartbeat = asyncio.get_event_loop().time()
                            
                            for i in range(0, len(full_generated_content), chunk_size):
                                content_chunk = full_generated_content[i:i+chunk_size]
                                yield f"data: {json.dumps({'tool': 'create_document', 'action': 'stream', 'chunk': content_chunk}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                                
                                await asyncio.sleep(0.02)
                                
                                current_time = asyncio.get_event_loop().time()
                                if current_time - last_heartbeat > 5:
                                    yield ": heartbeat\n\n"
                                    last_heartbeat = current_time
                            
                            print(f"[STREAM] Document streaming complete")
                            
                            final_result = {
                                'title': title,
                                'kind': doc_type,
                                'doc_type': doc_type,
                                'status': 'complete',
                                'success': True,
                                'contentLength': len(full_generated_content)
                            }
                            
                            yield f"data: {json.dumps({'tool': 'create_document', 'action': 'complete', 'result': final_result}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                        else:
                            error_msg = result.get('error', 'Unknown error')
                            print(f"[STREAM] Document generation error: {error_msg}")
                            yield f"data: {json.dumps({'error': f'Document generation failed: {error_msg}'}, ensure_ascii=False, separators=(',', ':'))}\n\n"
            
            yield f"data: {json.dumps({'type': 'done'}, separators=(',', ':'))}\n\n"
            print(f"[STREAM] Stream completed successfully")
            
        except Exception as e:
            print(f"[STREAM] ERROR: {str(e)}")
            traceback.print_exc()
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  
            "Connection": "keep-alive",
        }
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
