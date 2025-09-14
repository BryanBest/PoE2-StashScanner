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

export class Poe2TradeApi {
  private static currentLeague: string = 'Rise%20of%20the%20Abyssal';

  static setLeague(league: string): void {
    this.currentLeague = league;
    console.log('Poe2TradeApi league set to:', league);
  }

  static getLeague(): string {
    return this.currentLeague;
  }
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
   * Debug method to test mod mapping with custom data
   */
  static async debugModMapping(modText: string, itemType: string = "Jagged Spear"): Promise<void> {
    console.log(`🧪 Debug: Testing mod mapping for "${modText}" on item type "${itemType}"`);
    
    const shouldBeLocal = this.shouldModBeLocal(modText, itemType);
    const modTextWithLocal = shouldBeLocal ? `${modText} (local)` : modText;
    
    console.log(`Should be local: ${shouldBeLocal}`);
    console.log(`Mod text with local: "${modTextWithLocal}"`);
    
    // Test the mod mapping
    const { ModMappingService } = await import('../utils/modMapping');
    await ModMappingService.initialize();
    const modId = ModMappingService.findModId(modTextWithLocal, 'explicit');
    
    if (modId) {
      console.log(`✅ Found mod ID: ${modId}`);
    } else {
      console.log(`❌ No mod ID found`);
    }
  }

  /**
   * Debug method to test item pricing with custom data
   */
  static async debugItemPricing(itemData: any): Promise<void> {
    console.log(`🧪 Debug: Testing item pricing for:`, itemData);
    
    try {
      const result = await this.getItemPrice(itemData);
      console.log(`✅ Pricing result:`, result);
    } catch (error) {
      console.error(`❌ Pricing failed:`, error);
    }
  }

  /**
   * Debug method to test local mod detection
   */
  static debugLocalModDetection(modText: string, itemType: string): void {
    console.log(`🧪 Debug: Testing local mod detection`);
    console.log(`Mod text: "${modText}"`);
    console.log(`Item type: "${itemType}"`);
    
    const shouldBeLocal = this.shouldModBeLocal(modText, itemType);
    console.log(`Should be local: ${shouldBeLocal}`);
    
    if (shouldBeLocal) {
      console.log(`✅ This mod should be mapped to the local version`);
      console.log(`Note: Local version is likely a percentage increase, not a flat bonus`);
    } else {
      console.log(`ℹ️ This mod should be mapped to the global version`);
    }
  }

