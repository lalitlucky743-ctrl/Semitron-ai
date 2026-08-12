import React from 'react';
import { IconPlus, IconTrash, IconMenu, IconCheck } from './icons';

const Sidebar = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  toggleSidebar,
  logo,
  isDarkMode,
  toggleDarkMode,
  onLogout,
  connectors,
  plugins,
  selectedConnectors,
  setSelectedConnectors,
  selectedPlugins,
  setSelectedPlugins,
}) => {
  const toggleConnector = (id) => {
    setSelectedConnectors(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const togglePlugin = (id) => {
    setSelectedPlugins(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button onClick={toggleSidebar} className="menu-btn">
          <IconMenu />
        </button>
        <img src={logo} alt="Logo" className="logo" />
      </div>
      <button onClick={onNew} className="new-chat-btn">
        <IconPlus /> New Chat
      </button>
      <div className="conversation-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="conv-title">{conv.title || 'Untitled'}</span>
            <button
              className="delete-conv-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        {/* Connectors Section */}
        <div className="connectors-section">
          <h4>Connectors</h4>
          {connectors.map(c => (
            <div
              key={c.id}
              className={`connector-item ${selectedConnectors.includes(c.id) ? 'selected' : ''}`}
              onClick={() => toggleConnector(c.id)}
            >
              <i className={c.icon}></i>
              <span>{c.name}</span>
              {selectedConnectors.includes(c.id) && <IconCheck />}
            </div>
          ))}
        </div>
        {/* Plugins Section */}
        <div className="plugins-section">
          <h4>Plugins</h4>
          {plugins.map(p => (
            <div
              key={p.id}
              className={`plugin-item ${selectedPlugins.includes(p.id) ? 'selected' : ''}`}
              onClick={() => togglePlugin(p.id)}
            >
              <span>{p.name}</span>
              {selectedPlugins.includes(p.id) && <IconCheck />}
            </div>
          ))}
        </div>
        <div className="theme-toggle" onClick={toggleDarkMode}>
          {isDarkMode ? '☀️' : '🌙'}
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;