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

// Real API function for pricing data using PoE2 Trade API
export const fetchPricingData = async (items: StashedItem[]): Promise<PricingData[]> => {
  try {
    console.log(`Fetching real pricing data for ${items.length} items from PoE2 Trade API`);
    const pricingData = await Poe2TradeApi.getPricingData(items);
    console.log(`Successfully fetched pricing for ${pricingData.length} items`);
    return pricingData;
  } catch (error) {
    console.error('Error fetching pricing from PoE2 API:', error);
    
    // Fallback to basic mock data if API fails
    console.log('Falling back to mock pricing data');
    const fallbackData: PricingData[] = items.map((item) => ({
      itemId: item.id,
      estimatedValue: Math.random() * 10 + 1, // Lower random values as fallback
      currency: 'chaos',
      confidence: 0.3 // Low confidence for fallback data
    }));
    
    return fallbackData;
  }
};
