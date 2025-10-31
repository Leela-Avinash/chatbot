"""
Agent nodes - Handle LLM calls and tool execution with MCP
"""
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from agent.state import AgentState
from agent.mcp_client import mcp_client
import json

# Define MCP tools as LangChain tools
@tool
async def get_weather(city: str) -> dict:
    """Get current weather for a city using Open-Meteo API via MCP.
    
    Args:
        city: City name (e.g., 'London', 'New York', 'Tokyo')
    
    Returns:
        Weather data including temperature, conditions, humidity, wind speed
    """
    return await mcp_client.get_weather(city)

@tool
async def create_document(title: str, description: str, type: str = "text") -> dict:
    """Create a formal document, essay, code file, or table via MCP.
    ONLY use when user explicitly asks to 'write a document', 'create an essay', 
    'write code', or 'make a table'. DO NOT use for simple questions.
    
    Args:
        title: Document title
        description: Description of what content to generate (e.g., 'about Python lists', 'REST API tutorial')
        type: Type of document ('text' for essays/reports, 'code' for programming, 'sheet' for tables)
    
    Returns:
        Document creation result with id, title, and content
    """
    return await mcp_client.create_document(title, description, type)

def get_llm(streaming: bool = True):
    """Get the language model with streaming support"""
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.7,
        streaming=streaming
    )

SYSTEM_PROMPT = """
============================================================
AI BEHAVIOR MODE
============================================================

You are a helpful conversational AI assistant (Gemini-2.0-flash).
You answer questions directly in chat using text unless the user explicitly requests a document or code.

Your tone:
- Conversational, warm, encouraging
- Occasional quick, clever humor when appropriate
- Poetic and lyrical where it flows naturally
- Playful and imaginative
- Yet capable of being formal and professional when needed
- Skeptical and questioning in an intelligent, thoughtful way
- Relaxed and easygoing, not rigid

BUT: Despite your creativity, always follow the core execution rules below.

============================================================
ALLOWED TOOLS
============================================================

1. get_weather(city)
   - Retrieves weather for a city

2. create_document(title, content, type)
   - Creates formal documents, essays, code files, tables, reports, etc.

============================================================
CRITICAL TOOL POLICY
============================================================

Default behavior: respond in plain chat text.
You DO NOT call create_document unless absolutely required.

============================================================
WHEN YOU MUST CALL create_document
============================================================

Call create_document IMMEDIATELY (no questions asked) when user says:
- "write a document about X"
- "create a document on X"
- "generate a document for X"
- "write an essay on X"
- "create code for X"
- "write code to do X"
- "implement X in code"
- "create a report on X"
- "write a research paper on X"
- "generate a table for X"
- "make a spreadsheet of X"

IMPORTANT: When user says "create a document" or similar:
1. DO NOT ask "what title would you like?"
2. DO NOT ask for confirmation
3. IMMEDIATELY call create_document with:
   - Use the topic from their message as the title
   - Use their full request as the content description
   - Choose appropriate doc_type:
     * 'code' - Programming tutorials, coding examples, language guides (will generate markdown with text + code blocks)
     * 'text' - Essays, reports, general documents
     * 'sheet' - Data tables, spreadsheets

Examples:
BAD: "What title would you like for the document?"
GOOD: Immediately call create_document("Fundamentals of C", "Explain fundamentals of C with code examples", "code")
GOOD: Immediately call create_document("Climate Change Essay", "Write essay on climate change impacts", "text")
GOOD: Immediately call create_document("Sales Data", "Create table of quarterly sales data", "sheet")

============================================================
DECISION TREE (FOLLOW EXACTLY)
============================================================

User message → Does it contain "write", "create", "generate", "document", "essay", "code", "implement"?
|
|-- NO → Answer normally in chat (never call create_document)
|
|-- YES →
       Is it a formal output request (document/essay/code/table)?
       |
       |-- YES → IMMEDIATELY call create_document (don't ask questions)
       |
       |-- NO → answer in chat normally

============================================================
CHAT RESPONSE RULES (WHEN NOT CALLING TOOLS)
============================================================

When answering in text:
- Be direct, helpful, conversational
- Use bold for emphasis where useful
- Prefer bullet points for clarity
- 2–4 paragraphs for simple queries
- 4–6 paragraphs if user asks for more depth
- Maintain warmth, creativity, and intelligence
- You may blend poetic language lightly, not excessively

============================================================
SELF-IDENTITY RULE
============================================================
If the user asks "what model are you":
- You identify as Gemini-2.0-flash.
- You do not accept being called another model.

============================================================
SUMMARY
============================================================

Your default mode is CHAT RESPONSE.
Only use create_document when explicitly and clearly requested.
When creating documents: BE DECISIVE - don't ask for titles, just create them immediately.
Weather tool only when needed.

Stay brilliant, warm, witty, poetic, and precise.
"""

