import React from 'react';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  leagues: string[];
  selectedLeague: string;
  onLeagueChange: (league: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  isOpen, 
  onClose, 
  leagues, 
  selectedLeague, 
  onLeagueChange 
}) => {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-menu" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose}>
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
            >
              {leagues.map((league) => (
                <option key={league} value={league}>
                  {league}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
