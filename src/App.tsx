import { useState, useEffect, useRef } from "react";
import "./App.css";
import AccountInput from "./components/AccountInput";
import PriceCheckButton from "./components/PriceCheckButton";
import ItemCard from "./components/ItemCard";
import Settings from "./components/Settings";
import GearIcon from "./components/GearIcon";
import { StashedItem } from "./types";
import { fetchStashedItems, fetchPricingDataIncremental } from "./mockData";
import { Poe2TradeApi } from "./api/poe2TradeApi";
import { Poe2HelperApi } from "./api/poe2HelperApi";

// Make APIs available globally for debugging
(window as any).Poe2TradeApi = Poe2TradeApi;
(window as any).Poe2HelperApi = Poe2HelperApi;

function App() {
  const [items, setItems] = useState<StashedItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [leagues, setLeagues] = useState<string[]>([]);
  const leaguesFetchedRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<string>("Rise of the Abyssal");
  const [currentLeague, setCurrentLeague] = useState<string>("Rise%20of%20the%20Abyssal");

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
        if (fetchedLeagues.length > 0 && !fetchedLeagues.includes(selectedLeague)) {
          setSelectedLeague(fetchedLeagues[0]);
          // Also update the formatted league
          const formattedLeague = fetchedLeagues[0].replace(/\s+/g, '%20');
          setCurrentLeague(formattedLeague);
          
          // Update the league in both API classes
          Poe2TradeApi.setLeague(formattedLeague);
          Poe2HelperApi.setLeague(formattedLeague);
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
    if (accountName && accountName !== account) {
      Poe2TradeApi.clearCache();
      setItems([]);
    }
    
    setAccountName(account);
    
    try {
      const fetchedItems = await fetchStashedItems(account, items);
      setItems(fetchedItems);
      
      if (fetchedItems.length === 0) {
        console.log(`No items found for account: ${account}`);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      // You could add a toast notification or error state here
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handlePriceCheck = async () => {
    if (items.length === 0) return;
    
    setIsLoadingPrices(true);
    
    // Filter items that need pricing and mark them as queued
    const itemsNeedingPricing = items.filter(item => 
      item.estimatedValue === undefined || item.estimatedValue === null || item.currency === undefined || item.currency === null
    );
    
    // Set queued state for items that need pricing
    setItems(prevItems => 
      prevItems.map(item => 
        itemsNeedingPricing.some(needingItem => needingItem.id === item.id)
          ? { ...item, isQueuedForPricing: true }
          : item
      )
    );
    
    try {
      // Use incremental pricing to update UI as each item gets priced
      await fetchPricingDataIncremental(items, (itemId: string, pricing) => {
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
      console.error("Error fetching pricing data:", error);
      
      // Clear queued state for all items on error
      setItems(prevItems => 
        prevItems.map(item => ({ ...item, isQueuedForPricing: false }))
      );
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const handleSettingsOpen = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    // Format the league name for API calls (URL encode spaces as %20)
    const formattedLeague = league.replace(/\s+/g, '%20');
    setCurrentLeague(formattedLeague);
    
    // Update the league in both API classes
    Poe2TradeApi.setLeague(formattedLeague);
    Poe2HelperApi.setLeague(formattedLeague);
    
    console.log('League changed to:', league);
    console.log('Formatted league for API:', formattedLeague);
  };

  return (
    <>
      <GearIcon onClick={handleSettingsOpen} />
      
      <Settings
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        leagues={leagues}
        selectedLeague={selectedLeague}
        onLeagueChange={handleLeagueChange}
      />

      <main className="container">
        <AccountInput 
          onFetchItems={handleFetchItems}
          isLoading={isLoadingItems}
        />
      
      <PriceCheckButton
        onPriceCheck={handlePriceCheck}
        isLoading={isLoadingPrices}
        hasItems={items.length > 0}
      />

      {items.length > 0 && (
        <div className="items-container">
          <h3>Stashed Items for {accountName}</h3>
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