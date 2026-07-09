"""
FastAPI server for LangGraph agent with MCP
Fully uses LangGraph for orchestration - both streaming and non-streaming
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Optional, AsyncIterator
import json
import asyncio
import traceback
from agent.graph import streaming_agent_graph, GRAPH_RECURSION_LIMIT
from agent.mcp_client import mcp_client
import uvicorn

           
app = FastAPI(
    title="LangGraph Agent with MCP",
    description="AI Agent using MCP for tool integration"
)

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

MAX_MESSAGE_LENGTH = 8000


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)
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

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat responses token-by-token using LangGraph streaming agent
    Fully uses streaming_agent_graph with state-based token streaming
    """
    async def generate() -> AsyncIterator[str]:
        try:
            yield ": connected\n\n"
            
            print(f"\n[STREAM] Starting chat for session: {request.session_id}")
            print(f"[STREAM] Message: {request.message}")
            
            initial_state = {
                "messages": [],
                "user_input": request.message,
                "session_id": request.session_id,
                "user_id": request.user_id,
                "tool_calls": [],
                "tool_results": [],
                "should_continue": False,
                "streaming_tokens": []
            }
            
            print(f"[STREAM] Starting streaming agent graph...")
            
            last_token_count = 0
            final_state = None
            
            try:
                async for event in streaming_agent_graph.astream(
                    initial_state,
                    config={"recursion_limit": GRAPH_RECURSION_LIMIT},
                ):
                    print(f"[STREAM] Graph event: {list(event.keys())}")
                    
                    if "agent" in event:
                        agent_state = event["agent"]
                        streaming_tokens = agent_state.get("streaming_tokens", [])
                        
                        new_tokens = streaming_tokens[last_token_count:]
                        for token in new_tokens:
                            yield f"data: {json.dumps({'token': token}, ensure_ascii=False, separators=(',', ':'))}\n\n"
                        
                        last_token_count = len(streaming_tokens)
                        final_state = agent_state
                    
                    elif "tools" in event:
                        tool_state = event["tools"]
                        tool_results = tool_state.get("tool_results", [])
                        
                        print(f"[STREAM] Processing {len(tool_results)} tool results...")
                        
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
                                    
                                    chunk_size = 10  
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
                        
                        final_state = tool_state
                
                print(f"[STREAM] Streaming agent graph completed. Total tokens: {last_token_count}")
                
            except Exception as e:
                print(f"[STREAM] Stream error: {str(e)}")
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'error': 'The agent encountered an error while generating a response.'}, ensure_ascii=False, separators=(',', ':'))}\n\n"

            yield f"data: {json.dumps({'type': 'done'}, separators=(',', ':'))}\n\n"
            print(f"[STREAM] Stream completed successfully")

        except Exception as e:
            print(f"[STREAM] ERROR: {str(e)}")
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'error': 'The agent encountered an unexpected error.'}, ensure_ascii=False, separators=(',', ':'))}\n\n"
    
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
