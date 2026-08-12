import React, { useRef } from 'react';
import { IconSend, IconPaperclip, IconImage, IconPlug, IconGrid } from './icons';

const InputArea = ({ input, setInput, onSend, isWaiting }) => {
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (input.trim() === '' || isWaiting) return;
    onSend(input);
    setInput(''); // ✅ यह line जोड़ो
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`Selected file: ${file.name}`);
    }
    e.target.value = '';
  };

  return (
    <div className="input-area">
      <div className="input-container">
        <button className="attach-btn" onClick={handleFileClick}>
          <IconPaperclip />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows="1"
          disabled={isWaiting}
        />
        <button className="send-btn" onClick={handleSend} disabled={isWaiting}>
          <IconSend />
        </button>
      </div>
      <div className="input-tools">
        <button onClick={handleFileClick}><IconImage /></button>
        <button><IconPlug /></button>
        <button><IconGrid /></button>
      </div>
    </div>
  );
};

export default InputArea;