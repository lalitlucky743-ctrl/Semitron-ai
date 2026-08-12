import React, { useState } from 'react';
import { IconMenu } from './icons';
import MessageList from './MessageList';
import InputArea from './InputArea';

const ChatArea = ({ conversation, onSend, isSidebarOpen, toggleSidebar, isWaiting }) => {
  const [input, setInput] = useState('');

  if (!conversation) return <div className="chat-area empty">Select a conversation</div>;

  return (
    <div className="chat-area">
      <div className="chat-header">
        <button onClick={toggleSidebar} className="menu-btn">
          <IconMenu />
        </button>
        <h2>{conversation.title || 'Chat'}</h2>
      </div>
      <MessageList messages={conversation.messages || []} isWaiting={isWaiting} />
      <InputArea
        input={input}
        setInput={setInput}
        onSend={onSend}
        isWaiting={isWaiting}
      />
    </div>
  );
};

export default ChatArea;