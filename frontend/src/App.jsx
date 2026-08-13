import React, { useState, useEffect, useCallback, useRef } from 'react';

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
// API
// =========================================================

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://semitron-ai.onrender.com';


// =========================================================
// FETCH WITH TIMEOUT
// =========================================================

const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timer);
  }
};


// =========================================================
// HELPERS
// =========================================================

const uid = () => {
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
};

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
  // REFS
  // =======================================================

  const initializedTokenRef = useRef(null);

  const loadingRef = useRef(false);


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

  const createNewConversation = useCallback(async () => {

    if (!token) {
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

      if (response.status === 401) {

        console.log(
          'Token expired while creating conversation'
        );

        setToken(null);

        return null;
      }

      if (!response.ok) {

        const errorData =
          await response.json().catch(() => ({}));

        console.error(
          'Create conversation failed:',
          errorData
        );

        return null;
      }

      const data = await response.json();

      const newConversation = {
        id: data.id,
        title: data.title || 'New Chat',
        messages: [],
      };

      setConversations((previous) => [
        newConversation,
        ...previous,
      ]);

      setActiveConversationId(
        newConversation.id
      );

      console.log(
        'New conversation created:',
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

  }, [token]);


  // =======================================================
  // LOAD CONVERSATIONS
  // IMPORTANT:
  // ONLY DEPENDS ON TOKEN
  // =======================================================

  useEffect(() => {

    if (!token) {

      console.log(
        'No token. Showing login screen.'
      );

      setConversations([]);
      setActiveConversationId(null);
      setIsLoading(false);

      initializedTokenRef.current = null;

      return;
    }


    // Prevent duplicate initialization
    if (
      initializedTokenRef.current === token
    ) {

      return;
    }


    // Prevent simultaneous loading
    if (loadingRef.current) {

      return;
    }


    initializedTokenRef.current = token;

    loadingRef.current = true;

    let cancelled = false;


    const loadConversations = async () => {

      console.log(
        'Loading conversations from:',
        API_BASE_URL
      );

      setIsLoading(true);


      try {

        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/conversations`,
          {
            method: 'GET',

            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );


        // -------------------------------------------------
        // TOKEN INVALID
        // -------------------------------------------------

        if (response.status === 401) {

          console.log(
            'Authentication failed.'
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

          throw new Error(
            `Server returned ${response.status}`
          );

        }


        const data = await response.json();


        if (cancelled) {
          return;
        }


        console.log(
          'Loaded conversations:',
          data.conversations
        );


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


        // -------------------------------------------------
        // EXISTING CONVERSATIONS
        // -------------------------------------------------

        if (loadedConversations.length > 0) {

          setConversations(
            loadedConversations
          );

          setActiveConversationId(
            loadedConversations[0].id
          );

        }

        // -------------------------------------------------
        // NO CONVERSATIONS
        // -------------------------------------------------

        else {

          console.log(
            'No conversations found. Creating first chat...'
          );


          const createResponse =
            await fetchWithTimeout(
              `${API_BASE_URL}/api/conversations?title=${encodeURIComponent(
                'New Chat'
              )}`,
              {
                method: 'POST',

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          if (!createResponse.ok) {

            throw new Error(
              `Could not create first conversation: ${createResponse.status}`
            );

          }


          const newData =
            await createResponse.json();


          const firstConversation = {
            id: newData.id,
            title:
              newData.title ||
              'New Chat',
            messages: [],
          };


          setConversations([
            firstConversation,
          ]);

          setActiveConversationId(
            firstConversation.id
          );


          console.log(
            'First conversation created:',
            firstConversation.id
          );

        }

      } catch (error) {

        if (!cancelled) {

          console.error(
            'Error loading conversations:',
            error
          );

          // Important:
          // Don't keep user stuck on loading screen.

          setConversations([]);

          setActiveConversationId(null);

        }

      } finally {

        if (!cancelled) {

          setIsLoading(false);

        }

        loadingRef.current = false;

      }

    };


    loadConversations();


    return () => {

      cancelled = true;

    };


  }, [token]);


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

      console.log(
        'Loading messages:',
        activeConversationId
      );


      try {

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


        if (response.status === 401) {

          setToken(null);

          return;

        }


        if (!response.ok) {

          throw new Error(
            `Failed to load messages: ${response.status}`
          );

        }


        const data =
          await response.json();


        if (cancelled) {
          return;
        }


        setConversations((previous) =>
          previous.map(
            (conversation) => {

              if (
                conversation.id !==
                activeConversationId
              ) {

                return conversation;

              }


              return {
                ...conversation,

                messages:
                  data.messages || [],
              };

            }
          )
        );


      } catch (error) {

        if (!cancelled) {

          console.error(
            'Error loading messages:',
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
  ]);


  // =======================================================
  // NEW CHAT
  // =======================================================

  const handleNewChat = async () => {

    await createNewConversation();

  };


  // =======================================================
  // SELECT CONVERSATION
  // =======================================================

  const handleSelectConversation = (
    conversationId
  ) => {

    setActiveConversationId(
      conversationId
    );

  };


  // =======================================================
  // DELETE CONVERSATION
  // =======================================================

  const deleteConversation = async (id) => {

    const remaining =
      conversations.filter(
        (conversation) =>
          conversation.id !== id
      );


    setConversations(
      remaining
    );


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

    if (
      !token ||
      !activeConversationId ||
      !content?.trim() ||
      isWaiting
    ) {

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


    setConversations((previous) =>
      previous.map(
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


      // ---------------------------------------------------
      // UNAUTHORIZED
      // ---------------------------------------------------

      if (response.status === 401) {

        setToken(null);

        return;

      }


      // ---------------------------------------------------
      // ERROR
      // ---------------------------------------------------

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


      const data =
        await response.json();


      console.log(
        'AI response:',
        data
      );


      // ---------------------------------------------------
      // ADD ASSISTANT MESSAGE
      // ---------------------------------------------------

      setConversations((previous) =>
        previous.map(
          (conversation) => {

            if (
              conversation.id !==
              data.conversation_id
            ) {

              return conversation;

            }


            return {

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

            };

          }
        )
      );


    } catch (error) {

      console.error(
        'Error sending message:',
        error
      );


      // Show error inside chat
      setConversations((previous) =>
        previous.map(
          (conversation) => {

            if (
              conversation.id !==
              activeConversationId
            ) {

              return conversation;

            }


            return {

              ...conversation,

              messages: [
                ...(conversation.messages || []),

                {
                  id: uid(),

                  role: 'assistant',

                  content:
                    `Sorry, something went wrong: ${
                      error.message
                    }`,
                },

              ],

            };

          }
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
      'Login successful'
    );


    // Reset initialization
    initializedTokenRef.current = null;

    loadingRef.current = false;


    setConversations([]);

    setActiveConversationId(null);

    setToken(newToken);

    setIsLoading(true);

  };


  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {

    initializedTokenRef.current = null;

    loadingRef.current = false;

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
  // AUTH
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
  // MAIN APP
  // =======================================================

  return (

    <div
      className={`app ${
        isDarkMode ? 'dark' : ''
      }`}
    >

      <Sidebar

        conversations={
          conversations
        }

        activeId={
          activeConversationId
        }

        onSelect={
          handleSelectConversation
        }

        onNew={
          handleNewChat
        }

        onDelete={
          deleteConversation
        }

        isOpen={
          isSidebarOpen
        }

        toggleSidebar={() =>
          setIsSidebarOpen(
            (previous) =>
              !previous
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
            (previous) =>
              !previous
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
            (previous) =>
              !previous
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