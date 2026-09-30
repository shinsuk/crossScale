document.addEventListener('DOMContentLoaded', () => {
  const enableExt = document.getElementById('enable-extension');
  const customRateToggle = document.getElementById('custom-rate-toggle');
  const customRateInput = document.getElementById('custom-rate-input');
  const rateInfo = document.getElementById('current-rate-info');
  const allowedUrlsInput = document.getElementById('allowed-urls');
  const addCurrentUrlBtn = document.getElementById('add-current-url');
  const applyCurrentPageBtn = document.getElementById('apply-current-page');
  const disableCurrentPageBtn = document.getElementById('disable-current-page');

  let settings = {
    customRateEnabled: false,
    customRate: 1350,
    exchangeRate: 1350,
    eurExchangeRate: 1460,
    cnyExchangeRate: 187,
    jpyExchangeRate: 9.0
  };

  function stripPostposition(str) {
    if (!str) return '';
    return str.replace(/(?<=(?:원|달러|불|\$|유로|euro|euros|EUR|€|위안|위안화|CNY|RMB|yuan|엔|엔화|JPY|yen|¥|억|조|경|억원|만원|조원|경원|억불|만불|조불|경불|억유로|만유로|조유로|경유로|억위안|만위안|조위안|경위안|억엔|만엔|조엔|경엔|만|\d))(?:을|를|이|가|은|는|에|의|와|과|도|로|으로|까지|부터|보다)$/g, '').trim();
  }

  const quickConvertInput = document.getElementById('quick-convert-input');
  const quickConvertResult = document.getElementById('quick-convert-result');

  // Regex Patterns
  const sp = "\\s*";
  const numPat = "[0-9]+(?:,[0-9]+)*";
  const unitsPat = "(?:경|조|억|만|천)+";
  const currPat = "(?:원|달러|불|\\$|유로|euro|euros|EUR|€|위안|위안화|CNY|RMB|yuan|엔|엔화|JPY|yen|¥|억원|만원|조원|경원|억불|만불|조불|경불|억유로|만유로|조유로|경유로|억위안|만위안|조위안|경위안|억엔|만엔|조엔|경엔)";
  const postposPat = "(?:을|를|이|가|은|는|에|의|와|과|도|로|으로|까지|부터|보다|만|등)?";

  const krUnitRegexStr = `(?:(?:${numPat})(?:\\.\\d+)?${sp}${unitsPat}${sp})+(?:(?:${numPat})${sp})?${currPat}?${postposPat}`;
  const directCurrRegexStr = `(?:${numPat})(?:\\.\\d+)?${sp}${currPat}${postposPat}`;

  const currNamesPat = "(?:dollars|USD|불|euros|EUR|euro|유로|yuan|RMB|CNY|위안|yen|JPY|엔)";
  const tbmPat = "(?<![a-zA-Z])(?:Trillion|Billion|Million|T|B|M)(?![a-zA-Z])";

  const symbolEnRegexStr = `(?:\\$|€|¥)${sp}(?:${numPat})(?:\\.\\d+)?(?:${sp}${tbmPat})?(?:${sp}${currNamesPat})?${postposPat}`;
  const unitEnRegexStr = `\\b(?:${numPat})(?:\\.\\d+)?${sp}${tbmPat}(?:${sp}${currNamesPat})?${postposPat}`;

  const krRegex = new RegExp(`(?:${krUnitRegexStr})|(?:${directCurrRegexStr})`, "g");
  const enRegex = new RegExp(`(?:${symbolEnRegexStr})|(?:${unitEnRegexStr})`, "ig");
  const combinedRegex = new RegExp(`(${krRegex.source})|(${enRegex.source})`, 'ig');

  function getActiveRates() {
    const usdRate = settings.customRateEnabled ? settings.customRate : settings.exchangeRate;
    const baseUsd = settings.exchangeRate || 1350;
    const baseEur = settings.eurExchangeRate || 1460;
    const baseCny = settings.cnyExchangeRate || 187;
    const baseJpy = settings.jpyExchangeRate || 9.0;
    
    const eurRate = settings.customRateEnabled ? Math.round((usdRate / baseUsd) * baseEur) : baseEur;
    const cnyRate = settings.customRateEnabled ? Math.round((usdRate / baseUsd) * baseCny) : baseCny;
    const jpyRate = settings.customRateEnabled ? Math.round((usdRate / baseUsd) * baseJpy * 100) / 100 : baseJpy;
    return { usdRate, eurRate, cnyRate, jpyRate };
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
    
    if (/(?<![a-z])(?:t|trillion)(?![a-z])/i.test(str)) num *= 1000000000000;
    else if (/(?<![a-z])(?:b|billion)(?![a-z])/i.test(str)) num *= 1000000000;
    else if (/(?<![a-z])(?:m|million)(?![a-z])/i.test(str)) num *= 1000000;
    
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

  function convertValue(rawText) {
    const text = stripPostposition(rawText);
    const { usdRate, eurRate, cnyRate, jpyRate } = getActiveRates();
    let baseVal = 0;
    
    const isJPY = text.includes('엔') || /\b(JPY|yen)\b/i.test(text);
    const isCNY = !isJPY && (text.includes('¥') || /\b(CNY|RMB)\b/i.test(text) || /\byuan\b/i.test(text) || text.includes('위안'));
    const isEUR = !isJPY && !isCNY && (text.includes('€') || /\bEUR\b/i.test(text) || /\beuro(s)?\b/i.test(text) || text.includes('유로'));
    const isUSD = !isJPY && !isCNY && !isEUR && (text.match(enRegex) || text.includes('$') || text.includes('달러') || /\bUSD\b/i.test(text) || text.includes('불'));
    
    if (isJPY) {
      baseVal = text.match(enRegex) ? parseEnglishNumber(text) : parseKoreanNumber(text);
      const krwVal = baseVal * jpyRate;
      const jpy100Rate = Math.round(jpyRate * 100);
      return {
        title: '엔화 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatKorean(krwVal)}`,
        rateInfo: `적용 환율: ₩${jpyRate}/¥ (₩${jpy100Rate}/100¥)`
      };
    } else if (isCNY) {
      baseVal = text.match(enRegex) ? parseEnglishNumber(text) : parseKoreanNumber(text);
      const krwVal = baseVal * cnyRate;
      return {
        title: '위안화 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatKorean(krwVal)}`,
        rateInfo: `적용 환율: ₩${cnyRate.toLocaleString()}/¥`
      };
    } else if (isEUR) {
      baseVal = text.match(enRegex) ? parseEnglishNumber(text) : parseKoreanNumber(text);
      const krwVal = baseVal * eurRate;
      return {
        title: '유로화 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatKorean(krwVal)}`,
        rateInfo: `적용 환율: ₩${eurRate.toLocaleString()}/€`
      };
    } else if (isUSD) {
      baseVal = text.match(enRegex) ? parseEnglishNumber(text) : parseKoreanNumber(text);
      const krwVal = baseVal * usdRate;
      return {
        title: '영미식 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatKorean(krwVal)}`,
        rateInfo: `적용 환율: ₩${usdRate.toLocaleString()}/$`
      };
    } else {
      // KRW or KR unit
      baseVal = parseKoreanNumber(text);
      const usdVal = baseVal / usdRate;
      return {
        title: '한국식 단위 감지',
        rawText: `기본 수치: ${baseVal.toLocaleString()}`,
        value: `환율 환산: ${formatEnglish(usdVal)}`,
        rateInfo: `적용 환율: ₩${usdRate.toLocaleString()}/$`
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
    quickConvertResult.innerHTML = `<span style="color: #dc3545; font-size: 12px;">감지된 수치 또는 화폐 단위가 없습니다.<br>(예: 3,500유로를, 270만 엔으로, 3천억 달러, $1.5B)</span>`;
  }

  // Load current settings
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate', 'eurExchangeRate', 'cnyExchangeRate', 'jpyExchangeRate', 'allowedUrls'], (data) => {
    enableExt.checked = data.enabled !== false;
    customRateToggle.checked = data.customRateEnabled || false;
    customRateInput.value = data.customRate || 1350;
    customRateInput.disabled = !data.customRateEnabled;
    
    settings.customRateEnabled = data.customRateEnabled || false;
    settings.customRate = data.customRate || 1350;
    settings.exchangeRate = data.exchangeRate || 1350;
    settings.eurExchangeRate = data.eurExchangeRate || 1460;
    settings.cnyExchangeRate = data.cnyExchangeRate || 187;
    settings.jpyExchangeRate = data.jpyExchangeRate || 9.0;

    const usdStr = data.exchangeRate ? data.exchangeRate.toLocaleString() : '1,350';
    const eurStr = data.eurExchangeRate ? data.eurExchangeRate.toLocaleString() : '1,460';
    const cnyStr = data.cnyExchangeRate ? data.cnyExchangeRate.toLocaleString() : '187';
    const jpyStr = data.jpyExchangeRate ? Math.round(data.jpyExchangeRate * 100).toLocaleString() : '900';
    rateInfo.textContent = `현재 API 환율: ₩${usdStr}/$ | ₩${eurStr}/€ | ₩${cnyStr}/위안 | ₩${jpyStr}/100엔`;
    
    if (data.allowedUrls) {
      allowedUrlsInput.value = data.allowedUrls.join('\n');
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

  allowedUrlsInput.addEventListener('input', () => {
    const urls = allowedUrlsInput.value.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    chrome.storage.local.set({ allowedUrls: urls });
  });

  // 1. 현재 사이트 추가 (리스트에 URL 추가 + 저장 + 현재 페이지 적용)
  addCurrentUrlBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        const currentTab = tabs[0];
        const currentUrl = new URL(currentTab.url).origin + new URL(currentTab.url).pathname;
        let urls = allowedUrlsInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (!urls.includes(currentUrl)) {
          urls.push(currentUrl);
          allowedUrlsInput.value = urls.join('\n');
          chrome.storage.local.set({ allowedUrls: urls }, () => {
            if (currentTab.id) {
              chrome.tabs.sendMessage(currentTab.id, { action: 'applyToCurrentPage' }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {}
              });
            }
          });
        } else {
          if (currentTab.id) {
            chrome.tabs.sendMessage(currentTab.id, { action: 'applyToCurrentPage' }, () => {
              if (chrome.runtime && chrome.runtime.lastError) {}
            });
          }
        }

        const origText = addCurrentUrlBtn.textContent;
        addCurrentUrlBtn.textContent = '✅ 사이트 추가됨!';
        setTimeout(() => {
          addCurrentUrlBtn.textContent = origText;
        }, 1500);
      }
    });
  });

  // 2. 현재 페이지 적용 (리스트에 추가하지 않고 일회성 강제 적용만 실행)
  if (applyCurrentPageBtn) {
    applyCurrentPageBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'forceApplyToCurrentPage' }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {}
          });
          const origText = applyCurrentPageBtn.textContent;
          applyCurrentPageBtn.textContent = '✅ 적용 완료!';
          setTimeout(() => {
            applyCurrentPageBtn.textContent = origText;
          }, 1500);
        }
      });
    });
  }

  // 3. 현재 페이지 제외 (리스트에 남아있더라도 현재 탭에서 하이라이트 원복 및 제외)
  if (disableCurrentPageBtn) {
    disableCurrentPageBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'forceDisableCurrentPage' }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {}
          });
          const origText = disableCurrentPageBtn.textContent;
          disableCurrentPageBtn.textContent = '✅ 제외 완료!';
          setTimeout(() => {
            disableCurrentPageBtn.textContent = origText;
          }, 1500);
        }
      });
    });
  }

  // Bind quick converter event
  quickConvertInput.addEventListener('input', updateQuickConversion);
});
