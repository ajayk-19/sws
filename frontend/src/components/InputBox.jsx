import React, { useState } from 'react';
import { Send } from 'lucide-react';

const InputBox = ({ onSendMessage, disabled, placeholder = "Ask about policies, leave, benefits..." }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input-pill" onSubmit={handleSubmit}>
      <input
        type="text"
        className="chat-input-field"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button 
        type="submit" 
        className="chat-send-btn"
        disabled={disabled || !text.trim()}
        title="Send Question"
      >
        <Send size={16} />
      </button>
    </form>
  );
};

export default InputBox;
