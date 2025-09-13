import { StashedItem, PricingData } from '../types';
import { fetch } from '@tauri-apps/plugin-http';

const POE2HELPER_BASE = 'https://poe2helper.com/api';
const LEAGUE = 'Rise%20of%20the%20Abyssal';

export class Poe2HelperApi {
  /**
   * Convert a StashedItem to item description format for poe2helper
   */
  static convertItemToDescription(item: StashedItem): string {
    let description = `Item Class: ${item.type}\n`;
    description += `Rarity: ${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}\n`;
    
    if (item.name && item.name !== item.type) {
      description += `${item.name}\n`;
    }
    description += `${item.type}\n`;
    description += `--------\n`;
    
    // Add item level
    description += `Item Level: ${item.level}\n`;
    description += `--------\n`;
    
    // Add stats
    item.stats.forEach(stat => {
      description += `${stat.name}\n`;
    });
    
    description += `--------\n`;
    
    return description;
  }

  /**
   * Parse item description with poe2helper API
   */
  static async parseItemDescription(item: StashedItem): Promise<any> {
    const itemDescription = this.convertItemToDescription(item);
    
    const response = await fetch(`${POE2HELPER_BASE}/price-check/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Host': 'poe2helper.com'
      },
      body: JSON.stringify({
        item_description: itemDescription
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to parse item: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Search for pricing data using parsed item data
   */
  static async searchPricing(parsedData: any): Promise<any> {
    // Create the search payload with 20% variance for min/max values
    const searchPayload = {
      league: LEAGUE,
      body: JSON.stringify({
        query: {
          status: { option: "securable" },
          stats: parsedData.stats || [],
          filters: parsedData.filters || {}
        },
        sort: { price: "asc" }
      })
    };

    const response = await fetch(`${POE2HELPER_BASE}/price-check/search-web`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'POE2-Stash-Pricing-Tool/1.0'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      throw new Error(`Failed to search pricing: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get pricing data for a single item
   */
  static async getItemPricing(item: StashedItem): Promise<PricingData | null> {
    try {
      console.log(`Parsing item: ${item.name}`);
      
      // Step 1: Parse item description
      const parsedData = await this.parseItemDescription(item);
      
      // Step 2: Search for pricing data
      const searchResults = await this.searchPricing(parsedData);
      
      // Step 3: Extract price from first result
      if (searchResults.result && searchResults.result.length > 0) {
        const firstResult = searchResults.result[0];
        const listing = firstResult.listing;
        
        if (listing && listing.price) {
          const price = listing.price;
          return {
            itemId: item.id,
            estimatedValue: parseFloat(price.amount || '0'),
            currency: price.currency || 'chaos',
            confidence: 0.8 // Default confidence for real pricing data
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting pricing for item ${item.name}:`, error);
      return null;
    }
  }

  /**
   * Get pricing data for multiple items with rate limiting
   */
  static async getItemsPricing(items: StashedItem[]): Promise<PricingData[]> {
    const pricingData: PricingData[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`Getting pricing for item ${i + 1}/${items.length}: ${item.name}`);
      
      try {
        const pricing = await this.getItemPricing(item);
        if (pricing) {
          pricingData.push(pricing);
        }
      } catch (error) {
        console.error(`Failed to get pricing for item ${item.name}:`, error);
      }
      
      // Add 3 second delay between requests (except for the last item)
      if (i < items.length - 1) {
        console.log('Waiting 3 seconds to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    return pricingData;
  }

  // Add this debugging method to see what's actually happening
  static async debugApiAccess(): Promise<void> {
    try {
      // Test basic connectivity
      const response = await fetch('https://poe2helper.com/api/price-check/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0'
        },
        body: JSON.stringify({
          item_description: "Item Class: Test\nRarity: Normal\nTest Item\n--------\nItem Level: 1\n--------\n--------\n"
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
  }
}
