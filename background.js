// background.js
const API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

async function fetchExchangeRate() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const rate = data.rates.KRW;
    if (rate) {
      await chrome.storage.local.set({ exchangeRate: rate, lastUpdated: Date.now() });
      console.log("Exchange rate updated:", rate);
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    enabled: true, 
    customRateEnabled: false, 
    customRate: 1350,
    exchangeRate: 1350 // Default fallback
  });
  fetchExchangeRate();
});

chrome.alarms.create("fetchRate", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchRate") {
    fetchExchangeRate();
  }
});
