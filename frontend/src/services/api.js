import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const LANGGRAPH_URL =
    import.meta.env.VITE_LANGGRAPH_URL || "http://localhost:8000";

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

// Chat API
export const chatApi = {
    // Get all chats
    getChats: async () => {
        const response = await api.get("/api/chat");
        return response.data.chats;
    },

    // Get specific chat
    getChat: async (chatId) => {
        const response = await api.get(`/api/chat/${chatId}`);
        return response.data.chat;
    },

    // Create new chat
    createChat: async (title) => {
        const response = await api.post("/api/chat", { title });
        return response.data.chat;
    },

    // Send message with streaming
    sendMessage: async (chatId, message) => {
        const response = await fetch(`${API_URL}/api/chat/${chatId}/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ message }),
        });

        return response;
    },

    // Delete chat
    deleteChat: async (chatId) => {
        const response = await api.delete(`/api/chat/${chatId}`);
        return response.data;
    },

    // Legacy support - direct to LangGraph
    sendMessageDirect: async (message, sessionId) => {
        const response = await fetch(`${LANGGRAPH_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                session_id: sessionId,
                stream: true,
            }),
        });

        return response;
    },

    getChatHistory: async (chatId) => {
        const response = await api.get(`/api/chat/${chatId}`);
        return response.data;
    },
};

// Document API
export const documentApi = {
    // Get documents for chat
    getDocuments: async (chatId) => {
        const response = await api.get("/api/document", { params: { chatId } });
        return response.data.documents;
    },

    // Get single document
    getDocument: async (documentId) => {
        const response = await api.get(`/api/document/${documentId}`);
        return response.data.document;
    },

    // Create document
    createDocument: async (chatId, title, kind, content) => {
        const response = await api.post("/api/document", {
            chatId,
            title,
            kind,
            content,
        });
        return response.data.document;
    },

    // Update document
    updateDocument: async (documentId, content) => {
        const response = await api.patch(`/api/document/${documentId}`, {
            content,
        });
        return response.data.document;
    },

    // Delete document
    deleteDocument: async (documentId) => {
        const response = await api.delete(`/api/document/${documentId}`);
        return response.data;
    },
};

// Auth API
export const authApi = {
    login: async (email, password) => {
        const response = await api.post("/api/auth/login", { email, password });
        localStorage.setItem("token", response.data.token);
        return response.data;
    },

    register: async (username, email, password) => {
        const response = await api.post("/api/auth/register", {
            username,
            email,
            password,
        });
        localStorage.setItem("token", response.data.token);
        return response.data;
    },

    logout: () => {
        localStorage.removeItem("token");
        window.location.href = "/";
    },

    getCurrentUser: async () => {
        const response = await api.get("/api/auth/me");
        return response.data.user;
    },
};
