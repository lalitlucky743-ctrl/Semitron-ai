import React, { useRef, useEffect } from 'react';
import { LOGO_URL } from '../utils/constants';

const MessageList = ({ messages = [], isWaiting }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isWaiting]);

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <div className="bubble">{msg.content}</div>
        </div>
      ))}
      {isWaiting && (
        <div className="message assistant">
          <div className="bubble loading-bubble">
            <img src={LOGO_URL} alt="Loading" className="loading-logo-small" />
            <span className="thinking-text">Thinking...</span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;