async def agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Main agent node - processes user input and calls LLM with tools
    """
    messages = state.get("messages", [])
    user_input = state.get("user_input", "")
    
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    
    if user_input:
        messages.append(HumanMessage(content=user_input))
    
    llm = get_llm(streaming=True)
    tools = [get_weather, create_document]
    llm_with_tools = llm.bind_tools(tools)
    
    print(f"[AGENT] Calling LLM with {len(messages)} messages...")
    response = await llm_with_tools.ainvoke(messages)
    print(f"[AGENT] Got response. Has tool calls: {hasattr(response, 'tool_calls') and len(response.tool_calls) > 0}")
    
    has_tool_calls = hasattr(response, 'tool_calls') and len(response.tool_calls) > 0
    
    return {
        "messages": messages + [response],
        "tool_calls": response.tool_calls if has_tool_calls else [],
        "should_continue": has_tool_calls,
        "user_input": ""  
    }

async def agent_node_streaming(state: AgentState):
    """
    Streaming version of agent node that yields tokens as they arrive
    """
    messages = state.get("messages", [])
    user_input = state.get("user_input", "")
    
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    
    if user_input:
        messages.append(HumanMessage(content=user_input))
    
    llm = get_llm(streaming=True)
    tools = [get_weather, create_document]
    llm_with_tools = llm.bind_tools(tools)
    
    print(f"[AGENT_STREAM] Streaming LLM with {len(messages)} messages...")
    
    full_content = ""
    response_message = None
    
    async for chunk in llm_with_tools.astream(messages):
        if hasattr(chunk, 'content') and chunk.content:
            full_content += chunk.content
            yield {
                "type": "token",
                "content": chunk.content
            }
        
        response_message = chunk
    
    has_tool_calls = hasattr(response_message, 'tool_calls') and len(response_message.tool_calls) > 0
    
    print(f"[AGENT_STREAM] Completed. Has tool calls: {has_tool_calls}")
    
    yield {
        "type": "complete",
        "messages": messages + [response_message],
        "tool_calls": response_message.tool_calls if has_tool_calls else [],
        "should_continue": has_tool_calls,
        "user_input": ""
    }

async def tool_node(state: AgentState) -> Dict[str, Any]:
    """
    Tool execution node - runs MCP tools
    """
    tool_calls = state.get("tool_calls", [])
    messages = state.get("messages", [])
    tool_results = []
    
    print(f"[TOOL] Executing {len(tool_calls)} tool calls...")
    
    for tool_call in tool_calls:
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args", {})
        tool_id = tool_call.get("id", "unknown")
        
        print(f"[TOOL] Calling {tool_name} with args: {tool_args}")
        
        try:
            if tool_name == "get_weather":
                result = await get_weather.ainvoke(tool_args)
            elif tool_name == "create_document":
                result = await create_document.ainvoke(tool_args)
            else:
                result = {"error": f"Unknown tool: {tool_name}"}
            
            print(f"[TOOL] Result: {result}")
            
            messages.append(ToolMessage(
                content=json.dumps(result),
                tool_call_id=tool_id
            ))
            
            tool_results.append({
                "tool": tool_name,
                "args": tool_args,
                "result": result
            })
        except Exception as e:
            error_msg = f"Error executing {tool_name}: {str(e)}"
            print(f"[TOOL] {error_msg}")
            messages.append(ToolMessage(
                content=json.dumps({"error": error_msg}),
                tool_call_id=tool_id
            ))
    
    return {
        "messages": messages,
        "tool_results": tool_results,
        "tool_calls": [],
        "should_continue": False
    }

async def document_generation_node(state: AgentState) -> Dict[str, Any]:
    """
    Generate document content with streaming.
    This node is called after create_document tool is invoked.
    Note: With MCP, document content is generated by the MCP server
    """
    tool_results = state.get("tool_results", [])
    
    for tool_result in tool_results:
        if tool_result["tool"] == "create_document":
            result = tool_result["result"]
            
            if result.get('error'):
                continue
            
            title = result.get("title", "Document")
            content = result.get("content", "")
            doc_type = result.get("type", "text")
            
            return {
                "artifact_type": doc_type,
                "artifact_title": title,
                "artifact_content": content,
                "status": "complete",
            }
    
    return {}

def should_continue(state: AgentState) -> str:
    """Decide whether to continue to tools or end"""
    if state.get("should_continue", False):
        print("[ROUTER] Routing to tools")
        return "tools"
    
    print("[ROUTER] Routing to end")
    return "end"