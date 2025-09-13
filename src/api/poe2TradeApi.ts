import { 
  TradeSearchRequest, 
  TradeSearchResponse, 
  TradeFetchItem, 
  StashedItem, 
  ItemStat 
} from '../types';

import { fetch } from '@tauri-apps/plugin-http';

const POE2_TRADE_API_BASE = 'https://www.pathofexile.com/api/trade2';
const LEAGUE = 'Rise%20of%20the%20Abyssal';

export class Poe2TradeApi {
  /**
   * Search for items by account name using Tauri's HTTP plugin
   */
  static async searchAccountItems(accountName: string): Promise<TradeSearchResponse> {
    const searchPayload: TradeSearchRequest = {
      query: {
        status: { option: "any" },
        stats: [{ type: "and", filters: [] }],
        filters: {
          trade_filters: {
            filters: {
              account: { input: accountName },
              sale_type: { option: "unpriced" }
            }
          }
        }
      },
      sort: { price: "asc" }
    };

    // Use Tauri's HTTP API to bypass CORS
    const response = await fetch(`${POE2_TRADE_API_BASE}/search/poe2/${LEAGUE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'POE2-Stash-Pricing-Tool/1.0'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      throw new Error(`Failed to search items: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch detailed item data using item IDs with Tauri's HTTP plugin
   */
  static async fetchItemDetails(itemIds: string[]): Promise<TradeFetchItem[]> {
    if (itemIds.length === 0) {
      return [];
    }

    // Join item IDs with commas for the API
    const idsParam = itemIds.join(',');
    
    // Use Tauri's HTTP API to bypass CORS
    const response = await fetch(`${POE2_TRADE_API_BASE}/fetch/${idsParam}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'POE2-Stash-Pricing-Tool/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch item details: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract the result array from the response
    return data.result || [];
  }

  /**
   * Convert API item data to our StashedItem format
   */
  static convertApiItemToStashedItem(apiItem: any): StashedItem {
    const item = apiItem.item; // The actual item data is under 'item' property
    
    // Parse stats from the API response
    const stats: ItemStat[] = [];
    
    // Add explicit mods
    if (item.explicitMods) {
      item.explicitMods.forEach((mod: string) => {
        stats.push({
          name: mod,
          value: '',
          type: 'explicit'
        });
      });
    }
    
    // Add implicit mods (if any)
    if (item.implicitMods) {
      item.implicitMods.forEach((mod: string) => {
        stats.push({
          name: mod,
          value: '',
          type: 'implicit'
        });
      });
    }
    
    // Add crafted mods (if any)
    if (item.craftedMods) {
      item.craftedMods.forEach((mod: string) => {
        stats.push({
          name: mod,
          value: '',
          type: 'crafted'
        });
      });
    }

    // Determine rarity
    let rarity: 'normal' | 'magic' | 'rare' | 'unique' = 'normal';
    switch (item.rarity?.toLowerCase()) {
      case 'magic':
        rarity = 'magic';
        break;
      case 'rare':
        rarity = 'rare';
        break;
      case 'unique':
        rarity = 'unique';
        break;
      default:
        rarity = 'normal';
    }

    return {
      id: apiItem.id, // Use the top-level id
      name: item.name || item.typeLine || 'Unknown Item',
      type: item.typeLine || 'Unknown Type',
      rarity,
      level: item.ilvl || 1, // Use 'ilvl' instead of 'level'
      stats,
      icon: item.icon
    };
  }

  /**
   * Main function to fetch all stashed items for an account
   */
  static async fetchStashedItems(accountName: string): Promise<StashedItem[]> {
    try {
      console.log(`Searching for items for account: ${accountName}`);
      
      // Step 1: Search for items
      const searchResponse = await this.searchAccountItems(accountName);
      console.log(`Found ${searchResponse.total} items for account ${accountName}`);
      
      if (searchResponse.result.length === 0) {
        return [];
      }

      // Step 2: Wait 1 second to avoid rate limits
      console.log('Waiting 1 second to avoid rate limits...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Fetch detailed item data
      console.log(`Fetching details for ${searchResponse.result.length} items...`);
      const itemDetails = await this.fetchItemDetails(searchResponse.result);
      
      // Step 4: Convert to our format
      const stashedItems = itemDetails.map(item => this.convertApiItemToStashedItem(item));
      
      console.log(`Successfully processed ${stashedItems.length} items`);
      return stashedItems;
      
    } catch (error) {
      console.error('Error fetching stashed items:', error);
      throw error;
    }
  }
}