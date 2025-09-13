import { StashedItem, PricingData } from './types';
import { Poe2TradeApi } from './api/poe2TradeApi';

export const mockPricingData: PricingData[] = [
  { itemId: '1', estimatedValue: 15.5, currency: 'chaos', confidence: 0.85 },
  { itemId: '2', estimatedValue: 8.2, currency: 'chaos', confidence: 0.72 },
  { itemId: '3', estimatedValue: 45.0, currency: 'chaos', confidence: 0.91 },
  { itemId: '4', estimatedValue: 2.1, currency: 'chaos', confidence: 0.68 },
  { itemId: '5', estimatedValue: 0.5, currency: 'chaos', confidence: 0.95 }
];

// Real API function for fetching stashed items
export const fetchStashedItems = async (accountName: string): Promise<StashedItem[]> => {
  try {
    console.log(`Fetching real stashed items for account: ${accountName}`);
    const items = await Poe2TradeApi.fetchStashedItems(accountName);
    console.log(`Successfully fetched ${items.length} items from PoE2 API`);
    return items;
  } catch (error) {
    console.error('Error fetching items from PoE2 API:', error);
    // Fallback to empty array if API fails
    return [];
  }
};

// Mock API function for pricing data (keeping this mocked for now)
export const fetchPricingData = async (items: StashedItem[]): Promise<PricingData[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log(`Fetching pricing data for ${items.length} items (mocked)`);
  
  // Generate mock pricing data for the actual items
  const pricingData: PricingData[] = items.map((item) => ({
    itemId: item.id,
    estimatedValue: Math.random() * 50 + 1, // Random value between 1-51
    currency: 'chaos',
    confidence: Math.random() * 0.4 + 0.6 // Random confidence between 0.6-1.0
  }));
  
  return pricingData;
};
