import React from 'react';
import { LOGO_URL } from '../utils/constants';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src={LOGO_URL} alt="Logo" className="loading-logo" />
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;