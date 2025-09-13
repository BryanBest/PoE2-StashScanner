import { 
  TradeSearchRequest, 
  TradeSearchResponse, 
  TradeFetchItem, 
  StashedItem, 
  ItemStat,
  PricingData 
} from '../types';

import { fetch } from '@tauri-apps/plugin-http';
import { ModMappingService } from '../utils/modMapping';

const POE2_TRADE_API_BASE = 'https://www.pathofexile.com/api/trade2';
const LEAGUE = 'Rise%20of%20the%20Abyssal';

export class Poe2TradeApi {
  // Cache for item details to avoid re-fetching
  private static itemDetailsCache = new Map<string, StashedItem>();

  /**
   * Clear the item details cache (useful when switching accounts)
   */
  static clearCache(): void {
    this.itemDetailsCache.clear();
    console.log('Item details cache cleared');
  }

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
   * @param accountName - The account name to search for
   * @param existingItems - Optional array of existing items to avoid re-fetching
   */
  static async fetchStashedItems(accountName: string, existingItems: StashedItem[] = []): Promise<StashedItem[]> {
    try {
      console.log(`Searching for items for account: ${accountName}`);
      
      // Step 1: Search for items
      const searchResponse = await this.searchAccountItems(accountName);
      console.log(`Found ${searchResponse.total} items for account ${accountName}`);
      
      if (searchResponse.result.length === 0) {
        return [];
      }

      // Step 2: Filter out items we already have details for
      const existingItemIds = new Set(existingItems.map(item => item.id));
      const cachedItemIds = new Set(Array.from(this.itemDetailsCache.keys()));
      
      const itemsToFetch = searchResponse.result.filter(itemId => 
        !existingItemIds.has(itemId) && !cachedItemIds.has(itemId)
      );
      
      console.log(`Found ${itemsToFetch.length} new items to fetch (${searchResponse.result.length - itemsToFetch.length} already cached)`);
      
      let allStashedItems: StashedItem[] = [];
      
      // Step 3: Add existing items to result
      allStashedItems.push(...existingItems);
      
      // Step 4: Add cached items to result
      for (const itemId of searchResponse.result) {
        if (cachedItemIds.has(itemId) && !existingItemIds.has(itemId)) {
          const cachedItem = this.itemDetailsCache.get(itemId);
          if (cachedItem) {
            allStashedItems.push(cachedItem);
          }
        }
      }
      
      // Step 5: Fetch new items if any
      if (itemsToFetch.length > 0) {
        // Wait 1 second to avoid rate limits
        console.log('Waiting 1 second to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch detailed item data for new items
        console.log(`Fetching details for ${itemsToFetch.length} new items...`);
        const itemDetails = await this.fetchItemDetails(itemsToFetch);
        
        // Convert to our format and cache them
        const newStashedItems = itemDetails.map(item => {
          const stashedItem = this.convertApiItemToStashedItem(item);
          // Cache the item for future use
          this.itemDetailsCache.set(item.id, stashedItem);
          return stashedItem;
        });
        
        allStashedItems.push(...newStashedItems);
      }
      
      console.log(`Successfully processed ${allStashedItems.length} items (${itemsToFetch.length} newly fetched)`);
      return allStashedItems;
      
    } catch (error) {
      console.error('Error fetching stashed items:', error);
      throw error;
    }
  }

  /**
   * Extract numeric value from a mod string
   */
  static extractModValue(modText: string): number | null {
    // Look for numbers in the mod text, handling various formats like +15, 15%, (15-20), etc.
    const patterns = [
      /\+?(\d+(?:\.\d+)?)/,  // Basic numbers like +15, 15
      /(\d+(?:\.\d+)?)%/,    // Percentages like 15%
      /(\d+(?:\.\d+)?)-\d+/, // Ranges like 15-20 (take the first number)
    ];
    
    for (const pattern of patterns) {
      const match = modText.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return null;
  }

  /**
   * Map item type to trade filter category
   */
  static getItemCategory(item: StashedItem): string | null {
    const type = item.type.toLowerCase();
    
    // Weapon mappings
    if (type.includes('wand')) return 'weapon.wand';
    if (type.includes('crossbow')) return 'weapon.crossbow';
    if (type.includes('bow')) return 'weapon.bow';
    if (type.includes('quarterstaff') || type.includes('staff')) return 'weapon.warstaff';
    if (type.includes('sword') && type.includes('two')) return 'weapon.twosword';
    if (type.includes('sword')) return 'weapon.onesword';
    if (type.includes('axe') && type.includes('two')) return 'weapon.twoaxe';
    if (type.includes('axe')) return 'weapon.oneaxe';
    if (type.includes('mace') && type.includes('two')) return 'weapon.twomace';
    if (type.includes('mace')) return 'weapon.onemace';
    if (type.includes('dagger')) return 'weapon.dagger';
    if (type.includes('claw')) return 'weapon.claw';
    if (type.includes('spear')) return 'weapon.spear';
    if (type.includes('flail')) return 'weapon.flail';
    if (type.includes('sceptre')) return 'weapon.sceptre';
    
    // Armor mappings
    if (type.includes('helmet')) return 'armour.helmet';
    if (type.includes('chest') || type.includes('body')) return 'armour.chest';
    if (type.includes('gloves')) return 'armour.gloves';
    if (type.includes('boots')) return 'armour.boots';
    if (type.includes('shield')) return 'armour.shield';
    if (type.includes('quiver')) return 'armour.quiver';
    if (type.includes('focus')) return 'armour.focus';
    if (type.includes('buckler')) return 'armour.buckler';
    
    // Accessory mappings
    if (type.includes('amulet')) return 'accessory.amulet';
    if (type.includes('ring')) return 'accessory.ring';
    if (type.includes('belt')) return 'accessory.belt';
    
    // Default to null if no match
    return null;
  }

  /**
   * Search for similar items for pricing
   */
  static async searchSimilarItems(item: StashedItem): Promise<TradeSearchResponse> {
    // Initialize mod mappings if not already done
    await ModMappingService.initialize();
    
    const category = this.getItemCategory(item);
    const filters: any[] = [];
    
    // Add mod filters with 20% variance using actual mod IDs
    for (const stat of item.stats) {
      const value = this.extractModValue(stat.name);
      if (value !== null && value > 0) {
        // Find the actual mod ID from modMappings.json
        const modId = ModMappingService.findModId(stat.name, stat.type);
        
        if (modId) {
          const min = Math.max(0, Math.floor(value * 0.8));
          const max = Math.ceil(value * 1.2);
          
          filters.push({
            id: modId,
            value: { min, max },
            disabled: false
          });
          
          console.log(`🔍 Mapped mod "${stat.name}" to ID "${modId}" with range ${min}-${max}`);
        } else {
          console.warn(`⚠️ Could not find mod ID for: "${stat.name}" (${stat.type})`);
        }
      }
    }

    // Limit to 6 filters to avoid overly complex queries
    const limitedFilters = filters.slice(0, 6);

    const searchPayload = {
      query: {
        status: { option: "securable" },
        stats: [
          { type: "and", filters: [] },
          { filters: limitedFilters, type: "and" }
        ],
        filters: category ? {
          type_filters: {
            filters: {
              category: { option: category }
            }
          }
        } : {}
      },
      sort: { price: "asc" }
    };

    console.log(`🔍 Searching for similar items with ${limitedFilters.length} mod filters and category: ${category || 'none'}`);

    const response = await fetch(`${POE2_TRADE_API_BASE}/search/poe2/${LEAGUE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'POE2-Stash-Pricing-Tool/1.0'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      throw new Error(`Failed to search similar items: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get price for a single item by finding similar items
   */
  static async getItemPrice(item: StashedItem): Promise<{ price: number; currency: string } | null> {
    try {
      console.log(`🔍 Searching for similar items to price: ${item.name}`);
      
      // Search for similar items
      const searchResponse = await this.searchSimilarItems(item);
      
      if (searchResponse.result.length === 0) {
        console.log(`❌ No similar items found for: ${item.name}`);
        return null;
      }

      // Get details for the first (cheapest) item
      const firstItemDetails = await this.fetchItemDetails([searchResponse.result[0]]);
      
      if (firstItemDetails.length === 0) {
        console.log(`❌ Failed to get item details for: ${item.name}`);
        return null;
      }

      const firstItem = firstItemDetails[0];
      
      // Extract price from listing
      if (firstItem.listing && firstItem.listing.price && firstItem.listing.price.amount) {
        const price = firstItem.listing.price.amount;
        const currency = firstItem.listing.price.currency || 'chaos';
        console.log(`💰 Found price for ${item.name}: ${price} ${currency}`);
        return { price, currency };
      }

      console.log(`❌ No price found for: ${item.name}`);
      return null;
      
    } catch (error) {
      console.error(`Error pricing item ${item.name}:`, error);
      return null;
    }
  }

  /**
   * Get pricing data for multiple items with rate limiting
   */
  static async getPricingData(items: StashedItem[]): Promise<PricingData[]> {
    const pricingData: PricingData[] = [];
    
    console.log(`🏷️ Starting to price ${items.length} items...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        const priceResult = await this.getItemPrice(item);
        
        if (priceResult) {
          pricingData.push({
            itemId: item.id,
            estimatedValue: priceResult.price,
            currency: priceResult.currency,
            confidence: 0.75
          });
        } else {
          // No price found
          pricingData.push({
            itemId: item.id,
            estimatedValue: 0,
            currency: 'chaos',
            confidence: 0.1
          });
        }
        
        // Wait 3 seconds between requests (except for the last item)
        if (i < items.length - 1) {
          console.log(`⏱️ Waiting 3 seconds before next request... (${i + 1}/${items.length})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`Error pricing item ${item.name}:`, error);
        
        // Add fallback pricing data
        pricingData.push({
          itemId: item.id,
          estimatedValue: 0,
          currency: 'chaos',
          confidence: 0.1
        });
      }
    }
    
    console.log(`✅ Completed pricing ${items.length} items`);
    return pricingData;
  }

  /**
   * Get pricing data for multiple items with incremental updates via callback
   */
  static async getPricingDataIncremental(
    items: StashedItem[], 
    onItemPriced: (itemId: string, pricing: PricingData) => void
  ): Promise<void> {
    console.log(`🏷️ Starting to price ${items.length} items with incremental updates...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        const priceResult = await this.getItemPrice(item);
        
        let pricing: PricingData;
        if (priceResult) {
          pricing = {
            itemId: item.id,
            estimatedValue: priceResult.price,
            currency: priceResult.currency,
            confidence: 0.75
          };
        } else {
          // No price found
          pricing = {
            itemId: item.id,
            estimatedValue: 0,
            currency: 'chaos',
            confidence: 0.1
          };
        }
        
        // Notify the callback immediately
        onItemPriced(item.id, pricing);
        
        // Wait 3 seconds between requests (except for the last item)
        if (i < items.length - 1) {
          console.log(`⏱️ Waiting 3 seconds before next request... (${i + 1}/${items.length})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`Error pricing item ${item.name}:`, error);
        
        // Add fallback pricing data and notify callback
        const fallbackPricing: PricingData = {
          itemId: item.id,
          estimatedValue: 0,
          currency: 'chaos',
          confidence: 0.1
        };
        
        onItemPriced(item.id, fallbackPricing);
      }
    }
    
    console.log(`✅ Completed pricing ${items.length} items`);
  }
}