  /**
   * Debug method to test complete item flow: fetchItemDetails -> convertApiItemToStashedItem -> getItemPrice
   * @param itemId - Single item ID to debug
   */
  static async debugPricingAlgo(itemId: string): Promise<void> {
    console.log(`🧪 Debug: Testing complete item flow for item ID: ${itemId}`);
    
    try {
      // Step 1: Fetch item details from API
      console.log(`\n📡 Step 1: Fetching item details from API...`);
      const apiItems = await this.fetchItemDetails([itemId]);
      
      if (apiItems.length === 0) {
        console.log(`❌ No item found with ID: ${itemId}`);
        return;
      }
      
      const apiItem = apiItems[0];
      console.log(`✅ Fetched API item data:`, JSON.stringify(apiItem, null, 2));
      
      // Step 2: Convert to StashedItem format
      console.log(`\n📦 Step 2: Converting to StashedItem format...`);
      const stashedItem = this.convertApiItemToStashedItem(apiItem);
      console.log(`✅ Converted item:`, JSON.stringify(stashedItem, null, 2));
      
      // Step 3: Get pricing
      console.log(`\n💰 Step 3: Getting item pricing...`);
      const pricingResult = await this.getItemPrice(stashedItem);
      
      if (pricingResult) {
        console.log(`✅ Pricing successful:`, pricingResult);
        console.log(`💰 Item "${stashedItem.name}" is worth ${pricingResult.price} ${pricingResult.currency}`);
        
        // Step 4: Convert to exalts if possible
        console.log(`\n💎 Step 4: Converting to exalts...`);
        try {
          const convertToExalts = (window as any).convertToExalts;
          if (convertToExalts && typeof convertToExalts === 'function') {
            const exaltConversion = convertToExalts(pricingResult.price, pricingResult.currency);
            console.log(`✅ Exalt conversion: ${exaltConversion.displayText}`);
            console.log(`💎 Raw exalt value: ${exaltConversion.value}`);
          } else {
            console.log(`⚠️ Currency conversion function not available`);
          }
        } catch (error) {
          console.log(`❌ Error converting to exalts:`, error);
        }
      } else {
        console.log(`❌ No pricing found for item: ${stashedItem.name}`);
      }
      
      console.log(`\n🎯 Debug complete!`);
      
    } catch (error) {
      console.error(`❌ Error in item flow debug:`, error);
    }
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
    const response = await fetch(`${POE2_TRADE_API_BASE}/search/poe2/${this.currentLeague}`, {
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
   * Extract range values from a mod string (for "Adds X to Y Damage" type mods)
   * Returns { min: number, max: number } or null if no range found
   */
  static extractModRange(modText: string): { min: number; max: number } | null {
    // Look for "Adds X to Y" patterns
    const rangePattern = /adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i;
    const match = modText.match(rangePattern);
    
    if (match) {
      return {
        min: parseFloat(match[1]),
        max: parseFloat(match[2])
      };
    }
    
    return null;
  }

  /**
   * Determine if a mod should be local based on the item type and mod content
   */
  static shouldModBeLocal(modText: string, itemType: string): boolean {
    const type = itemType.toLowerCase();
    const mod = modText.toLowerCase();
    
    // Weapon-specific local mods
    if (type.includes('weapon') || type.includes('sword') || type.includes('axe') || 
        type.includes('mace') || type.includes('bow') || type.includes('crossbow') ||
        type.includes('wand') || type.includes('staff') || type.includes('spear') ||
        type.includes('dagger') || type.includes('claw') || type.includes('flail') ||
        type.includes('sceptre') || type.includes('quarterstaff')) {
      
      // Accuracy is local on weapons (flat bonus)
      if (mod.includes('accuracy') && mod.includes('rating') && mod.includes(' to ')) {
        return true;
      }
      
      // Attack speed is local on weapons (percentage increase)
      if (mod.includes('attack') && mod.includes('speed') && mod.includes('increased')) {
        return true;
      }
      
    }
    
    // Armor-specific local mods
    if (type.includes('armour') || type.includes('helmet') || type.includes('chest') ||
        type.includes('gloves') || type.includes('boots') || type.includes('shield')) {
      
      // Armor/evasion/energy shield values are local on armor (flat bonuses)
      if ((mod.includes('armour') || mod.includes('evasion') || mod.includes('energy shield')) && mod.includes(' to ')) {
        return true;
      }
      
      // Block chance is local on shields (percentage)
      if (type.includes('shield') && mod.includes('block') && mod.includes('increased')) {
        return true;
      }
    }
    
    // Accessory-specific local mods
    if (type.includes('ring') || type.includes('amulet') || type.includes('belt')) {
      // Most mods on accessories are global, but some specific ones might be local
      // This would need to be refined based on PoE2's specific rules
    }
    
    return false;
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
      // Check if this is a range-based mod (like "Adds X to Y Damage")
      const range = Poe2TradeApi.extractModRange(stat.name);
      
      if (range) {
        // Handle range-based mods: min should be 20% below first number, max should be 20% above second number
        const shouldBeLocal = this.shouldModBeLocal(stat.name, item.type);
        const modTextWithLocal = shouldBeLocal ? `${stat.name} (local)` : stat.name;
        const modId = ModMappingService.findModId(modTextWithLocal, stat.type);
        
        if (modId) {
          const min = Math.max(0, Math.floor(range.min * 0.8));
          const max = Math.ceil(range.max * 1.2);
          
          filters.push({
            id: modId,
            value: { min, max },
            disabled: false
          });
          
          console.log(`🔍 Mapped range mod "${stat.name}" to ID "${modId}" with range ${min}-${max} (original: ${range.min}-${range.max}) ${shouldBeLocal ? '(local)' : '(global)'}`);
        } else {
          console.warn(`⚠️ Could not find mod ID for range mod: "${stat.name}" (${stat.type})`);
        }
      } else {
        // Handle single-value mods
        const value = this.extractModValue(stat.name);
        if (value !== null && value > 0) {
          // Determine if this mod should be local based on item type and mod content
          const shouldBeLocal = this.shouldModBeLocal(stat.name, item.type);
          const modTextWithLocal = shouldBeLocal ? `${stat.name} (local)` : stat.name;
          
          // Find the actual mod ID from modMappings.json
          const modId = ModMappingService.findModId(modTextWithLocal, stat.type);
          
          if (modId) {
            const min = Math.max(0, Math.floor(value * 0.8));
            const max = Math.ceil(value * 1.2);
            
            filters.push({
              id: modId,
              value: { min, max },
              disabled: false
            });
            
            console.log(`🔍 Mapped mod "${stat.name}" to ID "${modId}" with range ${min}-${max} ${shouldBeLocal ? '(local)' : '(global)'}`);
          } else {
            console.warn(`⚠️ Could not find mod ID for: "${stat.name}" (${stat.type})`);
          }
        }
      }
    }

    // Use all available filters for better pricing accuracy
    const searchPayload = {
      query: {
        status: { option: "securable" },
        stats: [
          { type: "and", filters: [] },
          { filters: filters, type: "and" }
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

    console.log(`🔍 Searching for similar items with ${filters.length} mod filters and category: ${category || 'none'}`);
    if (filters.length > 0) {
      console.log('🔎 Mod filters being used:');
      filters.forEach(f => {
        if (f.value && typeof f.value === 'object' && f.value.min !== undefined && f.value.max !== undefined) {
          console.log(`  - id: ${f.id}, min: ${f.value.min}, max: ${f.value.max}, disabled: ${f.disabled}`);
        } else {
          console.log(`  - id: ${f.id}, value: ${JSON.stringify(f.value)}, disabled: ${f.disabled}`);
        }
      });
    }

    const response = await fetch(`${POE2_TRADE_API_BASE}/search/poe2/${this.currentLeague}`, {
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
    // Filter out items that already have pricing data
    const itemsToPrice = items.filter(item => 
      item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null
    );
    
    const alreadyPricedCount = items.length - itemsToPrice.length;
    console.log(`🏷️ Starting to price ${itemsToPrice.length} items with incremental updates...`);
    
    if (alreadyPricedCount > 0) {
      console.log(`⏭️ Skipping ${alreadyPricedCount} items that already have pricing data`);
    }
    
    for (let i = 0; i < itemsToPrice.length; i++) {
      const item = itemsToPrice[i];
      
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
        if (i < itemsToPrice.length - 1) {
          console.log(`⏱️ Waiting 3 seconds before next request... (${i + 1}/${itemsToPrice.length})`);
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
    
    console.log(`✅ Completed pricing ${itemsToPrice.length} items (${alreadyPricedCount} already had pricing data)`);
  }
}