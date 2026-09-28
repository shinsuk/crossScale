// background.js
const API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

async function fetchExchangeRate() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const usdRate = data.rates.KRW;
    const eurRate = data.rates.EUR;
    const cnyRate = data.rates.CNY;
    const jpyRate = data.rates.JPY;
    if (usdRate && eurRate && cnyRate && jpyRate) {
      const eurToKrw = Math.round(usdRate / eurRate);
      const cnyToKrw = Math.round(usdRate / cnyRate);
      const jpyToKrw = Math.round((usdRate / jpyRate) * 100) / 100; // e.g. 9.0
      await chrome.storage.local.set({ 
        exchangeRate: usdRate, 
        eurExchangeRate: eurToKrw,
        cnyExchangeRate: cnyToKrw,
        jpyExchangeRate: jpyToKrw,
        lastUpdated: Date.now() 
      });
      console.log("Exchange rate updated - USD:", usdRate, "EUR:", eurToKrw, "CNY:", cnyToKrw, "JPY:", jpyToKrw);
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
    exchangeRate: 1350, // Default fallback
    eurExchangeRate: 1460, // Default fallback
    cnyExchangeRate: 187, // Default fallback
    jpyExchangeRate: 9.0, // Default fallback (1 JPY = 9 KRW)
    allowedUrls: []
  });
  fetchExchangeRate();
});

chrome.alarms.create("fetchRate", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchRate") {
    fetchExchangeRate();
  }
});
