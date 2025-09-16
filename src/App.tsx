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

  // Convert any currency value to exalts
  const convertToExalts = (value: number, currency: string): { value: number; displayText: string } => {
    // If already exalts, return as is
    if (currency.toLowerCase() === 'exalted') {
      return { 
        value: value, 
        displayText: `${value} Exalted${value !== 1 ? 's' : ''}` 
      };
    }

    // Get the conversion rate from currency values
    const currencyRate = currencyValues[currency.toLowerCase()] || currencyValues[currency];
    
    if (!currencyRate || currencyRate === 0) {
      // If we don't have conversion data, show original value
      return { 
        value: value, 
        displayText: `${value} ${currency.charAt(0).toUpperCase() + currency.slice(1)}` 
      };
    }

    // Convert to exalts
    // currencyRate represents how many exalts 1 unit of this currency is worth
    // So we multiply the value by the rate to get exalt equivalent
    const exaltValue = value * currencyRate;
    
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
  const checkThresholdAlert = (item: StashedItem, pricing: any) => {
    if (pricing.estimatedValue && pricing.currency) {
      const converted = convertToExalts(pricing.estimatedValue, pricing.currency);
      if (converted.value >= threshold) {
        console.log(`High-value item detected: ${item.name} - ${converted.displayText}`);
        playAlertSound();
      }
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
    
    // Clear cache and items if switching to a different account
    // Only clear if we actually had a previous account name and it's different
    if (accountName && accountName.trim() !== "" && accountName !== account) {
      Poe2TradeApi.clearCache();
      setItems([]);
    }
    
    setAccountName(account);
    
    try {
      const fetchedItems = await fetchStashedItems(account, items);
      setItems(fetchedItems);
      
      // Hide the loading spinner once items are loaded and displayed
      setIsLoadingItems(false);
      
      if (fetchedItems.length === 0) {
        console.log(`No items found for account: ${account}`);
      } else {
        // Check if any items need pricing before triggering price check
        const itemsNeedingPricing = fetchedItems.filter(item => 
          item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null
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
        }
      }
    } catch (error) {
      handleApiError(error, "Fetching items");
    }
  };

  const handlePriceCheck = async (itemsToPrice: StashedItem[] = items) => {
    if (itemsToPrice.length === 0) return;

    // Set pricing in progress
    setIsPricingInProgress(true);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Set queued state for items that need pricing
    setItems(prevItems => 
      prevItems.map(item => 
        itemsToPrice.some(needingItem => needingItem.id === item.id)
          ? { ...item, isQueuedForPricing: true }
          : item
      )
    );
    
    try {
      // Use incremental pricing to update UI as each item gets priced
      await fetchPricingDataIncremental(itemsToPrice, (itemId: string, pricing) => {
        // Find the item to check threshold
        const item = itemsToPrice.find(item => item.id === itemId);
        
        // Check threshold and play alert if needed
        if (item) {
          checkThresholdAlert(item, pricing);
        }
        
        // Update the specific item with its pricing data and clear queued state
        setItems(prevItems => 
          prevItems.map(item => 
            item.id === itemId 
              ? {
                  ...item,
                  estimatedValue: pricing.estimatedValue,
                  currency: pricing.currency,
                  isQueuedForPricing: false
                }
              : item
          )
        );
      });
    } catch (error) {
      handleApiError(error, "Fetching pricing data");
    } finally {
      // Pricing completed (success or error)
      setIsPricingInProgress(false);
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

  // Live search functionality
  const startLiveSearch = async (currentAccountName: string) => {
    if (!currentAccountName.trim()) {
      console.log('Cannot start live search: no account name entered');
      return;
    }

    console.log('Starting live search for account:', currentAccountName);
    setIsLiveSearchEnabled(true);
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

    // Perform initial fetch
    await handleFetchItems(currentAccountName);

    // Set up interval for subsequent fetches
    liveSearchIntervalRef.current = setInterval(async () => {
      // Use the current items state to preserve pricing data
      setIsLoadingItems(true);
      
      try {
        // Get current items state at the time of the interval
        const currentItems = itemsRef.current; // Use ref to get current items
        const fetchedItems = await fetchStashedItems(currentAccountName, currentItems);
        setItems(fetchedItems);
        
        // Check if any items need pricing before triggering price check
        const itemsNeedingPricing = fetchedItems.filter(item => 
          item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null
        );
        
        if (itemsNeedingPricing.length > 0) {
          console.log(`Live search: ${fetchedItems.length} items total, ${itemsNeedingPricing.length} need pricing`);
          handlePriceCheck(itemsNeedingPricing).catch(error => {
            console.error("Error during live search price check:", error);
          });
        } else {
          console.log(`Live search: ${fetchedItems.length} items, all already have pricing data`);
        }
        
      } catch (error) {
        handleApiError(error, "Live search");
      } finally {
        setIsLoadingItems(false);
      }
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
      // Start live search with the provided account name
      startLiveSearch(currentAccountName);
    }
  };

  // Keep itemsRef in sync with items state
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
        />
      

      {items.length > 0 && (
        <div className="items-container">
          <h3>Stashed Items for {accountName}</h3>
          <div className="items-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} convertToExalts={convertToExalts} />
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