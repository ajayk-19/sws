import React from 'react';
import Message from './Message.jsx';
import { Sparkles, Bot } from 'lucide-react';

const ChatBox = ({ messages, isLoading, documents, chatScrollRef }) => {
  return (
    <div className="chat-scroll-container" ref={chatScrollRef}>
      {/* Purple alert line at top of session */}
      <div className="ai-assistant-alert">
        <span className="ai-assistant-alert-icon">
          <Sparkles size={14} />
        </span>
        <span>
          Powered by Groq LLM + {documents.length} SWS AI company document{documents.length !== 1 ? 's' : ''}. Ask anything about company policies.
        </span>
      </div>

      {/* Chat Bubble List */}
      {messages.map((msg, idx) => (
        <Message key={idx} message={msg} />
      ))}

      {isLoading && (
        <div className="message-box assistant">
          <div className="avatar-container">
            <Bot size={16} />
          </div>
          <div className="msg-container">
            <div className="msg-bubble" style={{ padding: '12px 16px' }}>
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
