import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  CONNECTOR_LIST,
  PLUGIN_LIST,
  LOGO_URL,
} from './utils/constants';

import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import LoadingScreen from './components/LoadingScreen';
import Login from './components/Login';
import Register from './components/Register';

// =========================================================
// API CONFIG
// =========================================================

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://semitron-ai.onrender.com';

// =========================================================
// HELPERS
// =========================================================

const uid = () =>
  Math.random().toString(36).slice(2) +
  Date.now().toString(36);

const TOKEN_KEY = 'auth_token';


// =========================================================
// APP
// =========================================================

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [token, setToken] = useLocalStorage(
    TOKEN_KEY,
    null
  );

  const [conversations, setConversations] = useState([]);

  const [activeConversationId, setActiveConversationId] =
    useState(null);

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true);

  const [isDarkMode, setIsDarkMode] =
    useState(false);

  const [isWaiting, setIsWaiting] =
    useState(false);

  const [selectedConnectors, setSelectedConnectors] =
    useState([]);

  const [selectedPlugins, setSelectedPlugins] =
    useState([]);

  const [showRegister, setShowRegister] =
    useState(false);


  // =======================================================
  // ACTIVE CONVERSATION
  // =======================================================

  const activeConversation = conversations.find(
    (conversation) =>
      conversation.id === activeConversationId
  );


  // =======================================================
  // CREATE NEW CONVERSATION
  // =======================================================

  const createNewConversation = useCallback(
    async () => {
      if (!token) return null;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/conversations?title=${encodeURIComponent(
            'New Chat'
          )}`,
          {
            method: 'POST',

            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({}));

          console.error(
            'Create conversation failed:',
            errorData
          );

          if (response.status === 401) {
            setToken(null);
          }

          return null;
        }

        const data = await response.json();

        const newConversation = {
          id: data.id,
          title: data.title || 'New Chat',
          messages: [],
        };

        setConversations((prev) => [
          newConversation,
          ...prev,
        ]);

        setActiveConversationId(
          newConversation.id
        );

        return newConversation;
      } catch (error) {
        console.error(
          'Error creating conversation:',
          error
        );

        return null;
      }
    },
    [token, setToken]
  );


  // =======================================================
  // LOAD CONVERSATIONS AFTER LOGIN
  // =======================================================

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setActiveConversationId(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchConversations = async () => {
      try {
        setIsLoading(true);

        const response = await fetch(
          `${API_BASE_URL}/api/conversations`,
          {
            method: 'GET',

            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          setToken(null);
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to load conversations: ${response.status}`
          );
        }

        const data = await response.json();

        if (cancelled) return;

        const loadedConversations = (
          data.conversations || []
        ).map((conversation) => ({
          ...conversation,
          messages: [],
        }));

        setConversations(
          loadedConversations
        );

        if (loadedConversations.length > 0) {
          setActiveConversationId(
            loadedConversations[0].id
          );
        } else {
          // Create first conversation
          await createNewConversation();
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Error loading conversations:',
            error
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchConversations();

    return () => {
      cancelled = true;
    };
  }, [token, createNewConversation, setToken]);


  // =======================================================
  // FETCH MESSAGES FOR ACTIVE CONVERSATION
  // =======================================================

  useEffect(() => {
    if (!token || !activeConversationId) {
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${activeConversationId}/messages`,
          {
            method: 'GET',

            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          setToken(null);
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to load messages: ${response.status}`
          );
        }

        const data = await response.json();

        if (cancelled) return;

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  messages: data.messages || [],
                }
              : conversation
          )
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Error fetching messages:',
            error
          );
        }
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    activeConversationId,
    setToken,
  ]);


  // =======================================================
  // DELETE CONVERSATION
  // =======================================================

  const deleteConversation = async (id) => {
    // NOTE:
    // Current backend does not have a DELETE endpoint.
    // So this removes the conversation from the UI only.

    setConversations((prev) =>
      prev.filter(
        (conversation) =>
          conversation.id !== id
      )
    );

    if (activeConversationId === id) {
      const remainingConversations =
        conversations.filter(
          (conversation) =>
            conversation.id !== id
        );

      if (remainingConversations.length > 0) {
        setActiveConversationId(
          remainingConversations[0].id
        );
      } else {
        setActiveConversationId(null);

        await createNewConversation();
      }
    }
  };


  // =======================================================
  // SEND MESSAGE
  // =======================================================

  const sendMessage = async (content) => {
    if (
      !token ||
      !activeConversation ||
      !content?.trim() ||
      isWaiting
    ) {
      return;
    }

    const messageContent = content.trim();

    setIsWaiting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            message: messageContent,
            conversation_id:
              activeConversationId,
          }),
        }
      );

      if (response.status === 401) {
        setToken(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.detail ||
            'Failed to get AI response'
        );
      }

      const data = await response.json();

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id ===
          data.conversation_id
            ? {
                ...conversation,

                messages: [
                  ...(conversation.messages || []),

                  {
                    id: uid(),
                    role: 'user',
                    content: messageContent,
                  },

                  {
                    id: uid(),
                    role: 'assistant',
                    content:
                      data.reply ||
                      'No response received.',
                  },
                ],
              }
            : conversation
        )
      );
    } catch (error) {
      console.error(
        'Error sending message:',
        error
      );
    } finally {
      setIsWaiting(false);
    }
  };


  // =======================================================
  // LOGIN
  // =======================================================

  const handleLogin = (newToken) => {
    setToken(newToken);

    setConversations([]);
    setActiveConversationId(null);

    setIsLoading(true);
  };


  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {
    setToken(null);

    setConversations([]);

    setActiveConversationId(null);

    setIsWaiting(false);
  };


  // =======================================================
  // LOADING SCREEN
  // =======================================================

  if (isLoading) {
    return <LoadingScreen />;
  }


  // =======================================================
  // AUTH SCREEN
  // =======================================================

  if (!token) {
    return showRegister ? (
      <Register
        onRegister={handleLogin}
        onSwitchToLogin={() =>
          setShowRegister(false)
        }
      />
    ) : (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() =>
          setShowRegister(true)
        }
      />
    );
  }


  // =======================================================
  // MAIN APP
  // =======================================================

  return (
    <div
      className={`app ${
        isDarkMode ? 'dark' : ''
      }`}
    >
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}

        onSelect={setActiveConversationId}

        onNew={createNewConversation}

        onDelete={deleteConversation}

        isOpen={isSidebarOpen}

        toggleSidebar={() =>
          setIsSidebarOpen(
            !isSidebarOpen
          )
        }

        logo={LOGO_URL}

        isDarkMode={isDarkMode}

        toggleDarkMode={() =>
          setIsDarkMode(!isDarkMode)
        }

        onLogout={handleLogout}

        connectors={CONNECTOR_LIST}

        plugins={PLUGIN_LIST}

        selectedConnectors={
          selectedConnectors
        }

        setSelectedConnectors={
          setSelectedConnectors
        }

        selectedPlugins={
          selectedPlugins
        }

        setSelectedPlugins={
          setSelectedPlugins
        }
      />

      <ChatArea
        conversation={activeConversation}

        onSend={sendMessage}

        isSidebarOpen={isSidebarOpen}

        toggleSidebar={() =>
          setIsSidebarOpen(
            !isSidebarOpen
          )
        }

        isWaiting={isWaiting}
      />
    </div>
  );
}

export default App;