import React, { useState } from 'react';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';

const Message = ({ message }) => {
  const { role, content, sources, timestamp } = message;
  const isUser = role === 'user';
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={`message-box ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="avatar-container">
          <Bot size={16} />
        </div>
      )}
      <div className="msg-container">
        <div className="msg-info">
          <span>{isUser ? 'You' : 'SWS AI Assistant'}</span>
          <span>•</span>
          <span>{timestamp}</span>
        </div>
        <div className="msg-bubble">
          {content}
          
          {/* Collapsible references list for RAG sources */}
          {!isUser && sources && sources.length > 0 && (
            <div className="citations">
              <div 
                className="citations-toggle" 
                onClick={() => setShowSources(!showSources)}
              >
                <span>References ({sources.length})</span>
                {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
              
              {showSources && (
                <div className="citations-list">
                  {sources.map((src, index) => (
                    <div className="citation-card" key={index}>
                      <div className="citation-meta">
                        <span>Source #{index + 1}</span>
                        {src.source && (
                          <span style={{ fontWeight: 600 }}>{src.source}</span>
                        )}
                        {src.page !== null && src.page !== undefined && (
                          <span>Page {src.page + 1}</span>
                        )}
                      </div>
                      <p>{src.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
