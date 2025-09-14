import React from 'react';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  leagues: string[];
  selectedLeague: string;
  onLeagueChange: (league: string) => void | Promise<void>;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  isDisabled?: boolean;
  // Interface updated with threshold support
}

const Settings: React.FC<SettingsProps> = ({ 
  isOpen, 
  onClose, 
  leagues, 
  selectedLeague, 
  onLeagueChange,
  threshold,
  onThresholdChange,
  isDisabled = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={isDisabled ? undefined : onClose}>
      <div className="settings-menu" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button 
            className="settings-close" 
            onClick={onClose}
            disabled={isDisabled}
          >
            ×
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-option">
            <label htmlFor="league-select">League:</label>
            <select
              id="league-select"
              value={selectedLeague}
              onChange={(e) => onLeagueChange(e.target.value)}
              className="league-dropdown"
              disabled={isDisabled}
            >
              {leagues.map((league) => (
                <option key={league} value={league}>
                  {league}
                </option>
              ))}
            </select>
          </div>
          
          <div className="settings-option">
            <label htmlFor="threshold-input">
              Threshold:
              <span className="tooltip" data-tooltip="Whenever an item is found to be equal to or greater than this many Exalts, a notification sound will play!">
                ℹ️
              </span>
            </label>
            <input
              id="threshold-input"
              type="number"
              min="1"
              max="1000"
              value={threshold}
              onChange={(e) => onThresholdChange(parseInt(e.target.value) || 10)}
              className="threshold-input"
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings component with threshold support
export default Settings;
