import React, { useState, useEffect } from 'react';

export const ArtifactEditor = ({ artifact, onSave, onContentChange }) => {
  const [content, setContent] = useState(artifact.content);
  
  useEffect(() => {
    setContent(artifact.content);
  }, [artifact.content]);
  
  const handleChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    // Immediately update parent component
    onContentChange?.(newContent);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <textarea
          value={content}
          onChange={handleChange}
          className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none"
          style={{
            backgroundColor: '#1a1a1a',
            color: '#e5e7eb',
            borderColor: '#404040'
          }}
          placeholder="Enter content here..."
        />
      </div>
    </div>
  );
};
