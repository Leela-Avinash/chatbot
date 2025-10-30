"""
LangGraph workflow with MCP integration
"""
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import agent_node, tool_node, should_continue

def create_agent_graph():
    """
    Create the LangGraph workflow
    
    Flow:
    1. User input -> Agent (LLM decides what to do)
    2. If tools needed -> Tool Node (calls MCP servers)
    3. Tool results -> Agent (formats response)
    4. End
    """
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    workflow.set_entry_point("agent")
    
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END
        }
    )
    
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()

agent_graph = create_agent_graph()
