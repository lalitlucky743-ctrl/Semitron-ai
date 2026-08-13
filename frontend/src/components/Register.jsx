import React, { useState } from 'react';
import { LOGO_URL } from '../utils/constants';

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch =
    password === confirmPassword && password.length > 0;
  const hasValidLength = password.length <= 72;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!hasMinLength || !hasUpperCase || !hasNumber) {
      setError('Password does not meet requirements');
      return;
    }

    if (!hasValidLength) {
      setError('Password must be 72 characters or less');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        'https://semitron-ai.onrender.com/api/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Registration failed');
        return;
      }

      onRegister(data.access_token);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">

        <div className="auth-logo">
          <img src={LOGO_URL} alt="Logo" />
        </div>

        <h2>Create account</h2>

        <p className="auth-subtitle">
          Start your journey with AI Assistant
        </p>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Username */}
          <div className="form-group">
            <label>Username</label>

            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
              required
              disabled={loading}
            />

            <div className="password-requirements">

              <div
                className={`req-item ${
                  hasMinLength ? 'valid' : ''
                }`}
              >
                <span className="req-icon">
                  {hasMinLength ? '✓' : '○'}
                </span>

                <span>At least 8 characters</span>
              </div>

              <div
                className={`req-item ${
                  hasUpperCase ? 'valid' : ''
                }`}
              >
                <span className="req-icon">
                  {hasUpperCase ? '✓' : '○'}
                </span>

                <span>One uppercase letter</span>
              </div>

              <div
                className={`req-item ${
                  hasNumber ? 'valid' : ''
                }`}
              >
                <span className="req-icon">
                  {hasNumber ? '✓' : '○'}
                </span>

                <span>One number</span>
              </div>

              <div
                className={`req-item ${
                  hasValidLength ? 'valid' : ''
                }`}
              >
                <span className="req-icon">
                  {hasValidLength ? '✓' : '○'}
                </span>

                <span>Maximum 72 characters</span>
              </div>

            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm Password</label>

            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              maxLength={72}
              autoComplete="new-password"
              required
              disabled={loading}
            />

            {confirmPassword.length > 0 && (
              <div
                className={`confirm-status ${
                  passwordsMatch ? 'valid' : 'invalid'
                }`}
              >
                {passwordsMatch
                  ? '✓ Passwords match'
                  : '✗ Passwords do not match'}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading
              ? 'Creating account...'
              : 'Create Account'}
          </button>

        </form>

        {/* Footer */}
        <div className="auth-footer">
          <span>Already have an account?</span>

          <button
            type="button"
            className="link-btn"
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Sign in
          </button>
        </div>

      </div>
    </div>
  );
};

export default Register;