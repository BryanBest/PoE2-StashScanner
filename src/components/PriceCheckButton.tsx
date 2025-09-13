import React from 'react';
import './PriceCheckButton.css';

interface PriceCheckButtonProps {
  onPriceCheck: () => void;
  isLoading: boolean;
  hasItems: boolean;
}

const PriceCheckButton: React.FC<PriceCheckButtonProps> = ({ 
  onPriceCheck, 
  isLoading, 
  hasItems 
}) => {
  if (!hasItems) {
    return null;
  }

  return (
    <div className="price-check-container">
      <button 
        onClick={onPriceCheck}
        className="price-check-button"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="loading-spinner"></span>
            Checking Prices...
          </>
        ) : (
          <>
            <span className="price-icon">💰</span>
            Price Check All Items
          </>
        )}
      </button>
    </div>
  );
};

export default PriceCheckButton;
