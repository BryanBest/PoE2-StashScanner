import React from 'react';
import { StashedItem } from '../types';
import './ItemCard.css';

interface ItemCardProps {
  item: StashedItem;
  convertToExalts: (value: number, currency: string) => { value: number; displayText: string };
}

const ItemCard: React.FC<ItemCardProps> = ({ item, convertToExalts }) => {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'unique': return '#af6025';
      case 'rare': return '#ffff77';
      case 'magic': return '#8888ff';
      case 'normal': return '#ffffff';
      default: return '#ffffff';
    }
  };

  const getStatTypeColor = (type: string) => {
    switch (type) {
      case 'explicit': return '#ffffff';
      case 'implicit': return '#88f';
      case 'crafted': return '#ffaa00';
      default: return '#ffffff';
    }
  };

  return (
    <div className="item-card" style={{ borderColor: getRarityColor(item.rarity) }}>
      <div className="item-header">
        <div className="item-title-row">
          {item.icon && (
            <img 
              src={item.icon} 
              alt={item.name}
              className="item-icon"
              onError={(e) => {
                // Hide icon if it fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="item-title-info">
            <h3 className="item-name" style={{ color: getRarityColor(item.rarity) }}>
              {item.name}
            </h3>
            <div className="item-meta">
              <span className="item-type">{item.type}</span>
              <span className="item-level">Level {item.level}</span>
              <span className="item-rarity">{item.rarity.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="item-stats">
        {item.stats.map((stat, index) => (
          <div key={index} className="stat-line">
            <span 
              className="stat-name" 
              style={{ color: getStatTypeColor(stat.type) }}
            >
              {stat.name}
            </span>
            <span className="stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="item-pricing">
        <div className="estimated-value">
          <span className="value-label">Estimated Value:</span>
          {item.isQueuedForPricing ? (
            <div className="pricing-spinner">
              <div className="spinner"></div>
              <span>Fetching price...</span>
            </div>
          ) : (
            <span 
              className="value-amount"
              style={{ 
                color: (item.estimatedValue && item.estimatedValue > 0) ? 'inherit' : '#ff4444' 
              }}
            >
              {item.estimatedValue && item.estimatedValue > 0 && item.currency
                ? convertToExalts(item.estimatedValue, item.currency).displayText
                : 'Value Unknown'
              }
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
