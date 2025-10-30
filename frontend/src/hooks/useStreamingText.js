import { useState, useCallback } from "react";

export const useStreamingText = (options = {}) => {
    const [streamedText, setStreamedText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);

    const {
        onChunk,
        onComplete,
        onError,
        smoothing = true,
        chunkDelay = 20,
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

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.substring(6));

                                if (data.type === "text_chunk") {
                                    const content = data.content;

                                    if (smoothing) {
                                        // Smooth character-by-character rendering
                                        for (const char of content) {
                                            fullText += char;
                                            setStreamedText(fullText);
                                            onChunk?.(char);
                                            await new Promise((resolve) =>
                                                setTimeout(resolve, chunkDelay)
                                            );
                                        }
                                    } else {
                                        fullText += content;
                                        setStreamedText(fullText);
                                        onChunk?.(content);
                                    }
                                } else if (data.type === "done") {
                                    onComplete?.(fullText);
                                } else if (data.type === "error") {
                                    throw new Error(data.message);
                                }
                            } catch (parseError) {
                                console.warn("Failed to parse SSE data:", line);
                            }
                        }
                    }
                }
            } catch (error) {
                onError?.(error);
                throw error;
            } finally {
                setIsStreaming(false);
            }

            return fullText;
        },
        [onChunk, onComplete, onError, smoothing, chunkDelay]
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
