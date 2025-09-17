import { useState, useEffect, useRef } from "react";
import "./App.css";
import AccountInput from "./components/AccountInput";
import ItemCard from "./components/ItemCard";
import Settings from "./components/Settings";
import GearIcon from "./components/GearIcon";
import ErrorPopup from "./components/ErrorPopup";
import { StashedItem } from "./types";
import { fetchStashedItems, fetchPricingDataIncremental } from "./mockData";
import { Poe2TradeApi, ApiError } from "./api/poe2TradeApi";
import { Poe2HelperApi } from "./api/poe2HelperApi";

// Make APIs available globally for debugging
(window as any).Poe2TradeApi = Poe2TradeApi;
(window as any).Poe2HelperApi = Poe2HelperApi;

// Global currency values accessor (will be set inside component)
let globalCurrencyValues: Record<string, number> = {};
(window as any).getCurrencyValues = () => {
  return globalCurrencyValues;
};

// Global currency conversion function (will be set inside component)
let globalConvertToExalts: ((value: number, currency: string) => { value: number; displayText: string }) | null = null;
(window as any).convertToExalts = (value: number, currency: string) => {
  if (globalConvertToExalts) {
    return globalConvertToExalts(value, currency);
  }
  return { value, displayText: `${value} ${currency}` };
};

