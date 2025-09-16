import React from 'react';
import './ErrorPopup.css';

interface ErrorPopupProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="error-popup-overlay" onClick={onClose}>
      <div className="error-popup" onClick={(e) => e.stopPropagation()}>
        <div className="error-popup-header">
          <h3>⚠️ API Error</h3>
          <button className="error-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="error-popup-content">
          <p>{message}</p>
          <p className="error-popup-hint">
            Fetching and pricing have been stopped. Please try again later.
          </p>
        </div>
        <div className="error-popup-footer">
          <button className="error-popup-button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorPopup;
