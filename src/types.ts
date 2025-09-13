export interface ItemStat {
  name: string;
  value: string;
  type: 'explicit' | 'implicit' | 'crafted';
}

export interface StashedItem {
  id: string;
  name: string;
  type: string;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  level: number;
  stats: ItemStat[];
  estimatedValue?: number;
  currency?: string;
  icon?: string;
}

export interface PricingData {
  itemId: string;
  estimatedValue: number;
  currency: string;
  confidence: number;
}

// API Response Types
export interface TradeSearchRequest {
  query: {
    status: { option: string };
    stats: Array<{ type: string; filters: any[] }>;
    filters: {
      trade_filters: {
        filters: {
          account: { input: string };
          sale_type: { option: string };
        };
      };
    };
  };
  sort: { price: string };
}

export interface TradeSearchResponse {
  id: string;
  complexity: number;
  result: string[];
  total: number;
}

export interface TradeFetchItem {
  id: string;
  item: {
    name: string;
    typeLine: string;
    rarity: string;
    level: number;
    icon: string;
    explicitMods?: string[];
    implicitMods?: string[];
    craftedMods?: string[];
  };
}
