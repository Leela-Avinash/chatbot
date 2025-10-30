import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'OK', cancelText = 'Cancel', variant = 'danger' }) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: '#ef4444',
            button: '#dc2626',
            buttonHover: '#b91c1c',
            border: '#7f1d1d',
        },
        warning: {
            icon: '#f59e0b',
            button: '#d97706',
            buttonHover: '#b45309',
            border: '#92400e',
        },
        info: {
            icon: '#3b82f6',
            button: '#2563eb',
            buttonHover: '#1d4ed8',
            border: '#1e40af',
        },
    };

    const styles = variantStyles[variant] || variantStyles.danger;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200" style={{ backgroundColor: '#2d2d2d' }}>
                {/* Header */}
                <div className="flex items-center gap-3 p-6 border-b" style={{ borderColor: styles.border }}>
                    <AlertTriangle className="w-6 h-6" style={{ color: styles.icon }} />
                    <h2 className="text-xl font-semibold flex-1" style={{ color: '#e5e7eb' }}>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="transition-colors"
                        style={{ color: '#9ca3af' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#e5e7eb'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="leading-relaxed" style={{ color: '#d1d5db' }}>
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t" style={{ backgroundColor: '#1a1a1a', borderColor: '#404040' }}>
                    {cancelText && (
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border rounded-lg transition-colors font-medium"
                            style={{ 
                                color: '#e5e7eb',
                                backgroundColor: '#404040',
                                borderColor: '#6b7280'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`${cancelText ? 'flex-1' : 'w-full'} px-4 py-2.5 text-white rounded-lg transition-colors font-medium`}
                        style={{ backgroundColor: styles.button }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.buttonHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = styles.button}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
