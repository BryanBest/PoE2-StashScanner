// Mod mapping utility to match item mod text to PoE2 trade API mod IDs

export interface ModMapping {
  id: string;
  text: string;
  type: string;
}

export class ModMappingService {
  private static modMappings: ModMapping[] = [];
  private static initialized = false;

  /**
   * Initialize the mod mappings from the JSON file
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch('/modMappings.json');
      const data = await response.json();
      
      // Flatten the nested structure - the JSON contains arrays of entries
      this.modMappings = [];
      for (const category of data) {
        if (category.entries && Array.isArray(category.entries)) {
          this.modMappings.push(...category.entries);
        }
      }
      
      this.initialized = true;
      console.log(`Loaded ${this.modMappings.length} mod mappings`);
    } catch (error) {
      console.error('Failed to load mod mappings:', error);
      this.modMappings = [];
    }
  }

  /**
   * Find the mod ID for a given mod text
   */
  static findModId(modText: string, modType: 'explicit' | 'implicit' | 'crafted' = 'explicit'): string | null {
    if (!this.initialized) {
      console.warn('Mod mappings not initialized');
      return null;
    }

    // Clean the input mod text for comparison
    const cleanInputText = this.cleanModText(modText);
    console.log(`🔍 Looking for mod ID for: "${modText}" -> cleaned: "${cleanInputText}"`);
    
    // Find exact match first
    for (const mapping of this.modMappings) {
      const cleanMappingText = this.cleanModText(mapping.text);
      if (mapping.type === modType && cleanMappingText === cleanInputText) {
        console.log(`✅ Exact match found: "${mapping.text}" -> ID: "${mapping.id}"`);
        return mapping.id;
      }
    }

    // Find partial match if exact match fails
    for (const mapping of this.modMappings) {
      const cleanMappingText = this.cleanModText(mapping.text);
      if (mapping.type === modType && this.isModTextMatch(cleanInputText, cleanMappingText)) {
        console.log(`✅ Partial match found: "${mapping.text}" -> ID: "${mapping.id}"`);
        return mapping.id;
      }
    }

    console.log(`❌ No match found for: "${modText}"`);
    return null;
  }

  /**
   * Clean mod text for comparison by removing variable parts
   */
  private static cleanModText(text: string): string {
    return text
      .replace(/\d+/g, '#') // Replace numbers with #
      .replace(/\[([^\]]*\|[^\]]*)\]/g, (_match, content) => {
        // Handle [term1|term2] format - use the last term after |
        const parts = content.split('|');
        return parts[parts.length - 1].trim();
      })
      .replace(/\[([^\]]*)\]/g, '$1') // Remove remaining brackets [term] -> term
      .replace(/[+\-%()]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Check if two mod texts match (handles variations)
   */
  private static isModTextMatch(text1: string, text2: string): boolean {
    // Split into words and check if most words match
    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const matchingWords = words1.filter(word => words2.includes(word));
    const matchRatio = matchingWords.length / Math.max(words1.length, words2.length);
    
    return matchRatio >= 0.7; // 70% word match threshold
  }

  /**
   * Get all mod mappings for debugging
   */
  static getModMappings(): ModMapping[] {
    return [...this.modMappings];
  }

  /**
   * Test the mod text cleaning logic
   */
  static testModTextCleaning(): void {
    const testCases = [
      "96% increased [ElementalDamage|Elemental] Damage with [Attack|Attacks]",
      "37% increased [Physical] Damage",
      "+84 to [Accuracy|Accuracy] Rating",
      "30% reduced [Attributes|Attribute] Requirements"
    ];

    console.log("🧪 Testing mod text cleaning:");
    testCases.forEach(testCase => {
      const cleaned = this.cleanModText(testCase);
      console.log(`"${testCase}" -> "${cleaned}"`);
    });
  }
}
