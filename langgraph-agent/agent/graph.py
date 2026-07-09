"""
LangGraph workflow with MCP integration
"""
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import agent_node_streaming, tool_node, should_continue

def create_streaming_agent_graph():
    """
    Create the LangGraph workflow for streaming requests
    Uses agent_node_streaming to emit tokens into state
    
    Flow:
    1. User input -> Streaming Agent (LLM streams tokens to state)
    2. If tools needed -> Tool Node (calls MCP servers)
    3. Tool results -> Streaming Agent (streams follow-up response)
    4. End
    """
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node_streaming)
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

# Bound how many agent<->tools round trips a single request can take, so a
# non-converging tool-call loop raises a clear GraphRecursionError instead of
# running unbounded.
GRAPH_RECURSION_LIMIT = 15

streaming_agent_graph = create_streaming_agent_graph()
