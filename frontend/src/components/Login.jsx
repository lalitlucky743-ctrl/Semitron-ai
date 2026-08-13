import React, { useState } from 'react';
import { LOGO_URL } from '../utils/constants';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://semitron-ai.onrender.com';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },

          body: new URLSearchParams({
            username: username.trim(),
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail ||
            'Invalid username or password'
        );
        return;
      }

      if (!data.access_token) {
        setError(
          'Login failed: authentication token not received'
        );
        return;
      }

      onLogin(data.access_token);
    } catch (err) {
      console.error('Login error:', err);

      setError(
        'Network error. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">

        {/* Logo */}
        <div className="auth-logo">
          <img
            src={LOGO_URL}
            alt="Semitron Logo"
          />
        </div>

        {/* Heading */}
        <h2>Welcome back</h2>

        <p className="auth-subtitle">
          Sign in to your account
        </p>

        {/* Error */}
        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>

          {/* Username */}
          <div className="form-group">
            <label htmlFor="login-username">
              Username
            </label>

            <input
              id="login-username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              maxLength={72}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading
              ? 'Signing in...'
              : 'Sign In'}
          </button>

        </form>

        {/* Register */}
        <div className="auth-footer">
          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            className="link-btn"
            onClick={onSwitchToRegister}
            disabled={loading}
          >
            Create one
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;