import { useState } from "react";
import "./App.css";
import AccountInput from "./components/AccountInput";
import PriceCheckButton from "./components/PriceCheckButton";
import ItemCard from "./components/ItemCard";
import { StashedItem } from "./types";
import { fetchStashedItems, fetchPricingDataIncremental } from "./mockData";
import { Poe2TradeApi } from "./api/poe2TradeApi";

function App() {
  const [items, setItems] = useState<StashedItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [accountName, setAccountName] = useState("");

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
    try {
      // Use incremental pricing to update UI as each item gets priced
      await fetchPricingDataIncremental(items, (itemId: string, pricing) => {
        // Update the specific item with its pricing data
        setItems(prevItems => 
          prevItems.map(item => 
            item.id === itemId 
              ? {
                  ...item,
                  estimatedValue: pricing.estimatedValue,
                  currency: pricing.currency
                }
              : item
          )
        );
      });
    } catch (error) {
      console.error("Error fetching pricing data:", error);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  return (
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
  );
}

export default App;