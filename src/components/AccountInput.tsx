import React, { useState } from 'react';
import './AccountInput.css';

interface AccountInputProps {
  onFetchItems: (accountName: string) => void;
  isLoading: boolean;
}

const AccountInput: React.FC<AccountInputProps> = ({ onFetchItems, isLoading }) => {
  const [accountName, setAccountName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountName.trim()) {
      onFetchItems(accountName.trim());
    }
  };

  return (
    <div className="account-input-container">
      <h2>Path of Exile 2 Stash Pricing Tool</h2>
      <form onSubmit={handleSubmit} className="account-form">
        <div className="input-group">
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Enter your POE2 account name..."
            className="account-input"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="fetch-button"
            disabled={isLoading || !accountName.trim()}
          >
            {isLoading ? 'Loading...' : 'Fetch Stash Items'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AccountInput;
