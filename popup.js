document.addEventListener('DOMContentLoaded', () => {
  const enableExt = document.getElementById('enable-extension');
  const customRateToggle = document.getElementById('custom-rate-toggle');
  const customRateInput = document.getElementById('custom-rate-input');
  const rateInfo = document.getElementById('current-rate-info');
  const ignoredUrlsInput = document.getElementById('ignored-urls');
  const addCurrentUrlBtn = document.getElementById('add-current-url');

  // Load current settings
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate', 'ignoredUrls'], (data) => {
    enableExt.checked = data.enabled !== false;
    customRateToggle.checked = data.customRateEnabled || false;
    customRateInput.value = data.customRate || 1350;
    customRateInput.disabled = !data.customRateEnabled;
    
    if (data.exchangeRate) {
      rateInfo.textContent = `현재 API 환율: ₩${data.exchangeRate.toLocaleString()}`;
    }
    
    if (data.ignoredUrls) {
      ignoredUrlsInput.value = data.ignoredUrls.join('\n');
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

  ignoredUrlsInput.addEventListener('input', () => {
    const urls = ignoredUrlsInput.value.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    chrome.storage.local.set({ ignoredUrls: urls });
  });

  addCurrentUrlBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        // You might only want origin, but the user asked for current page's URL
        const currentUrl = new URL(tabs[0].url).origin + new URL(tabs[0].url).pathname; // To make it simpler without queries
        let urls = ignoredUrlsInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (!urls.includes(currentUrl)) {
          urls.push(currentUrl);
          ignoredUrlsInput.value = urls.join('\n');
          chrome.storage.local.set({ ignoredUrls: urls });
        }
      }
    });
  });
});
