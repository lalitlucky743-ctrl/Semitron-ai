import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { CONNECTOR_LIST, PLUGIN_LIST, LOGO_URL } from './utils/constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import LoadingScreen from './components/LoadingScreen';
import Login from './components/Login';
import Register from './components/Register';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const STORAGE_KEY = 'conversations_v1';
const TOKEN_KEY = 'auth_token';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useLocalStorage(TOKEN_KEY, null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [selectedConnectors, setSelectedConnectors] = useState([]);
  const [selectedPlugins, setSelectedPlugins] = useState([]);
  const [showRegister, setShowRegister] = useState(false);

  // 👉 activeConversation ko component ke top par define karo
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Load conversations on login
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    const fetchConversations = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const convs = (data.conversations || []).map(c => ({ ...c, messages: [] }));
          setConversations(convs);
          if (convs.length > 0) {
            setActiveConversationId(convs[0].id);
          } else {
            createNewConversation();
          }
        } else {
          setToken(null);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, [token]);

  // Fetch messages when activeConversationId changes
  useEffect(() => {
    if (!token || !activeConversationId) return;
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/conversations/${activeConversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setConversations(prev =>
            prev.map(c =>
              c.id === activeConversationId ? { ...c, messages: data.messages } : c
            )
          );
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    fetchMessages();
  }, [token, activeConversationId]);

  const createNewConversation = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8000/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      if (response.ok) {
        const data = await response.json();
        const newConv = {
          id: data.id,
          title: data.title || 'New Chat',
          messages: [],
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        return newConv;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    return null;
  }, [token]);

  const deleteConversation = async (id) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        createNewConversation();
      }
    }
  };

  const sendMessage = async (content) => {
    if (!token || !activeConversation || isWaiting) return;
    setIsWaiting(true);
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, conversation_id: activeConversationId }),
      });
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      const data = await response.json();
      setConversations(prev =>
        prev.map(c =>
          c.id === data.conversation_id
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: uid(), role: 'user', content },
                  { id: uid(), role: 'assistant', content: data.reply },
                ],
              }
            : c
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsWaiting(false);
    }
  };

  const handleLogin = (newToken) => {
    setToken(newToken);
    setIsLoading(true);
  };

  const handleLogout = () => {
    setToken(null);
    setConversations([]);
    setActiveConversationId(null);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!token) {
    return showRegister ? (
      <Register
        onRegister={handleLogin}
        onSwitchToLogin={() => setShowRegister(false)}
      />
    ) : (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={createNewConversation}
        onDelete={deleteConversation}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        logo={LOGO_URL}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onLogout={handleLogout}
        connectors={CONNECTOR_LIST}
        plugins={PLUGIN_LIST}
        selectedConnectors={selectedConnectors}
        setSelectedConnectors={setSelectedConnectors}
        selectedPlugins={selectedPlugins}
        setSelectedPlugins={setSelectedPlugins}
      />
      <ChatArea
        conversation={activeConversation}
        onSend={sendMessage}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isWaiting={isWaiting}
      />
    </div>
  );
}

export default App;