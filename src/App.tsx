import { useState } from "react";
import "./App.css";
import AccountInput from "./components/AccountInput";
import PriceCheckButton from "./components/PriceCheckButton";
import ItemCard from "./components/ItemCard";
import { StashedItem } from "./types";
import { fetchStashedItems, fetchPricingData } from "./mockData";

function App() {
  const [items, setItems] = useState<StashedItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [accountName, setAccountName] = useState("");

  const handleFetchItems = async (account: string) => {
    setIsLoadingItems(true);
    setAccountName(account);
    setItems([]); // Clear previous items
    try {
      const fetchedItems = await fetchStashedItems(account);
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
      const pricingData = await fetchPricingData(items);
      
      // Update items with pricing information
      const updatedItems = items.map(item => {
        const pricing = pricingData.find(p => p.itemId === item.id);
        return pricing ? {
          ...item,
          estimatedValue: pricing.estimatedValue,
          currency: pricing.currency
        } : item;
      });
      
      setItems(updatedItems);
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