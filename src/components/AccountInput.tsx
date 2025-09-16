import React, { useState } from 'react';
import './AccountInput.css';

interface AccountInputProps {
  onFetchItems: (accountName: string) => void;
  isLoading: boolean;
  isLiveSearchEnabled: boolean;
  onLiveSearchToggle: (accountName: string) => void;
  countdownSeconds: number;
  isDisabled: boolean;
  isPricingInProgress: boolean;
}

const AccountInput: React.FC<AccountInputProps> = ({ 
  onFetchItems, 
  isLoading, 
  isLiveSearchEnabled, 
  onLiveSearchToggle, 
  countdownSeconds, 
  isDisabled,
  isPricingInProgress
}) => {
  const [accountName, setAccountName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountName.trim()) {
      onFetchItems(accountName.trim());
    }
  };

  return (
    <div className="account-input-container">
      <h2>StashScanner</h2>
      <form onSubmit={handleSubmit} className="account-form">
        <div className="input-group">
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Enter your POE2 account name..."
            className="account-input"
            disabled={isLoading || isDisabled}
          />
          <button 
            type="submit" 
            className="fetch-button"
            disabled={isLoading || !accountName.trim() || isDisabled}
          >
            {isLoading ? 'Loading...' : isPricingInProgress ? 'Pricing...' : 'Scan'}
          </button>
        </div>
        <div className="live-search-controls">
          <label className="live-search-toggle">
            <input
              type="checkbox"
              checked={isLiveSearchEnabled}
              onChange={() => {
                if (isLiveSearchEnabled) {
                  // Disabling live search - no account name needed
                  onLiveSearchToggle('');
                } else {
                  // Enabling live search - need account name
                  onLiveSearchToggle(accountName);
                }
              }}
              disabled={!accountName.trim() || isDisabled}
            />
            <span className="toggle-label">Live Scan</span>
          </label>
          {isPricingInProgress && (
            <div className="pricing-indicator">
              🔍 Pricing items...
            </div>
          )}
          {isLiveSearchEnabled && (
            <div className="countdown-display">
              Next fetch in: {countdownSeconds}s
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default AccountInput;
