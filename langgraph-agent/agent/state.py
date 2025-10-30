from typing import TypedDict, List, Optional, Any
from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """Unified state representation for the agent graph."""

    messages: List[BaseMessage]
    user_input: Optional[str]

    current_step: Optional[str]
    should_continue: bool
    final_response: Optional[str]

    tool_calls: List[dict]
    tool_results: List[dict]

    artifact_type: Optional[str]  
    artifact_title: Optional[str]
    artifact_content: Optional[str]

    weather_data: Optional[dict]

    response_chunks: List[str]

    session_id: str
    user_id: Optional[str]