function App() {
  const [items, setItems] = useState<StashedItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [leagues, setLeagues] = useState<string[]>([]);
  const leaguesFetchedRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<string>("Rise of the Abyssal");
  const [currencyValues, setCurrencyValues] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState<number>(10);
  const [isLiveSearchEnabled, setIsLiveSearchEnabled] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isErrorPopupOpen, setIsErrorPopupOpen] = useState<boolean>(false);
  const [isPricingInProgress, setIsPricingInProgress] = useState<boolean>(false);
  const [isPricingCompleteForCurrentScan, setIsPricingCompleteForCurrentScan] = useState<boolean>(true);
  const [isFetchCompleteForCurrentScan, setIsFetchCompleteForCurrentScan] = useState<boolean>(true);
  const liveSearchIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const itemsRef = useRef<StashedItem[]>([]);

  // Fetch currency values using Poe2HelperApi
  const fetchCurrencyValues = async (league: string) => {
    try {
      const currencyDict = await Poe2HelperApi.fetchCurrencyValues(league);
      setCurrencyValues(currencyDict);
      globalCurrencyValues = currencyDict; // Update global accessor
      console.log('Currency values state updated:', Object.keys(currencyValues).length > 0 ? `${Object.keys(currencyValues).length} currencies` : 'Empty');
    } catch (error) {
      console.error('Error fetching currency values:', error);
      // Set empty object on error to prevent app from breaking
      setCurrencyValues({});
      globalCurrencyValues = {}; // Update global accessor
    }
  };

  // Helper function to check if a currency is exalt-type
  const isExaltCurrency = (currency: string): boolean => {
    if (!currency) return false;
    
    const lower = currency.toLowerCase().trim();
    // Check for various forms of exalt currency names
    return lower === 'exalted' || lower === 'exalt' || lower === 'exalted orb' || lower === 'exalts' || lower.includes('exalt');
  };

  // Helper function to find closest currency match
  const findClosestCurrencyMatch = (currency: string): string | null => {
    if (!currency || Object.keys(currencyValues).length === 0) {
      console.log(`Currency matching: No currency provided or no currency values available`);
      return null;
    }
    
    const normalized = currency.toLowerCase().trim();
    const availableCurrencies = Object.keys(currencyValues);
    
    console.log(`Currency matching: Looking for "${currency}" (normalized: "${normalized}")`);
    
    // First try exact match
    if (currencyValues[normalized]) {
      console.log(`Currency matching: Found exact match "${normalized}"`);
      return normalized;
    }
    
    // Try common abbreviation expansions first
    const commonExpansions: Record<string, string[]> = {
      'aug': ['orb-of-augmentation', 'augmentation', 'orb-augmentation'],
      'transmute': ['orb-of-transmutation', 'transmutation', 'orb-transmutation'],
      'chance': ['orb-of-chance', 'orb-chance'],
      'alchemy': ['orb-of-alchemy', 'orb-alchemy'],
      'ancient': ['ancient-orb', 'orb-ancient'],
      'binding': ['orb-of-binding', 'orb-binding'],
      'chaos': ['chaos-orb', 'orb-chaos'],
      'chromatic': ['chromatic-orb', 'orb-chromatic'],
      'divine': ['divine-orb', 'orb-divine'],
      'fusing': ['orb-of-fusing', 'fusing', 'orb-fusing'],
      'jeweller': ['jeweller-orb', 'orb-jeweller', 'orb-of-jewelling'],
      'regret': ['orb-of-regret', 'orb-regret'],
      'scouring': ['orb-of-scouring', 'orb-scouring'],
      'regal': ['regal-orb', 'orb-regal'],
      'exalt': ['exalted-orb', 'orb-exalted'],
      'vaal': ['vaal-orb', 'orb-vaal']
    };
    
    // Check if we have a common expansion for this currency
    if (commonExpansions[normalized]) {
      console.log(`Currency matching: Trying common expansions for "${normalized}": [${commonExpansions[normalized].join(', ')}]`);
      for (const expansion of commonExpansions[normalized]) {
        if (currencyValues[expansion]) {
          console.log(`Currency matching: Found expansion match "${expansion}"`);
          return expansion;
        }
      }
      console.log(`Currency matching: No expansion matches found`);
    }
    
    // Try finding by includes match, but prefer shorter matches
    const partialMatches = availableCurrencies.filter(key => 
      key.includes(normalized) || normalized.includes(key)
    );
    
    if (partialMatches.length > 0) {
      console.log(`Currency matching: Found ${partialMatches.length} partial matches: [${partialMatches.join(', ')}]`);
      
      // Sort by length (prefer shorter) and then by how well it matches
      partialMatches.sort((a, b) => {
        // Prefer matches that start with the normalized currency
        const aStartsWithNorm = a.startsWith(normalized);
        const bStartsWithNorm = b.startsWith(normalized);
        
        if (aStartsWithNorm && !bStartsWithNorm) return -1;
        if (!aStartsWithNorm && bStartsWithNorm) return 1;
        
        // Prefer shorter matches (less likely to be "perfect-" versions)
        return a.length - b.length;
      });
      
      console.log(`Currency matching: Best partial match after sorting: "${partialMatches[0]}"`);
      return partialMatches[0];
    }
    
    console.log(`Currency matching: No matches found for "${currency}"`);
    return null; // Remove fuzzy matching for now as it's too aggressive
  };

  // Convert any currency value to exalts
  const convertToExalts = (value: number, currency: string): { value: number; displayText: string } => {
    console.log(`ConvertToExalts called: value=${value}, currency="${currency}"`);
    
    // If already exalts, return as is
    if (isExaltCurrency(currency)) {
      console.log(`Currency "${currency}" is already exalt type, returning value=${value}`);
      return { 
        value: value, 
        displayText: `${value} Exalted${value !== 1 ? 's' : ''}` 
      };
    }

    // Try to find exact match first, then closest match
    const normalized = currency.toLowerCase().trim();
    let currencyRate = currencyValues[normalized] || currencyValues[currency];
    let matchedCurrency = normalized;
    
    console.log(`Direct lookup: "${normalized}" -> rate=${currencyRate}`);
    console.log(`Available currencies:`, Object.keys(currencyValues).slice(0, 10), '... (total:', Object.keys(currencyValues).length, ')');
    
    // If no direct match, try to find closest match
    if (!currencyRate) {
      const closestMatch = findClosestCurrencyMatch(currency);
      if (closestMatch) {
        currencyRate = currencyValues[closestMatch];
        matchedCurrency = closestMatch;
        console.log(`Using closest match: "${closestMatch}" -> rate=${currencyRate}`);
      }
    }
    
    if (!currencyRate) {
      // If we still don't have conversion data, show original value
      console.log(`No conversion rate found for "${currency}", returning original value`);
      return { 
        value: 0, // Set converted value to 0 for items with no rate
        displayText: `${value} ${currency.charAt(0).toUpperCase() + currency.slice(1)}` 
      };
    }
    
    // Handle currencies with 0 rate (worthless items)
    if (currencyRate === 0) {
      console.log(`Currency "${currency}" has 0 rate, treating as worthless`);
      return {
        value: 0,
        displayText: `${value} ${currency.charAt(0).toUpperCase() + currency.slice(1)}`
      };
    }

    // Convert to exalts
    // currencyRate represents how many exalts 1 unit of this currency is worth
    // So we multiply the value by the rate to get exalt equivalent
    const exaltValue = value * currencyRate;
    
    // Clean logging: show original currency, matched currency, and converted value
    console.log(`Currency: "${currency}" -> "${matchedCurrency}" -> ${exaltValue.toFixed(3)} exalts`);
    
    // Format the display text
    if (exaltValue >= 1) {
      // Show as whole exalts if >= 1
      return { 
        value: exaltValue, 
        displayText: `${Math.round(exaltValue)} Exalted${Math.round(exaltValue) !== 1 ? 's' : ''}` 
      };
    } else {
      // Show as decimal exalts if < 1
      return { 
        value: exaltValue, 
        displayText: `${exaltValue.toFixed(2)} Exalted${exaltValue !== 1 ? 's' : ''}` 
      };
    }
  };

  // Set global conversion function for debugging
  globalConvertToExalts = convertToExalts;


  // Sort items according to the specified order:
  // 1. Items with exalt currency value, sorted by converted exalt value, high to low
  // 2. Items with other currency type, sorted by converted exalt value, high to low  
  // 3. Items with unknown value
  const sortItemsByValue = (items: StashedItem[]): StashedItem[] => {
    return [...items].sort((a, b) => {
      // Check if items have known values (now using convertedValue)
      const aHasValue = a.convertedValue !== undefined && a.convertedValue !== null;
      const bHasValue = b.convertedValue !== undefined && b.convertedValue !== null;
      
      // Handle unknown values (category 3)
      if (!aHasValue && !bHasValue) {
        // Both have unknown values, maintain original order
        return 0;
      }
      
      if (!aHasValue) {
        // a has unknown value, b has known value - a goes after b (category 3 after 1/2)
        return 1;
      }
      
      if (!bHasValue) {
        // b has unknown value, a has known value - b goes after a (category 3 after 1/2)
        return -1;
      }
      
      // Both have known values, determine category by original currency
      const aIsExaltCurrency = a.currency ? isExaltCurrency(a.currency) : false;
      const bIsExaltCurrency = b.currency ? isExaltCurrency(b.currency) : false;
      
      // Prioritize items that are originally exalt currency (category 1) over other currencies (category 2)
      if (aIsExaltCurrency && !bIsExaltCurrency) {
        return -1; // a (original exalt) comes before b (other currency)
      }
      
      if (!aIsExaltCurrency && bIsExaltCurrency) {
        return 1; // b (original exalt) comes before a (other currency)
      }
      
      // Both are same category (both original exalt or both other currency)
      // Sort by convertedValue (high to low)
      return b.convertedValue! - a.convertedValue!;
    });
  };

  // Error handling functions
  const showError = (message: string) => {
    setErrorMessage(message);
    setIsErrorPopupOpen(true);
    // Stop all operations immediately
    stopAllOperations();
  };

  const hideError = () => {
    setIsErrorPopupOpen(false);
    setErrorMessage("");
  };

  const stopAllOperations = () => {
    // Stop live search
    stopLiveSearch();
    // Stop loading
    setIsLoadingItems(false);
    // Stop pricing
    setIsPricingInProgress(false);
    // Reset completion states
    setIsPricingCompleteForCurrentScan(true);
    setIsFetchCompleteForCurrentScan(true);
    // Clear any queued pricing states
    setItems(prevItems => 
      prevItems.map(item => ({ ...item, isQueuedForPricing: false }))
    );
  };

  const handleApiError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    
    if (error instanceof ApiError) {
      showError(`${context}: ${error.responseMessage}`);
    } else {
      showError(`${context}: ${error.message || 'An unexpected error occurred'}`);
    }
  };

  // Play alert sound for high-value items
  const playAlertSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('🔔 Alert: High-value item detected!');
    } catch (error) {
      console.error('Error playing alert sound:', error);
      // Fallback: just log to console
      console.log('🔔 BEEP! High-value item detected!');
    }
  };

  // Check if item value exceeds threshold and play alert
  // Uses stored convertedValue for threshold comparison
  const checkThresholdAlert = (item: StashedItem) => {
    if (item.convertedValue && item.convertedValue >= threshold) {
      console.log(`High-value item detected: ${item.name} - ${item.convertedValue.toFixed(3)} exalts (threshold: ${threshold})`);
      playAlertSound();
    }
  };

  // Fetch leagues when the app first loads (only once)
  useEffect(() => {
    // Prevent multiple fetches
    if (leaguesFetchedRef.current) {
      console.log('Leagues already fetched, skipping...');
      return;
    }

    const fetchLeagues = async () => {
      try {
        console.log('App loaded, fetching leagues...');
        leaguesFetchedRef.current = true; // Mark as fetched before making the request
        
        const fetchedLeagues = await Poe2HelperApi.fetchLeagues();
        setLeagues(fetchedLeagues);
        console.log('Leagues stored in state:', fetchedLeagues);
        console.log('Number of leagues available:', fetchedLeagues.length);
        
        // Set default league if available
        if (fetchedLeagues.length > 0) {
          // Check if our selected league is in the fetched leagues
          if (fetchedLeagues.includes(selectedLeague)) {
            // Use the selected league (it's valid)
            const formattedLeague = selectedLeague.replace(/\s+/g, '%20');
            
            // Update the league in both API classes
            Poe2TradeApi.setLeague(formattedLeague);
            Poe2HelperApi.setLeague(formattedLeague);
            
            // Fetch currency values for the selected league
            await fetchCurrencyValues(formattedLeague);
          } else {
            // Selected league not found, use the first available league
            setSelectedLeague(fetchedLeagues[0]);
            const formattedLeague = fetchedLeagues[0].replace(/\s+/g, '%20');
            
            // Update the league in both API classes
            Poe2TradeApi.setLeague(formattedLeague);
            Poe2HelperApi.setLeague(formattedLeague);
            
            // Fetch currency values for the default league
            await fetchCurrencyValues(formattedLeague);
          }
        }
        
        // Leagues are now available for future use (league selection, etc.)
        console.log('Available leagues:', fetchedLeagues.length > 0 ? fetchedLeagues : 'Loading...');
      } catch (error) {
        console.error('Failed to fetch leagues on app load:', error);
        leaguesFetchedRef.current = false; // Reset on error to allow retry
      }
    };

    fetchLeagues();
  }, []);

  const handleFetchItems = async (account: string) => {
    setIsLoadingItems(true);
    setIsFetchCompleteForCurrentScan(false);
    
    // Clear cache and items if switching to a different account
    // Only clear if we actually had a previous account name and it's different
    if (accountName && accountName.trim() !== "" && accountName !== account) {
      Poe2TradeApi.clearCache();
      setItems([]);
    }
    
    setAccountName(account);
    
    try {
      const fetchedItems = await fetchStashedItems(account, items);
      const sortedItems = sortItemsByValue(fetchedItems);
      setItems(sortedItems);
      
      // Hide the loading spinner once items are loaded and displayed
      setIsLoadingItems(false);
      setIsFetchCompleteForCurrentScan(true);
      
      if (fetchedItems.length === 0) {
        console.log(`No items found for account: ${account}`);
        // No items found, mark pricing as complete too
        setIsPricingCompleteForCurrentScan(true);
      } else {
        // Check if any items need pricing before triggering price check
        const itemsNeedingPricing = fetchedItems.filter(item => 
          item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null || item.convertedValue === undefined || item.convertedValue === null
        );
        
        if (itemsNeedingPricing.length > 0) {
          // Automatically trigger pricing after items are loaded (this runs in background)
          console.log(`Loaded ${fetchedItems.length} items, ${itemsNeedingPricing.length} need pricing, starting automatic price check...`);
          // Don't await this - let it run in background while items are already displayed
          handlePriceCheck(itemsNeedingPricing).catch(error => {
            console.error("Error during automatic price check:", error);
          });
        } else {
          console.log(`Loaded ${fetchedItems.length} items, all already have pricing data`);
          // No items need pricing, mark as complete immediately
          setIsPricingCompleteForCurrentScan(true);
        }
      }
    } catch (error) {
      handleApiError(error, "Fetching items");
      // On error, mark both as complete to prevent hanging
      setIsFetchCompleteForCurrentScan(true);
      setIsPricingCompleteForCurrentScan(true);
    }
  };

  const handlePriceCheck = async (itemsToPrice: StashedItem[] = items) => {
    if (itemsToPrice.length === 0) {
      // No items to price, mark as complete
      setIsPricingCompleteForCurrentScan(true);
      return;
    }

    // Set pricing in progress and mark as not complete for current scan
    setIsPricingInProgress(true);
    setIsPricingCompleteForCurrentScan(false);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Set queued state for items that need pricing
    setItems(prevItems => {
      const updatedItems = prevItems.map(item => 
        itemsToPrice.some(needingItem => needingItem.id === item.id)
          ? { ...item, isQueuedForPricing: true }
          : item
      );
      // Maintain sorting even when setting queued state
      return sortItemsByValue(updatedItems);
    });
    
    try {
      // Use incremental pricing to update UI as each item gets priced
      await fetchPricingDataIncremental(itemsToPrice, (itemId: string, pricing) => {
        // Calculate converted value using our currency matching logic
        const converted = convertToExalts(pricing.estimatedValue, pricing.currency);
        
        // Update the specific item with its pricing data and clear queued state
        setItems(prevItems => {
          const updatedItems = prevItems.map(item => 
            item.id === itemId 
              ? {
                  ...item,
                  estimatedValue: pricing.estimatedValue,
                  currency: pricing.currency,
                  convertedValue: converted.value,
                  isQueuedForPricing: false
                }
              : item
          );
          
          // Check threshold and play alert for the updated item
          const updatedItem = updatedItems.find(item => item.id === itemId);
          if (updatedItem) {
            checkThresholdAlert(updatedItem);
          }
          
          // Re-sort items after updating pricing data
          return sortItemsByValue(updatedItems);
        });
      });
    } catch (error) {
      handleApiError(error, "Fetching pricing data");
    } finally {
      // Pricing completed (success or error)
      setIsPricingInProgress(false);
      setIsPricingCompleteForCurrentScan(true);
    }
  };

  const handleSettingsOpen = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const handleLeagueChange = async (league: string) => {
    setSelectedLeague(league);
    // Format the league name for API calls (URL encode spaces as %20)
    const formattedLeague = league.replace(/\s+/g, '%20');
    
    // Update the league in both API classes
    Poe2TradeApi.setLeague(formattedLeague);
    Poe2HelperApi.setLeague(formattedLeague);
    
    // Fetch currency values for the new league
    await fetchCurrencyValues(formattedLeague);
    
    console.log('League changed to:', league);
    console.log('Formatted league for API:', formattedLeague);
  };

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    console.log('Threshold changed to:', newThreshold);
  };

  // Function to start countdown timer
  const startCountdown = () => {
    setCountdownSeconds(60);
    
    // Start the countdown
    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          return 60; // Reset to 60 when it reaches 0
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Function to perform a single scan cycle
  const performScanCycle = async (currentAccountName: string) => {
    // Use the current items state to preserve pricing data
    setIsLoadingItems(true);
    setIsFetchCompleteForCurrentScan(false);
    
    try {
      // Get current items state at the time of the scan
      const currentItems = itemsRef.current; // Use ref to get current items
      const fetchedItems = await fetchStashedItems(currentAccountName, currentItems);
      const sortedItems = sortItemsByValue(fetchedItems);
      setItems(sortedItems);
      
      // Mark fetch as complete
      setIsFetchCompleteForCurrentScan(true);
      
      // Check if any items need pricing before triggering price check
      const itemsNeedingPricing = fetchedItems.filter(item => 
        item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null || item.convertedValue === undefined || item.convertedValue === null
      );
      
      if (itemsNeedingPricing.length > 0) {
        console.log(`Live search: ${fetchedItems.length} items total, ${itemsNeedingPricing.length} need pricing`);
        await handlePriceCheck(itemsNeedingPricing);
      } else {
        console.log(`Live search: ${fetchedItems.length} items, all already have pricing data`);
        // No items need pricing, mark as complete immediately
        setIsPricingCompleteForCurrentScan(true);
      }
      
    } catch (error) {
      handleApiError(error, "Live search");
      // On error, mark both as complete to prevent hanging
      setIsFetchCompleteForCurrentScan(true);
      setIsPricingCompleteForCurrentScan(true);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Live search functionality
  const startLiveSearch = async (currentAccountName: string) => {
    if (!currentAccountName.trim()) {
      console.log('Cannot start live search: no account name entered');
      return;
    }

    console.log('Starting live search for account:', currentAccountName);
    setIsLiveSearchEnabled(true);

    // Perform initial fetch
    await performScanCycle(currentAccountName);

    // Set up interval for subsequent fetches
    liveSearchIntervalRef.current = setInterval(async () => {
      await performScanCycle(currentAccountName);
    }, 60000); // 60 seconds
  };

  const stopLiveSearch = () => {
    console.log('Stopping live search');
    setIsLiveSearchEnabled(false);
    setCountdownSeconds(0);
    
    // Clear intervals
    if (liveSearchIntervalRef.current) {
      clearInterval(liveSearchIntervalRef.current);
      liveSearchIntervalRef.current = null;
    }
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const handleLiveSearchToggle = (currentAccountName: string) => {
    if (isLiveSearchEnabled) {
      // Stop live search immediately - this only stops the interval, doesn't interrupt ongoing operations
      stopLiveSearch();
    } else {
      // Check if operations are in progress before starting auto scan
      if (isPricingInProgress || isLoadingItems) {
        console.log('Cannot start auto scan: operations are currently in progress');
        return;
      }
      
      // Start live search with the provided account name
      startLiveSearch(currentAccountName);
    }
  };

  // Keep itemsRef in sync with items state
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Start countdown when both fetch and pricing are complete for current scan and live search is enabled
  useEffect(() => {
    if (isLiveSearchEnabled && isFetchCompleteForCurrentScan && isPricingCompleteForCurrentScan && !isPricingInProgress && !isLoadingItems) {
      // Clear any existing countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      // Start new countdown
      startCountdown();
    }
  }, [isLiveSearchEnabled, isFetchCompleteForCurrentScan, isPricingCompleteForCurrentScan, isPricingInProgress, isLoadingItems]);

  // Cleanup intervals on component unmount
  useEffect(() => {
    return () => {
      if (liveSearchIntervalRef.current) {
        clearInterval(liveSearchIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  return (
    <>
      <GearIcon onClick={handleSettingsOpen} disabled={isLiveSearchEnabled} />
      
      <Settings
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        leagues={leagues}
        selectedLeague={selectedLeague}
        onLeagueChange={handleLeagueChange}
        threshold={threshold}
        onThresholdChange={handleThresholdChange}
        isDisabled={isLiveSearchEnabled}
      />

      <ErrorPopup
        isOpen={isErrorPopupOpen}
        message={errorMessage}
        onClose={hideError}
      />

      <main className="container">
        <AccountInput 
          onFetchItems={handleFetchItems}
          isLoading={isLoadingItems}
          isLiveSearchEnabled={isLiveSearchEnabled}
          onLiveSearchToggle={handleLiveSearchToggle}
          countdownSeconds={countdownSeconds}
          isDisabled={isLiveSearchEnabled || isPricingInProgress || isLoadingItems}
          isPricingInProgress={isPricingInProgress}
          canStartAutoScan={!isPricingInProgress && !isLoadingItems}
        />
      

      {items.length > 0 && (
        <div className="items-container">
          <div className="items-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {!isLoadingItems && accountName && items.length === 0 && (
        <div className="no-items-message">
          <p>No stashed items found for account "{accountName}"</p>
          <p className="no-items-hint">Make sure the account name is correct and the account has items in their stash.</p>
        </div>
      )}

      {isLoadingItems && (
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Fetching stashed items...</p>
        </div>
      )}
      </main>
    </>
  );
}

export default App;