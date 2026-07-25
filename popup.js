document.addEventListener('DOMContentLoaded', () => {
  const enableExt = document.getElementById('enable-extension');
  const customRateToggle = document.getElementById('custom-rate-toggle');
  const customRateInput = document.getElementById('custom-rate-input');
  const rateInfo = document.getElementById('current-rate-info');
  const ignoredUrlsInput = document.getElementById('ignored-urls');
  const addCurrentUrlBtn = document.getElementById('add-current-url');

  let settings = {
    customRateEnabled: false,
    customRate: 1350,
    exchangeRate: 1350
  };

  const quickConvertInput = document.getElementById('quick-convert-input');
  const quickConvertResult = document.getElementById('quick-convert-result');

  // Regex Patterns
  const sp = "\\s*";
  const numPat = "[0-9]+(?:,[0-9]+)*";
  const krRegex = new RegExp(`\\b(?:(?:${numPat})(?:\\.\\d+)?${sp}(?:경|조|억|만|천)+${sp})+(?:(?:${numPat})${sp})?(?:원|달러|불|\\$|억원|만원|조원|경원|억불|만불|조불|경불)?`, "g");
  const enRegex = new RegExp(`(?:\\$)${sp}(?:${numPat})(?:\\.\\d+)?${sp}(?:T|B|M|Trillion|Billion|Million)(?:${sp}(?:dollars|USD|불))?|\\b(?:${numPat})(?:\\.\\d+)?${sp}(?:T|B|M|Trillion|Billion|Million)\\b(?:${sp}(?:dollars|USD|불))?`, "ig");
  const combinedRegex = new RegExp(`(${krRegex.source})|(${enRegex.source})`, 'ig');

  function getActiveRate() {
    return settings.customRateEnabled ? settings.customRate : settings.exchangeRate;
  }

  function parseKoreanNumber(str) {
    let grandTotal = 0;
    let currentSubTotal = 0;

    const majorUnits = {
      '경': 10000000000000000,
      '조': 1000000000000,
      '억': 100000000,
      '만': 10000
    };

    const minorUnits = {
      '천': 1000,
      '백': 100,
      '십': 10
    };

    const regex = /([\d,]+(?:\.\d+)?)\s*([경조억만천백십]*)|([경조억만천백십]+)/g;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match[1] !== undefined) {
        const numStr = match[1].replace(/,/g, '');
        let num = parseFloat(numStr);
        if (isNaN(num)) continue;
        const units = match[2] || '';

        if (!units) {
          currentSubTotal += num;
        } else {
          let hasMajor = false;
          let unitMult = 1;

          for (const char of units) {
            if (majorUnits[char]) {
              hasMajor = true;
            } else if (minorUnits[char]) {
              unitMult *= minorUnits[char];
            }
          }

          if (hasMajor) {
            let val = num * unitMult;
            currentSubTotal += val;

            for (const char of units) {
              if (majorUnits[char]) {
                grandTotal += currentSubTotal * majorUnits[char];
                currentSubTotal = 0;
              }
            }
          } else {
            currentSubTotal += num * unitMult;
          }
        }
      } else if (match[3] !== undefined) {
        const units = match[3];
        let hasMajor = false;
        let unitMult = 1;

        for (const char of units) {
          if (majorUnits[char]) {
            hasMajor = true;
          } else if (minorUnits[char]) {
            unitMult *= minorUnits[char];
          }
        }

        if (hasMajor) {
          if (currentSubTotal === 0) currentSubTotal = 1;
          currentSubTotal *= unitMult;
          for (const char of units) {
            if (majorUnits[char]) {
              grandTotal += currentSubTotal * majorUnits[char];
              currentSubTotal = 0;
            }
          }
        } else {
          if (currentSubTotal === 0) currentSubTotal = 1;
          currentSubTotal *= unitMult;
        }
      }
    }

    grandTotal += currentSubTotal;
    return grandTotal;
  }

  function parseEnglishNumber(str) {
    const numMatch = str.match(/[\d,]+(?:\.\d+)?/);
    if (!numMatch) return 0;
    let num = parseFloat(numMatch[0].replace(/,/g, ''));
    const lowerStr = str.toLowerCase();
    
    if (lowerStr.includes('t') || lowerStr.includes('trillion')) num *= 1000000000000;
    else if (lowerStr.includes('b') || lowerStr.includes('billion')) num *= 1000000000;
    else if (lowerStr.includes('m') || lowerStr.includes('million')) num *= 1000000;
    
    return num;
  }

  function formatKorean(num) {
    if (num === 0) return "0원";
    let result = "";
    const gyeong = Math.floor(num / 10000000000000000);
    num %= 10000000000000000;
    const jo = Math.floor(num / 1000000000000);
    num %= 1000000000000;
    const uk = Math.floor(num / 100000000);
    num %= 100000000;
    const man = Math.floor(num / 10000);
    const won = Math.floor(num % 10000);
    
    if (gyeong > 0) result += `${gyeong.toLocaleString()}경 `;
    if (jo > 0) result += `${jo.toLocaleString()}조 `;
    if (uk > 0) result += `${uk.toLocaleString()}억 `;
    if (man > 0) result += `${man.toLocaleString()}만 `;
    if (won > 0) result += `${won.toLocaleString()}`;
    
    return result.trim() + "원";
  }

  function formatEnglish(num) {
    if (num >= 1000000000000) return `$${(num / 1000000000000).toFixed(2).replace(/\.00$/, '')}T`;
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2).replace(/\.00$/, '')}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    return `$${num.toLocaleString()}`;
  }

  function convertValue(text) {
    const rate = getActiveRate();
    let baseVal = 0;
    let isUSD = false;
    
    if (text.match(enRegex) || text.includes('$') || text.includes('달러') || text.includes('USD') || text.includes('불')) {
      isUSD = true;
      baseVal = text.match(enRegex) ? parseEnglishNumber(text) : parseKoreanNumber(text);
      const krwVal = baseVal * rate;
      return {
        title: '영미식 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatKorean(krwVal)}`,
        rateInfo: `적용 환율: ₩${rate.toLocaleString()}/$`
      };
    } else {
      // KRW or KR unit
      baseVal = parseKoreanNumber(text);
      const usdVal = baseVal / rate;
      return {
        title: '한국식 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatEnglish(usdVal)}`,
        rateInfo: `적용 환율: ₩${rate.toLocaleString()}/$`
      };
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateQuickConversion() {
    const text = quickConvertInput.value.trim();
    if (!text) {
      quickConvertResult.style.display = 'none';
      quickConvertResult.innerHTML = '';
      return;
    }
    
    combinedRegex.lastIndex = 0;
    const match = combinedRegex.exec(text);
    if (match) {
      const matchText = match[0];
      const result = convertValue(matchText);
      if (result) {
        quickConvertResult.style.display = 'block';

        const rawVal = result.rawText.replace(/^기본 수치:\s*/, '');
        const convVal = result.value.replace(/^환율 환산:\s*/, '');

        quickConvertResult.innerHTML = `
          <strong style="color: #212529;">${result.title}</strong>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 12px; color: #6c757d;">${result.rawText}</span>
            <button class="quick-copy-btn" data-copy="${escapeHtml(rawVal)}" title="기본 수치 복사" style="background:none; border:none; color:#6c757d; cursor:pointer; padding:2px 4px; font-size:13px; line-height: 1;">📋</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin: 4px 0;">
            <div style="font-size: 15px; color: #0d6efd; font-weight: bold;">${result.value}</div>
            <button class="quick-copy-btn" data-copy="${escapeHtml(convVal)}" title="환산 수치 복사" style="background:none; border:none; color:#0d6efd; cursor:pointer; padding:2px 4px; font-size:14px; line-height: 1;">📋</button>
          </div>
          <small style="color: #868e96; font-size: 11px;">${result.rateInfo}</small>
        `;

        quickConvertResult.querySelectorAll('.quick-copy-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const copyText = btn.getAttribute('data-copy');
            if (copyText) {
              navigator.clipboard.writeText(copyText);
              const origText = btn.textContent;
              btn.textContent = '✅';
              setTimeout(() => {
                btn.textContent = origText;
              }, 1500);
            }
          });
        });
        return;
      }
    }
    
    quickConvertResult.style.display = 'block';
    quickConvertResult.innerHTML = `<span style="color: #dc3545; font-size: 12px;">감지된 수치 또는 화폐 단위가 없습니다.<br>(예: 3천억 달러, $1.5B, 5천만원)</span>`;
  }

  // Load current settings
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate', 'ignoredUrls'], (data) => {
    enableExt.checked = data.enabled !== false;
    customRateToggle.checked = data.customRateEnabled || false;
    customRateInput.value = data.customRate || 1350;
    customRateInput.disabled = !data.customRateEnabled;
    
    settings.customRateEnabled = data.customRateEnabled || false;
    settings.customRate = data.customRate || 1350;
    settings.exchangeRate = data.exchangeRate || 1350;

    if (data.exchangeRate) {
      rateInfo.textContent = `현재 API 환율: ₩${data.exchangeRate.toLocaleString()}`;
    }
    
    if (data.ignoredUrls) {
      ignoredUrlsInput.value = data.ignoredUrls.join('\n');
    }

    updateQuickConversion();
  });

  // Save settings on change
  enableExt.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: enableExt.checked });
  });

  customRateToggle.addEventListener('change', () => {
    customRateInput.disabled = !customRateToggle.checked;
    settings.customRateEnabled = customRateToggle.checked;
    chrome.storage.local.set({ customRateEnabled: customRateToggle.checked });
    updateQuickConversion();
  });

  customRateInput.addEventListener('change', () => {
    const val = parseFloat(customRateInput.value);
    if (!isNaN(val)) {
      settings.customRate = val;
      chrome.storage.local.set({ customRate: val });
      updateQuickConversion();
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

  // Bind quick converter event
  quickConvertInput.addEventListener('input', updateQuickConversion);
});
