import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Loader2 } from 'lucide-react';
import { WeatherCard } from './WeatherCard';
import { DocumentCard } from './DocumentCard';

export const Message = ({ message, onDocumentClick }) => {
    const isUser = message.role === 'user';
    const isThinking = message.role === 'assistant' && !message.content && message.type === 'general';

    // Debug logging for assistant messages
    if (!isUser) {
        console.log('📨 Message component received:', {
            id: message.id,
            type: message.type,
            hasContent: !!message.content,
            hasWeatherData: !!message.weatherData,
            hasDocuments: !!message.documents,
            documentsLength: message.documents?.length,
            documents: message.documents
        });
    }

    return (
        <div className={`flex gap-4 p-4 ${isUser ? 'flex-row-reverse' : ''}`} style={{ backgroundColor: '#1f1f1f' }}>
            <div className="shrink-0">
                {isUser ? (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <User size={20} className="text-white" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                        <Bot size={20} className="text-white" />
                    </div>
                )}
            </div>

            <div className={`flex-1 space-y-2 ${isUser ? 'flex flex-col items-end' : ''}`}>
                {isThinking ? (
                    <div className="flex items-center gap-2 text-gray-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm italic">Thinking...</span>
                    </div>
                ) : (
                    <>
                        {/* Text content for general and all types */}
                        {message.content && (
                            <div className={`prose prose-slate prose-sm max-w-none
                                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-gray-100
                                prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6 prose-h1:border-b prose-h1:border-gray-700 prose-h1:pb-2
                                prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5
                                prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4
                                prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-3
                                prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                                prose-strong:text-gray-100 prose-strong:font-semibold
                                prose-em:text-gray-300
                                prose-code:text-pink-400 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:bg-gray-800 prose-blockquote:py-2 prose-blockquote:my-3 prose-blockquote:text-gray-300
                                prose-ul:list-disc prose-ul:ml-6 prose-ul:my-3
                                prose-ol:list-decimal prose-ol:ml-6 prose-ol:my-3
                                prose-li:text-gray-300 prose-li:mb-1
                                prose-table:border-collapse prose-table:w-full prose-table:my-4 prose-table:text-sm
                                prose-th:bg-gray-800 prose-th:p-2 prose-th:border prose-th:border-gray-700 prose-th:font-semibold prose-th:text-left prose-th:text-gray-200
                                prose-td:p-2 prose-td:border prose-td:border-gray-700 prose-td:text-gray-300
                                prose-hr:border-gray-700 prose-hr:my-6
                                ${isUser ? 'max-w-3/4 bg-[#2e2e2e] text-white rounded-2xl px-4 py-2 prose-p:text-white' : ''}`}>
                                {isUser ? (
                                    <p className="text-white m-0">{message.content}</p>
                                ) : (
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({node, inline, className, children, ...props}) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return !inline && match ? (
                                                    <SyntaxHighlighter
                                                        style={vscDarkPlus}
                                                        language={match[1]}
                                                        PreTag="div"
                                                        customStyle={{
                                                            margin: '1rem 0',
                                                            borderRadius: '0.5rem',
                                                            fontSize: '0.875rem'
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
                                        {message.content}
                                    </ReactMarkdown>
                                )}
                            </div>
                        )}
                        
                        {/* Show weather card if weatherData exists (regardless of type) */}
                        {!isUser && message.weatherData && (
                            <WeatherCard data={message.weatherData} />
                        )}

                        {/* Show document cards if documents exist (regardless of type) */}
                        {!isUser && message.documents && message.documents.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {message.documents.map((doc, index) => (
                                    <DocumentCard
                                        key={doc.documentId || index}
                                        document={doc}
                                        onClick={() => onDocumentClick && onDocumentClick(doc)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
