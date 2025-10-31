import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    addMessage,
    updateLastMessage,
    addDocumentToLastMessage,
    setLastMessageWeatherData,
    setCurrentArtifact,
    appendArtifactContent,
    setIsStreaming,
    clearMessages,
} from '../store/chatSlice';
import { MESSAGE_TYPES } from '../constants/messageTypes';
import { Message } from './Message';
import { ChatInput } from './ChatInput';
import { ArtifactPanel } from './ArtifactPanel';
import { Sidebar } from './Sidebar';
import { ConfirmModal } from './ConfirmModal';
import { chatApi, documentApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStreamingText } from '../hooks/useStreamingText';

export const Chat = () => {
    const dispatch = useDispatch();
    const { user } = useAuth();
    const { messages, currentArtifact, isStreaming } = useSelector((state) => state.chat);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chats, setChats] = useState([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesCache = useRef({});  // Cache for loaded messages

    // Streaming hook for text and tool processing
    const { processStream } = useStreamingText({
        onChunk: (char) => dispatch(updateLastMessage(char)),
        onToolCall: (data) => {
            console.log('🔧 Tool call received in Chat:', data);
            
            // Handle weather tool (including errors)
            if (data.tool === 'get_weather') {
                if (data.result) {
                    console.log('Setting weather data to last message:', data.result);
                    dispatch(setLastMessageWeatherData(data.result));
                } else {
                    console.warn('Weather result is missing');
                }
            }

            // Handle document creation
            if (data.tool === 'create_document') {
                if (data.action === 'start') {
                    console.log('Document streaming started');
                    // Clear the artifact panel for new document
                    dispatch(setCurrentArtifact({
                        type: data.type || 'text',
                        title: data.title || 'Document',
                        content: '',
                        status: 'streaming',
                    }));
                } else if (data.action === 'stream') {
                    // Stream document content into the artifact as smooth typing
                    // Break incoming chunk into characters and append one-by-one so
                    // the UI renders it like the assistant's typing stream.
                    const chunk = data.chunk || '';
                    for (const ch of chunk) {
                        dispatch(appendArtifactContent(ch));
                    }
                } else if (data.action === 'complete') {
                    console.log('📄 Document complete event:', {
                        title: data.result?.title,
                        type: data.result?.kind,
                        contentLength: data.documentContent?.length
                    });

                    const completedDocument = {
                        type: data.result?.kind || data.result?.doc_type || 'text',
                        title: data.result?.title || 'Document',
                        content: data.documentContent || '',
                        kind: data.result?.kind || data.result?.doc_type,
                        status: 'complete',
                    };

                    // Update the artifact panel with completed document
                    dispatch(setCurrentArtifact(completedDocument));

                    console.log('📎 Adding document to last message');
                    dispatch(addDocumentToLastMessage(completedDocument));
                }
            }
        },
        onComplete: () => {
            dispatch(setIsStreaming(false));
        },
        onError: (error) => {
            console.error('Streaming error:', error);
            dispatch(setIsStreaming(false));
        }
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const loadChatsAndInitialize = async () => {
            try {
                // Fetch chats immediately
                const userChats = await chatApi.getChats();
                setChats(userChats);
                
                if (userChats.length === 0) {
                    // No chats, create a new one
                    const newChat = await chatApi.createChat('New Chat');
                    setCurrentChatId(newChat._id);
                    setChats([newChat]);
                } else {
                    // Set first chat as current
                    const firstChat = userChats[0];
                    setCurrentChatId(firstChat._id);
                    
                    // Load first chat messages immediately
                    await loadChatMessages(firstChat._id);
                    
                    // Prefetch next 2 chats in background for faster switching
                    if (userChats.length > 1) {
                        prefetchChatMessages(userChats[1]._id);
                    }
                    if (userChats.length > 2) {
                        prefetchChatMessages(userChats[2]._id);
                    }
                }
            } catch (error) {
                console.error('Failed to load chats:', error);
            }
        };

        if (user) {
            loadChatsAndInitialize();
        }
    }, [user]);

    const prefetchChatMessages = async (chatId) => {
        // Prefetch chat messages in background without blocking UI
        try {
            if (messagesCache.current[chatId]) return; // Already cached
            
            const chat = await chatApi.getChat(chatId);
            if (chat && chat.messages) {
                messagesCache.current[chatId] = chat.messages;
                console.log('✓ Prefetched chat:', chatId);
            }
        } catch (error) {
            console.error('Failed to prefetch chat:', chatId, error);
        }
    };

    const loadChatMessages = async (chatId) => {
        try {
            setIsLoadingChat(true);
            
            // Check cache first
            if (messagesCache.current[chatId]) {
                console.log('✓ Loading from cache:', chatId);
                dispatch(clearMessages());
                messagesCache.current[chatId].forEach(msg => {
                    dispatch(addMessage(msg));
                });
                setIsLoadingChat(false);
                return;
            }
            
            // Fetch from server
            const chat = await chatApi.getChat(chatId);
            if (chat && chat.messages) {
                dispatch(clearMessages());
                
                // Cache the messages
                messagesCache.current[chatId] = chat.messages;
                
                // Simply add all messages - they now contain their own weatherData and documents
                chat.messages.forEach(msg => {
                    dispatch(addMessage(msg));
                });
                
                console.log('✓ Loaded', chat.messages.length, 'messages for chat:', chatId);
            }
        } catch (error) {
            console.error('Failed to load chat messages:', error);
        } finally {
            setIsLoadingChat(false);
        }
    };

    const handleSelectChat = async (chatId) => {
        if (chatId === currentChatId) return; // Already selected
        
        setCurrentChatId(chatId);
        dispatch(setCurrentArtifact(null));
        await loadChatMessages(chatId);
        
        // Prefetch adjacent chats for faster navigation
        const currentIndex = chats.findIndex(c => c._id === chatId);
        if (currentIndex >= 0) {
            // Prefetch next chat
            if (currentIndex < chats.length - 1) {
                prefetchChatMessages(chats[currentIndex + 1]._id);
            }
            // Prefetch previous chat
            if (currentIndex > 0) {
                prefetchChatMessages(chats[currentIndex - 1]._id);
            }
        }
    };

    const handleNewChat = async () => {
        try {
            const newChat = await chatApi.createChat('New Chat');
            setCurrentChatId(newChat._id);
            setChats([newChat, ...chats]);
            dispatch(clearMessages());
            dispatch(setCurrentArtifact(null));
            // Clear cache for new chat
            delete messagesCache.current[newChat._id];
        } catch (error) {
            console.error('Failed to create new chat:', error);
        }
    };

    const handleDeleteChat = async (chatId) => {
        // Open confirmation modal instead of using alert
        setChatToDelete(chatId);
        setDeleteModalOpen(true);
    };

    const confirmDeleteChat = async () => {
        const chatId = chatToDelete;
        if (!chatId) return;

        try {
            await chatApi.deleteChat(chatId);
            
            // Clear cache for deleted chat
            delete messagesCache.current[chatId];
            
            // Remove from local state
            const updatedChats = chats.filter(chat => chat._id !== chatId);
            setChats(updatedChats);
            
            // If we deleted the current chat, switch to another chat or create new
            if (chatId === currentChatId) {
                dispatch(clearMessages());
                dispatch(setCurrentArtifact(null));
                
                if (updatedChats.length > 0) {
                    // Switch to the first available chat
                    setCurrentChatId(updatedChats[0]._id);
                    await loadChatMessages(updatedChats[0]._id);
                } else {
                    // No chats left, create a new one
                    const newChat = await chatApi.createChat('New Chat');
                    setCurrentChatId(newChat._id);
                    setChats([newChat]);
                }
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
            setErrorMessage('Failed to delete chat. Please try again.');
            setErrorModalOpen(true);
        } finally {
            setChatToDelete(null);
        }
    };

    const handleSelectDocument = (document) => {
        dispatch(setCurrentArtifact({
            type: document.type || document.kind || 'text',
            title: document.title || 'Document',
            content: document.content || '',
            status: 'complete',
        }));
    };

    const handleDocumentClick = async (documentRef) => {
        // If document has content already, display it
        if (documentRef.content) {
            handleSelectDocument(documentRef);
            return;
        }
        
        // Otherwise, fetch from backend using documentId
        if (documentRef.documentId) {
            try {
                const document = await documentApi.getDocument(documentRef.documentId);
                if (document) {
                    dispatch(setCurrentArtifact({
                        type: document.type || document.kind || 'text',
                        title: document.title || 'Document',
                        content: document.content || '',
                        status: 'complete',
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch document:', error);
                setErrorMessage('Failed to load document. Please try again.');
                setErrorModalOpen(true);
            }
        }
    };

    const handleSendMessage = async (content) => {
        let chatId = currentChatId;
        if (!chatId) {
            try {
                const newChat = await chatApi.createChat('New Chat');
                chatId = newChat._id;
                setCurrentChatId(chatId);
                setChats([newChat, ...chats]);
            } catch (error) {
                console.error('Failed to create chat:', error);
                return;
            }
        }

        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
        };
        dispatch(addMessage(userMessage));

        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage = {
            id: assistantMessageId,
            role: 'assistant',
            type: MESSAGE_TYPES.GENERAL,  // Will be updated during streaming
            content: '',
            timestamp: new Date().toISOString(),
        };
        dispatch(addMessage(assistantMessage));

        dispatch(setIsStreaming(true));

        try {
            const response = await chatApi.sendMessage(chatId, content);

            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }

            // Use the streaming hook to process the response
            await processStream(response);

        } catch (error) {
            console.error('Chat error:', error);
            dispatch(updateLastMessage('\n\nSorry, an error occurred.'));
            dispatch(setIsStreaming(false));
        }

        // Invalidate cache for current chat since new messages were added
        delete messagesCache.current[chatId];
        
        // Refresh chat list to update timestamp and title
        try {
            const userChats = await chatApi.getChats();
            setChats(userChats);
        } catch (error) {
            console.error('Failed to refresh chats:', error);
        }
    };

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <Sidebar
                chats={chats}
                currentChatId={currentChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
                onSelectDocument={handleSelectDocument}
                onDeleteChat={handleDeleteChat}
            />

            {/* Main Chat Area */}
            <div className={'flex-1 flex flex-col ' + (currentArtifact ? 'mr-0 md:mr-[45%]' : '')}>
                <div className="flex-1 overflow-y-auto relative" style={{ backgroundColor: '#1f1f1f' }}>
                    <div className={`mx-auto ${currentArtifact ? 'max-w-full' : 'max-w-[65%]'}`}>
                        {isLoadingChat && messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading messages...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <Message 
                                        key={message.id} 
                                        message={message} 
                                        onDocumentClick={handleDocumentClick}
                                    />
                                ))}

                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>
                </div>

                <ChatInput 
                    onSend={handleSendMessage} 
                    disabled={isStreaming || isLoadingChat}
                    hasArtifact={!!currentArtifact}
                />
            </div>

            {/* Artifact Panel */}
            <ArtifactPanel
                artifact={currentArtifact}
                onClose={() => dispatch(setCurrentArtifact(null))}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setChatToDelete(null);
                }}
                onConfirm={confirmDeleteChat}
                title="Delete Chat"
                message={`Delete "${chats.find(c => c._id === chatToDelete)?.title || 'this chat'}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Error Modal */}
            <ConfirmModal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                onConfirm={() => setErrorModalOpen(false)}
                title="Error"
                message={errorMessage}
                confirmText="OK"
                cancelText=""
                variant="danger"
            />
        </div>
    );
};
