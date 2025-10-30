import React, { useState } from 'react';
import { 
    Plus, 
    MessageSquare, 
    FileText, 
    ChevronRight, 
    ChevronDown,
    Clock,
    Menu,
    X,
    Trash2
} from 'lucide-react';

export const Sidebar = ({ 
    chats, 
    currentChatId, 
    onSelectChat, 
    onNewChat,
    onSelectDocument,
    onDeleteChat
}) => {
    const [isOpen, setIsOpen] = useState(true);
    const [expandedChats, setExpandedChats] = useState({});

    const toggleChatExpansion = (chatId) => {
        setExpandedChats(prev => ({
            ...prev,
            [chatId]: !prev[chatId]
        }));
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const getDocumentsFromChat = (chat) => {
        if (!chat.messages) return [];
        
        const documents = [];
        chat.messages.forEach(message => {
            if (message.metadata?.artifacts) {
                message.metadata.artifacts.forEach(artifact => {
                    documents.push({
                        ...artifact,
                        messageId: message.id
                    });
                });
            }
        });
        return documents;
    };

    return (
        <>
            {/* Mobile toggle button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg hover:bg-gray-700"
                style={{ backgroundColor: '#1f2937' }}
            >
                {isOpen ? <X size={20} className="text-gray-300" /> : <Menu size={20} className="text-gray-300" />}
            </button>

            {/* Sidebar */}
            <div 
                className={`
                    fixed lg:relative inset-y-0 left-0 z-40
                    w-64 border-r flex flex-col h-full
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ backgroundColor: '#1a1a1a', borderColor: '#2d2d2d' }}
            >
                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: '#2d2d2d' }}>
                    <button
                        onClick={onNewChat}
                        className="w-full flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        style={{ backgroundColor: '#2f2f2f' }}
                    >
                        <Plus size={18} />
                        <span className="font-medium">New Chat</span>
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {chats.length === 0 ? (
                        <div className="text-center text-sm py-8" style={{ color: '#9ca3af' }}>
                            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No chats yet</p>
                            <p className="text-xs mt-1">Start a new conversation</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {chats.map((chat) => {
                                const documents = getDocumentsFromChat(chat);
                                const isExpanded = expandedChats[chat._id];
                                const isActive = chat._id === currentChatId;

                                return (
                                    <div key={chat._id} className="rounded-lg overflow-hidden">
                                        {/* Chat Item */}
                                        <div 
                                            className={`
                                                group relative flex items-center gap-2 p-3 rounded-lg cursor-pointer
                                                transition-colors
                                            `}
                                            style={{
                                                backgroundColor: isActive ? '#2f2f2f' : 'transparent',
                                                border: isActive ? '1px solid #3f3f3f' : '1px solid transparent'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isActive) e.currentTarget.style.backgroundColor = '#2d2d2d';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                        >
                                            <div 
                                                className="flex-1 min-w-0"
                                                onClick={() => onSelectChat(chat._id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <MessageSquare size={16} className="shrink-0" style={{ color: '#9ca3af' }} />
                                                    <p className={`text-sm font-medium truncate`} style={{ color: isActive ? '#60a5fa' : '#e5e7eb' }}>
                                                        {chat.title}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Clock size={12} style={{ color: '#6b7280' }} />
                                                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                                                        {formatDate(chat.updatedAt)}
                                                    </p>
                                                    {documents.length > 0 && (
                                                        <span className="ml-auto flex items-center gap-1 text-xs" style={{ color: '#60a5fa' }}>
                                                            <FileText size={12} />
                                                            {documents.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Delete button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteChat(chat._id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                                                style={{ backgroundColor: 'transparent' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7f1d1d'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Delete chat"
                                            >
                                                <Trash2 size={14} style={{ color: '#ef4444' }} />
                                            </button>

                                            {/* Expand button for documents */}
                                            {documents.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleChatExpansion(chat._id);
                                                    }}
                                                    className="p-1 rounded transition-colors"
                                                    style={{ backgroundColor: 'transparent' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                                                    ) : (
                                                        <ChevronRight size={16} style={{ color: '#9ca3af' }} />
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* Documents List */}
                                        {isExpanded && documents.length > 0 && (
                                            <div className="ml-4 mt-1 space-y-1 border-l-2 pl-2" style={{ borderColor: '#404040' }}>
                                                {documents.map((doc, index) => (
                                                    <button
                                                        key={`${doc.messageId}-${index}`}
                                                        onClick={() => {
                                                            onSelectChat(chat._id);
                                                            onSelectDocument(doc);
                                                        }}
                                                        className="w-full flex items-center gap-2 p-2 rounded text-left transition-colors group"
                                                        style={{ backgroundColor: 'transparent' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <FileText size={14} className="shrink-0" style={{ color: '#60a5fa' }} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate" style={{ color: '#e5e7eb' }}>
                                                                {doc.title || 'Untitled Document'}
                                                            </p>
                                                            <p className="text-xs capitalize" style={{ color: '#9ca3af' }}>
                                                                {doc.type || doc.kind || 'text'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t shrink-0" style={{ borderColor: '#2d2d2d' }}>
                    <div className="text-xs text-center" style={{ color: '#9ca3af' }}>
                        {chats.length} {chats.length === 1 ? 'conversation' : 'conversations'}
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};
