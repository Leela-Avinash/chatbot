import { createSlice } from "@reduxjs/toolkit";
import { MESSAGE_TYPES } from "../constants/messageTypes";

const chatSlice = createSlice({
    name: "chat",
    initialState: {
        messages: [],
        currentArtifact: null,
        isStreaming: false,
    },
    reducers: {
        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },
        updateLastMessage: (state, action) => {
            const lastMessage = state.messages[state.messages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
                lastMessage.content += action.payload;
            }
        },
        addDocumentToLastMessage: (state, action) => {
            const lastMessage = state.messages[state.messages.length - 1];
            console.log('addDocumentToLastMessage called:', {
                hasLastMessage: !!lastMessage,
                isAssistant: lastMessage?.role === "assistant",
                document: action.payload
            });
            if (lastMessage && lastMessage.role === "assistant") {
                if (!lastMessage.documents) {
                    lastMessage.documents = [];
                }
                lastMessage.documents.push(action.payload);
                console.log('Document added to message. Total documents:', lastMessage.documents.length);
                
                // Update message type intelligently
                if (lastMessage.weatherData) {
                    lastMessage.type = MESSAGE_TYPES.COMBINED;  // Has both weather and documents
                } else {
                    lastMessage.type = MESSAGE_TYPES.DOCUMENT;  // Only documents
                }
                console.log('Message type updated to:', lastMessage.type);
            }
        },
        setLastMessageWeatherData: (state, action) => {
            const lastMessage = state.messages[state.messages.length - 1];
            console.log('setLastMessageWeatherData called:', {
                hasLastMessage: !!lastMessage,
                isAssistant: lastMessage?.role === "assistant",
                weatherData: action.payload
            });
            if (lastMessage && lastMessage.role === "assistant") {
                lastMessage.weatherData = action.payload;
                console.log('Weather data set to message');
                
                // Update message type intelligently
                if (lastMessage.documents && lastMessage.documents.length > 0) {
                    lastMessage.type = MESSAGE_TYPES.COMBINED;  // Has both weather and documents
                } else {
                    lastMessage.type = MESSAGE_TYPES.WEATHER;  // Only weather
                }
                console.log('Message type updated to:', lastMessage.type);
            }
        },
        setCurrentArtifact: (state, action) => {
            state.currentArtifact = action.payload;
        },
        appendArtifactContent: (state, action) => {
            if (state.currentArtifact) {
                state.currentArtifact.content += action.payload;
            }
        },
        setIsStreaming: (state, action) => {
            state.isStreaming = action.payload;
        },
        clearMessages: (state) => {
            state.messages = [];
        },
    },
});

export const {
    addMessage,
    updateLastMessage,
    addDocumentToLastMessage,
    setLastMessageWeatherData,
    setCurrentArtifact,
    appendArtifactContent,
    setIsStreaming,
    clearMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
