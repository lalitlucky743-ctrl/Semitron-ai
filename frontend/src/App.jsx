import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

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

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  'https://semitron-ai.onrender.com'
).replace(/\/$/, '');

const TOKEN_KEY = 'auth_token';


// =========================================================
// FETCH WITH TIMEOUT
// =========================================================

const fetchWithTimeout = async (
  url,
  options = {},
  timeout = 60000
) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Server is taking too long to respond. Render may be waking up.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};


// =========================================================
// UNIQUE MESSAGE ID
// =========================================================

const uid = () =>
  Math.random().toString(36).slice(2) +
  Date.now().toString(36);


// =========================================================
// APP
// =========================================================

function App() {

  // =======================================================
  // STATE
  // =======================================================

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

      if (!token) {
        console.warn(
          'Cannot create conversation: No token'
        );

        return null;
      }

      try {

        console.log(
          'Creating new conversation...'
        );

        const response = await fetchWithTimeout(
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

        // -------------------------------------------------
        // UNAUTHORIZED
        // -------------------------------------------------

        if (response.status === 401) {

          console.warn(
            'Token expired or invalid.'
          );

          setToken(null);
          setConversations([]);
          setActiveConversationId(null);

          return null;
        }


        // -------------------------------------------------
        // SERVER ERROR
        // -------------------------------------------------

        if (!response.ok) {

          const errorData =
            await response
              .json()
              .catch(() => ({}));

          console.error(
            'Create conversation failed:',
            errorData
          );

          throw new Error(
            errorData.detail ||
            `Server error: ${response.status}`
          );
        }


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        const data = await response.json();

        console.log(
          'Conversation created:',
          data
        );

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

    // -----------------------------------------------------
    // NO TOKEN
    // -----------------------------------------------------

    if (!token) {

      setConversations([]);
      setActiveConversationId(null);
      setIsLoading(false);

      return;
    }


    let cancelled = false;


    const loadConversations = async () => {

      try {

        console.log(
          'Loading conversations from:',
          API_BASE_URL
        );

        setIsLoading(true);


        // -------------------------------------------------
        // FETCH CONVERSATIONS
        // -------------------------------------------------

        const response =
          await fetchWithTimeout(
            `${API_BASE_URL}/api/conversations`,
            {
              method: 'GET',

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );


        // -------------------------------------------------
        // TOKEN INVALID
        // -------------------------------------------------

        if (response.status === 401) {

          console.warn(
            'Authentication expired.'
          );

          if (!cancelled) {

            setToken(null);
            setConversations([]);
            setActiveConversationId(null);

          }

          return;
        }


        // -------------------------------------------------
        // SERVER ERROR
        // -------------------------------------------------

        if (!response.ok) {

          const errorData =
            await response
              .json()
              .catch(() => ({}));

          throw new Error(
            errorData.detail ||
            `Server error: ${response.status}`
          );
        }


        // -------------------------------------------------
        // JSON
        // -------------------------------------------------

        const data =
          await response.json();


        if (cancelled) {
          return;
        }


        // -------------------------------------------------
        // CONVERSATIONS
        // -------------------------------------------------

        const loadedConversations =
          (data.conversations || []).map(
            (conversation) => ({
              id: conversation.id,
              title:
                conversation.title ||
                'New Chat',
              messages: [],
            })
          );


        console.log(
          'Loaded conversations:',
          loadedConversations
        );


        setConversations(
          loadedConversations
        );


        // -------------------------------------------------
        // EXISTING CHAT
        // -------------------------------------------------

        if (
          loadedConversations.length > 0
        ) {

          setActiveConversationId(
            loadedConversations[0].id
          );

        }

        // -------------------------------------------------
        // NO CHAT → CREATE FIRST CHAT
        // -------------------------------------------------

        else {

          console.log(
            'No conversations found. Creating first chat...'
          );

          await createNewConversation();
        }

      } catch (error) {

        if (!cancelled) {

          console.error(
            'Error loading conversations:',
            error
          );

          /*
           * IMPORTANT:
           * Don't keep the user stuck on loading screen.
           */

          setConversations([]);
          setActiveConversationId(null);
        }

      } finally {

        if (!cancelled) {

          setIsLoading(false);

        }
      }
    };


    loadConversations();


    return () => {

      cancelled = true;

    };

  }, [
    token,
    createNewConversation,
    setToken,
  ]);


  // =======================================================
  // LOAD MESSAGES
  // =======================================================

  useEffect(() => {

    if (
      !token ||
      !activeConversationId
    ) {
      return;
    }


    let cancelled = false;


    const loadMessages = async () => {

      try {

        console.log(
          'Loading messages:',
          activeConversationId
        );


        const response =
          await fetchWithTimeout(
            `${API_BASE_URL}/api/conversations/${activeConversationId}/messages`,
            {
              method: 'GET',

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );


        // -------------------------------------------------
        // UNAUTHORIZED
        // -------------------------------------------------

        if (response.status === 401) {

          if (!cancelled) {

            setToken(null);
            setConversations([]);
            setActiveConversationId(null);

          }

          return;
        }


        // -------------------------------------------------
        // ERROR
        // -------------------------------------------------

        if (!response.ok) {

          const errorData =
            await response
              .json()
              .catch(() => ({}));

          throw new Error(
            errorData.detail ||
            `Server error: ${response.status}`
          );
        }


        const data =
          await response.json();


        if (cancelled) {
          return;
        }


        // -------------------------------------------------
        // UPDATE ACTIVE CHAT
        // -------------------------------------------------

        setConversations((prev) =>
          prev.map(
            (conversation) =>
              conversation.id ===
              activeConversationId
                ? {
                    ...conversation,
                    messages:
                      data.messages || [],
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


    loadMessages();


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

    console.log(
      'Deleting conversation from UI:',
      id
    );


    // -----------------------------------------------------
    // BACKEND CURRENTLY DOES NOT HAVE DELETE ENDPOINT
    // -----------------------------------------------------

    const remaining =
      conversations.filter(
        (conversation) =>
          conversation.id !== id
      );


    setConversations(remaining);


    // -----------------------------------------------------
    // DELETED ACTIVE CHAT
    // -----------------------------------------------------

    if (
      activeConversationId === id
    ) {

      if (remaining.length > 0) {

        setActiveConversationId(
          remaining[0].id
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

    // -----------------------------------------------------
    // VALIDATION
    // -----------------------------------------------------

    if (
      !token ||
      !activeConversation ||
      !content ||
      !content.trim() ||
      isWaiting
    ) {

      console.warn(
        'Message blocked:',
        {
          hasToken: !!token,
          hasConversation:
            !!activeConversation,
          isWaiting,
        }
      );

      return;
    }


    const messageContent =
      content.trim();


    setIsWaiting(true);


    // -----------------------------------------------------
    // SHOW USER MESSAGE IMMEDIATELY
    // -----------------------------------------------------

    const temporaryUserMessage = {
      id: uid(),
      role: 'user',
      content: messageContent,
    };


    setConversations((prev) =>
      prev.map(
        (conversation) =>
          conversation.id ===
          activeConversationId
            ? {
                ...conversation,
                messages: [
                  ...(conversation.messages || []),
                  temporaryUserMessage,
                ],
              }
            : conversation
      )
    );


    try {

      console.log(
        'Sending message to:',
        `${API_BASE_URL}/api/chat`
      );


      // -------------------------------------------------
      // API CALL
      // -------------------------------------------------

      const response =
        await fetchWithTimeout(
          `${API_BASE_URL}/api/chat`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              message: messageContent,
              conversation_id:
                activeConversationId,
            }),
          }
        );


      // -------------------------------------------------
      // TOKEN EXPIRED
      // -------------------------------------------------

      if (response.status === 401) {

        console.warn(
          'Authentication expired.'
        );

        setToken(null);
        setConversations([]);
        setActiveConversationId(null);

        return;
      }


      // -------------------------------------------------
      // ERROR
      // -------------------------------------------------

      if (!response.ok) {

        const errorData =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          errorData.detail ||
          `AI request failed: ${response.status}`
        );
      }


      // -------------------------------------------------
      // SUCCESS
      // -----------------------------------------------------

      const data =
        await response.json();


      console.log(
        'AI response:',
        data
      );


      // -------------------------------------------------
      // ADD ASSISTANT RESPONSE
      // -----------------------------------------------------

      setConversations((prev) =>
        prev.map(
          (conversation) =>
            conversation.id ===
            data.conversation_id
              ? {
                  ...conversation,

                  messages: [
                    ...(conversation.messages || []),

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


      // -------------------------------------------------
      // SHOW ERROR IN CHAT
      // -----------------------------------------------------

      setConversations((prev) =>
        prev.map(
          (conversation) =>
            conversation.id ===
            activeConversationId
              ? {
                  ...conversation,

                  messages: [
                    ...(conversation.messages || []),

                    {
                      id: uid(),
                      role: 'assistant',
                      content:
                        `⚠️ ${error.message || 'Unable to connect to Semitron AI.'}`,
                    },
                  ],
                }
              : conversation
        )
      );

    } finally {

      setIsWaiting(false);

    }
  };


  // =======================================================
  // LOGIN
  // =======================================================

  const handleLogin = (newToken) => {

    console.log(
      'Login successful.'
    );

    setToken(newToken);

    setConversations([]);

    setActiveConversationId(null);

    setIsLoading(true);
  };


  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {

    console.log(
      'Logging out...'
    );

    setToken(null);

    setConversations([]);

    setActiveConversationId(null);

    setIsWaiting(false);
  };


  // =======================================================
  // LOADING
  // =======================================================

  if (isLoading) {

    return <LoadingScreen />;

  }


  // =======================================================
  // LOGIN / REGISTER
  // =======================================================

  if (!token) {

    if (showRegister) {

      return (
        <Register
          onRegister={handleLogin}
          onSwitchToLogin={() =>
            setShowRegister(false)
          }
        />
      );

    }


    return (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() =>
          setShowRegister(true)
        }
      />
    );

  }


  // =======================================================
  // MAIN APPLICATION
  // =======================================================

  return (
    <div
      className={`app ${
        isDarkMode ? 'dark' : ''
      }`}
    >

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar

        conversations={
          conversations
        }

        activeId={
          activeConversationId
        }

        onSelect={
          setActiveConversationId
        }

        onNew={
          createNewConversation
        }

        onDelete={
          deleteConversation
        }

        isOpen={
          isSidebarOpen
        }

        toggleSidebar={() =>
          setIsSidebarOpen(
            (prev) => !prev
          )
        }

        logo={
          LOGO_URL
        }

        isDarkMode={
          isDarkMode
        }

        toggleDarkMode={() =>
          setIsDarkMode(
            (prev) => !prev
          )
        }

        onLogout={
          handleLogout
        }

        connectors={
          CONNECTOR_LIST
        }

        plugins={
          PLUGIN_LIST
        }

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


      {/* =================================================
          CHAT AREA
      ================================================= */}

      <ChatArea

        conversation={
          activeConversation
        }

        onSend={
          sendMessage
        }

        isSidebarOpen={
          isSidebarOpen
        }

        toggleSidebar={() =>
          setIsSidebarOpen(
            (prev) => !prev
          )
        }

        isWaiting={
          isWaiting
        }

      />

    </div>
  );
}


export default App;