import { useState, useCallback } from "react";

export const useStreamingText = (options = {}) => {
    const [streamedText, setStreamedText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);

    const {
        onChunk,
        onComplete,
        onError,
        onToolCall,
        smoothing = true,
        chunkDelay = 15, // Match current Chat.jsx delay
    } = options;

    const processStream = useCallback(
        async (response) => {
            setIsStreaming(true);
            setStreamedText("");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("No reader available");
            }

            let fullText = "";
            let fullDocumentContent = ""; // For document artifacts
            let sseBuffer = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    sseBuffer += chunk;
                    const lines = sseBuffer.split("\n");
                    sseBuffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.substring(6));

                                // Handle text tokens (main chat response)
                                if (data.type === "text_chunk" || data.token) {
                                    const textContent = data.content || data.token;

                                    if (smoothing) {
                                        for (const char of textContent) {
                                            fullText += char;
                                            setStreamedText(fullText);
                                            onChunk?.(char);
                                            await new Promise((resolve) =>
                                                setTimeout(resolve, chunkDelay)
                                            );
                                        }
                                    } else {
                                        fullText += textContent;
                                        setStreamedText(fullText);
                                        onChunk?.(textContent);
                                    }
                                }

                                // Handle server-reported errors (e.g. LLM/tool failure mid-stream)
                                if (data.type === "error") {
                                    onError?.(Object.assign(
                                        new Error(data.error || "The assistant encountered an error."),
                                        { midStream: true }
                                    ));
                                }

                                // Handle document streaming
                                if (data.tool === 'create_document') {
                                    if (data.action === 'start') {
                                        fullDocumentContent = '';
                                        // Notify about document start
                                        onToolCall?.(data);
                                    } else if (data.action === 'stream' && data.chunk) {
                                        fullDocumentContent += data.chunk;
                                        // Notify about each chunk during streaming
                                        onToolCall?.(data);
                                    } else if (data.action === 'complete') {
                                        // Notify about completion with full content
                                        onToolCall?.({
                                            ...data,
                                            documentContent: fullDocumentContent
                                        });
                                    }
                                }
                                
                                // Handle all other tool calls (weather, errors, etc.)
                                if (data.tool && data.tool !== 'create_document') {
                                    onToolCall?.(data);
                                }

                            } catch (parseError) {
                                console.warn("Failed to parse SSE data:", line);
                            }
                        }
                    }
                }

                onComplete?.(fullText);
            } catch (error) {
                onError?.(error);
                throw error;
            } finally {
                setIsStreaming(false);
            }

            return fullText;
        },
        [onChunk, onComplete, onError, onToolCall, smoothing, chunkDelay]
    );

    const reset = useCallback(() => {
        setStreamedText("");
        setIsStreaming(false);
    }, []);

    return {
        streamedText,
        isStreaming,
        processStream,
        reset,
    };
};
