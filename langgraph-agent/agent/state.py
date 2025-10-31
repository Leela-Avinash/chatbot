from typing import TypedDict, List, Optional, Any
from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """Unified state representation for the agent graph."""

    messages: List[BaseMessage]
    user_input: Optional[str]

    should_continue: bool

    tool_calls: List[dict]
    tool_results: List[dict]

    streaming_tokens: List[str]  

    session_id: str
    user_id: Optional[str]
