document.addEventListener('DOMContentLoaded', () => {
  const enableExt = document.getElementById('enable-extension');
  const customRateToggle = document.getElementById('custom-rate-toggle');
  const customRateInput = document.getElementById('custom-rate-input');
  const rateInfo = document.getElementById('current-rate-info');

  // Load current settings
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate'], (data) => {
    enableExt.checked = data.enabled !== false;
    customRateToggle.checked = data.customRateEnabled || false;
    customRateInput.value = data.customRate || 1350;
    customRateInput.disabled = !data.customRateEnabled;
    
    if (data.exchangeRate) {
      rateInfo.textContent = `현재 API 환율: ₩${data.exchangeRate.toLocaleString()}`;
    }
  });

  // Save settings on change
  enableExt.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: enableExt.checked });
  });

  customRateToggle.addEventListener('change', () => {
    customRateInput.disabled = !customRateToggle.checked;
    chrome.storage.local.set({ customRateEnabled: customRateToggle.checked });
  });

  customRateInput.addEventListener('change', () => {
    const val = parseFloat(customRateInput.value);
    if (!isNaN(val)) {
      chrome.storage.local.set({ customRate: val });
    }
  });
});
