const LANGGRAPH_URL =
    import.meta.env.VITE_LANGGRAPH_URL || "http://localhost:8000";

/**
 * Stream chat responses token-by-token from LangGraph agent
 * @param {string} message - User message
 * @param {Function} onToken - Callback for each token
 * @param {Function} onToolCall - Callback for tool invocations
 * @param {Function} onError - Callback for errors
 * @returns {Promise<string>} - Full response text
 */
export async function streamChat(message, onToken, onToolCall, onError) {
    try {
        const response = await fetch(`${LANGGRAPH_URL}/chat/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                session_id: `session_${Date.now()}`,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        // Handle text tokens
                        if (data.token) {
                            fullText += data.token;
                            if (onToken) {
                                onToken(data.token);
                            }
                        }

                        // Handle tool calls
                        if (data.tool) {
                            if (onToolCall) {
                                onToolCall(data.tool);
                            }
                        }

                        // Handle tool results (weather data, documents)
                        if (data.result) {
                            if (onToolCall) {
                                onToolCall({
                                    name: data.tool,
                                    result: data.result,
                                });
                            }
                        }
                    } catch (e) {
                        // Skip invalid JSON
                        console.warn("Failed to parse SSE data:", e);
                    }
                }
            }
        }

        return fullText;
    } catch (error) {
        console.error("Stream error:", error);
        if (onError) {
            onError(error);
        }
        throw error;
    }
}

/**
 * Get chat history
 * @param {string} chatId - Chat ID
 * @returns {Promise<Array>} - Array of messages
 */
export async function getChatHistory(chatId) {
    const response = await fetch(`${LANGGRAPH_URL}/chat/${chatId}`);
    if (!response.ok) {
        throw new Error("Failed to fetch chat history");
    }
    return response.json();
}
