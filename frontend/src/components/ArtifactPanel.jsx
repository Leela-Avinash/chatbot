import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, FileText, Code, Table, Edit3, Copy, Download } from 'lucide-react';
import { ArtifactEditor } from './ArtifactEditor';
import { useDispatch } from 'react-redux';
import { setCurrentArtifact } from '../store/chatSlice';

export const ArtifactPanel = ({ artifact, onClose, streamingResponse }) => {
    const dispatch = useDispatch();
    const [useEditor, setUseEditor] = useState(false);
    const [codeLanguage, setCodeLanguage] = useState('javascript');
    const contentRef = useRef(null);

    // ArtifactPanel now relies on the centralized Redux artifact content
    // for streaming updates. The Chat flow appends characters to
    // `currentArtifact.content` (via `appendArtifactContent`) so the panel
    // renders that value directly. This avoids duplicate processing and
    // makes artifact streaming behave like assistant typing.

    // Detect language from artifact title or content
    // This hook must be before the early return
    useEffect(() => {
        if (artifact && artifact.type === 'code' && artifact.title) {
            const title = artifact.title.toLowerCase();
            if (title.includes('python') || title.includes('.py')) setCodeLanguage('python');
            else if (title.includes('java') || title.includes('.java')) setCodeLanguage('java');
            else if (title.includes('c++') || title.includes('.cpp')) setCodeLanguage('cpp');
            else if (title.includes('c#') || title.includes('.cs')) setCodeLanguage('csharp');
            else if (title.includes('html') || title.includes('.html')) setCodeLanguage('html');
            else if (title.includes('css') || title.includes('.css')) setCodeLanguage('css');
            else if (title.includes('json') || title.includes('.json')) setCodeLanguage('json');
            else if (title.includes('sql') || title.includes('.sql')) setCodeLanguage('sql');
            else if (title.includes('bash') || title.includes('.sh')) setCodeLanguage('bash');
            else if (title.includes('typescript') || title.includes('.ts')) setCodeLanguage('typescript');
            else if (title.includes('jsx') || title.includes('.jsx')) setCodeLanguage('jsx');
            else setCodeLanguage('javascript');
        }
    }, [artifact?.type, artifact?.title]);

    // Early return must come AFTER all hooks
    if (!artifact) return null;

    const handleSave = (content) => {
        // Update the artifact in Redux store
        dispatch(setCurrentArtifact({
            ...artifact,
            content: content
        }));
    };

    const handleContentChange = (newContent) => {
        // Update artifact in real-time as user types
        dispatch(setCurrentArtifact({
            ...artifact,
            content: newContent
        }));
    };

    const handleDownloadPDF = async () => {
        try {
            // Get the content element
            const element = contentRef.current;
            if (!element) return;

            let contentHTML = '';

            // For code artifacts, generate syntax-highlighted HTML
            if (artifact.type === 'code') {
                const codeLines = artifact.content.split('\n');
                const highlightedLines = codeLines.map((line, idx) => {
                    const escapedLine = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');
                    return `<tr><td class="line-number">${idx + 1}</td><td class="code-line">${escapedLine || '&nbsp;'}</td></tr>`;
                }).join('');

                contentHTML = `
                    <h1 style="color: #1f2937; margin-bottom: 1rem;">${artifact.title}</h1>
                    <div class="code-container">
                        <table class="code-table">
                            ${highlightedLines}
                        </table>
                    </div>
                `;
            } else {
                // For text/sheet artifacts, use the rendered markdown
                contentHTML = element.innerHTML;
            }

            // Create a new window for printing
            const printWindow = window.open('', '', 'width=800,height=600');

            // Create HTML with styles for PDF
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${artifact.title}</title>
                    <style>
                        @media print {
                            @page { margin: 2cm; }
                            body { margin: 0; }
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #1f2937;
                            max-width: 900px;
                            margin: 0 auto;
                            padding: 20px;
                            background: white;
                        }
                        h1 {
                            font-size: 2em;
                            font-weight: bold;
                            margin-top: 1.5em;
                            margin-bottom: 0.5em;
                            border-bottom: 2px solid #d1d5db;
                            padding-bottom: 0.3em;
                        }
                        h2 {
                            font-size: 1.5em;
                            font-weight: bold;
                            margin-top: 1.5em;
                            margin-bottom: 0.5em;
                        }
                        h3 {
                            font-size: 1.25em;
                            font-weight: bold;
                            margin-top: 1em;
                            margin-bottom: 0.5em;
                        }
                        p { margin-bottom: 1em; }
                        strong { font-weight: 600; }
                        em { font-style: italic; }
                        code {
                            background: #f3f4f6;
                            padding: 0.2em 0.4em;
                            border-radius: 3px;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 0.9em;
                            color: #1f2937;
                        }
                        .code-container {
                            background: #1e1e1e;
                            border-radius: 8px;
                            padding: 1rem;
                            margin: 1rem 0;
                            overflow-x: auto;
                        }
                        .code-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 13px;
                            line-height: 1.5;
                        }
                        .line-number {
                            color: #858585;
                            text-align: right;
                            padding-right: 1rem;
                            border-right: 1px solid #3e3e3e;
                            user-select: none;
                            min-width: 40px;
                            vertical-align: top;
                        }
                        .code-line {
                            color: #d4d4d4;
                            padding-left: 1rem;
                            white-space: pre;
                            vertical-align: top;
                        }
                        pre {
                            background: #1e1e1e;
                            color: #d4d4d4;
                            padding: 1em;
                            border-radius: 5px;
                            overflow-x: auto;
                            margin: 1em 0;
                            border: 1px solid #333;
                        }
                        pre code {
                            background: none;
                            padding: 0;
                            color: #d4d4d4;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 14px;
                            line-height: 1.5;
                        }
                        /* Syntax highlighting for code */
                        .hljs-keyword { color: #569cd6; }
                        .hljs-string { color: #ce9178; }
                        .hljs-number { color: #b5cea8; }
                        .hljs-comment { color: #6a9955; font-style: italic; }
                        .hljs-function { color: #dcdcaa; }
                        .hljs-class { color: #4ec9b0; }
                        .hljs-variable { color: #9cdcfe; }
                        .hljs-operator { color: #d4d4d4; }
                        .hljs-tag { color: #569cd6; }
                        .hljs-attr { color: #9cdcfe; }
                        .hljs-punctuation { color: #d4d4d4; }
                        blockquote {
                            border-left: 4px solid #3b82f6;
                            padding-left: 1em;
                            font-style: italic;
                            color: #4b5563;
                            margin: 1em 0;
                        }
                        ul, ol {
                            margin: 1em 0;
                            padding-left: 2em;
                        }
                        li { margin-bottom: 0.5em; }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 1.5em 0;
                        }
                        th, td {
                            border: 1px solid #d1d5db;
                            padding: 0.75em;
                            text-align: left;
                        }
                        th {
                            background: #f3f4f6;
                            font-weight: 600;
                        }
                        hr {
                            border: none;
                            border-top: 1px solid #d1d5db;
                            margin: 2em 0;
                        }
                    </style>
                </head>
                <body>
                    ${contentHTML}
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();

            // Wait for content to load
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);
            };

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(artifact.content)
            .then(() => {
                alert('Content copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy content.');
            });
    };

    const getIcon = () => {
        switch (artifact.type) {
            case 'text':
                return <FileText className="w-5 h-5 text-white" />;
            case 'code':
                return <Code className="w-5 h-5 text-white" />;
            case 'sheet':
                return <Table className="w-5 h-5 text-white" />;
            default:
                return <FileText className="w-5 h-5 text-white" />;
        }
    };

    return (
        <div className="fixed right-0 top-0 h-full w-full md:w-[45%] border-l shadow-2xl z-50 flex flex-col" style={{ backgroundColor: '#2d2d2d', borderColor: '#404040' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: '#2d2d2d', borderColor: '#404040' }}>
                <div className="flex items-center gap-2">
                    {getIcon()}
                    <h2 className="text-lg font-semibold" style={{ color: '#e5e7eb' }}>{artifact.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setUseEditor(!useEditor)}
                        className="p-2 rounded-lg transition"
                        style={{
                            backgroundColor: useEditor ? '#3b82f6' : 'transparent',
                            color: '#e5e7eb'
                        }}
                        title={useEditor ? "View mode" : "Editor mode"}
                        onMouseEnter={(e) => {
                            if (!useEditor) e.currentTarget.style.backgroundColor = '#404040';
                        }}
                        onMouseLeave={(e) => {
                            if (!useEditor) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <Edit3 size={18} />
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-2 rounded-lg transition"
                        style={{ color: '#e5e7eb' }}
                        title="Copy to clipboard"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Copy size={18} />
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="p-2 rounded-lg transition"
                        style={{ color: '#e5e7eb' }}
                        title="Download as PDF"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition"
                        style={{ color: '#e5e7eb' }}
                        title="Close"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {useEditor ? (
                <ArtifactEditor 
                    artifact={artifact} 
                    onSave={handleSave}
                    onContentChange={handleContentChange}
                />
            ) : (
                <div className="flex-1 overflow-y-auto p-6">
                    {artifact.status === 'streaming' && (
                        <div className="mb-4 flex items-center gap-2 text-blue-400">
                            <div className="animate-pulse">⚡</div>
                            <span className="text-sm">Generating...</span>
                        </div>
                    )}

                    {!artifact.content || artifact.content.trim() === '' ? (
                        <div className="text-gray-400 text-center py-8">
                            <p>No content available</p>
                            <p className="text-sm mt-2">Debug: Content length = {artifact.content?.length || 0}</p>
                        </div>
                    ) : (
                        <div
                            ref={contentRef}
                            className="prose prose-invert prose-slate max-w-none 
                                    prose-headings:font-bold prose-headings:text-gray-100
                                    prose-h1:text-3xl prose-h1:mb-4 prose-h1:border-b prose-h1:border-gray-700 prose-h1:pb-2
                                    prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-6
                                    prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4
                                    prose-p:text-gray-300 prose-p:leading-relaxed
                                    prose-a:text-blue-400 hover:prose-a:underline
                                    prose-strong:font-semibold prose-strong:text-gray-100
                                    prose-code:bg-[#222] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-pink-400
                                    prose-pre:bg-transparent prose-pre:p-0 prose-pre:shadow-none
                                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:italic prose-blockquote:text-gray-300
                                    prose-ul:list-disc prose-ol:list-decimal
                                    prose-li:text-gray-300
                                    prose-table:border-collapse
                                    prose-th:bg-[#222] prose-th:border prose-th:border-gray-700 prose-th:p-2 prose-th:text-gray-200
                                    prose-td:border prose-td:border-gray-700 prose-td:p-2 prose-td:text-gray-300
                                    ">
                            {artifact.type === 'text' || artifact.type === 'sheet' ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {artifact.content || ''}
                                </ReactMarkdown>
                            ) : artifact.type === 'code' ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    showLineNumbers={true}
                                                    customStyle={{
                                                        margin: '1rem 0',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.875rem',
                                                        padding: '1rem'
                                                    }}
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                    }}
                                >
                                    {artifact.content || ''}
                                </ReactMarkdown>
                            ) : (
                                <div className="whitespace-pre-wrap font-mono text-sm">
                                    {artifact.content}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
