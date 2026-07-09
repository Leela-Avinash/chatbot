import React, { useState, useEffect, useRef } from 'react';

export const ArtifactEditor = ({ artifact, onSave, onContentChange }) => {
  const [content, setContent] = useState(artifact.content);
  const userEditedRef = useRef(false);
  const lastTitleRef = useRef(artifact.title);

  useEffect(() => {
    // A different artifact was opened — always take its content.
    if (artifact.title !== lastTitleRef.current) {
      lastTitleRef.current = artifact.title;
      userEditedRef.current = false;
      setContent(artifact.content);
      return;
    }
    // Same artifact: only sync from the (possibly still-streaming) prop
    // until the user starts typing, so their edits aren't overwritten
    // by incoming stream chunks.
    if (!userEditedRef.current) {
      setContent(artifact.content);
    }
  }, [artifact.content, artifact.title]);

  const handleChange = (e) => {
    userEditedRef.current = true;
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
