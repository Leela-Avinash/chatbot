import React from 'react';
import { FileText, Code, Table } from 'lucide-react';

export const DocumentCard = ({ document, onClick }) => {
    const getIcon = () => {
        switch (document.type) {
            case 'code':
                return <Code className="w-5 h-5" style={{ color: '#a78bfa' }} />;
            case 'sheet':
                return <Table className="w-5 h-5" style={{ color: '#34d399' }} />;
            case 'text':
            default:
                return <FileText className="w-5 h-5" style={{ color: '#60a5fa' }} />;
        }
    };

    const getTypeLabel = () => {
        switch (document.type) {
            case 'code':
                return 'Code';
            case 'sheet':
                return 'Spreadsheet';
            case 'text':
            default:
                return 'Document';
        }
    };

    return (
        <div
            onClick={onClick}
            className="inline-flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition-all group max-w-sm"
            style={{
                backgroundColor: '#2d2d2d',
                borderColor: '#404040'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#404040';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div className="shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#e5e7eb' }}>
                    {document.title || 'Untitled Document'}
                </div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>
                    {getTypeLabel()}
                </div>
            </div>
        </div>
    );
};
