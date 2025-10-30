import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ChatInput = ({ onSend, disabled, hasArtifact }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
        }
    };

    return (
        <div className="relative p-4 bg-transparent">
            <div className={`mx-auto relative ${hasArtifact ? 'max-w-full' : 'max-w-[65%]'}`}>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message AI Chatbot..."
                        disabled={disabled}
                        className="w-full px-4 py-3 pr-12 border rounded-3xl focus:outline-none transition"
                        style={{
                            backgroundColor: '#2d2d2d',
                            borderColor: '#404040',
                            color: '#e5e7eb',
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#555555';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#404040';
                        }}
                    />
                    <button
                        type="submit"
                        disabled={disabled || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full transition flex items-center justify-center"
                        style={{
                            backgroundColor: disabled || !input.trim() ? '#404040' : '#e5e7eb',
                            width: '32px',
                            height: '32px',
                            cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
                            opacity: disabled || !input.trim() ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled && input.trim()) {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!disabled && input.trim()) {
                                e.currentTarget.style.backgroundColor = '#e5e7eb';
                            }
                        }}
                    >
                        <ArrowUp size={18} style={{ color: '#1a1a1a' }} strokeWidth={3} />
                    </button>
                </form>
            </div>
        </div>
    );
};
