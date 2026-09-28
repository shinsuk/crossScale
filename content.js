// content.js
let settings = {
  enabled: true,
  customRateEnabled: false,
  customRate: 1350,
  exchangeRate: 1350,
  eurExchangeRate: 1460,
  cnyExchangeRate: 187,
  jpyExchangeRate: 9.0,
  allowedUrls: []
};

function stripPostposition(str) {
  if (!str) return '';
  return str.replace(/(?<=(?:원|달러|불|\$|유로|euro|euros|EUR|€|위안|위안화|CNY|RMB|yuan|엔|엔화|JPY|yen|¥|억|조|경|억원|만원|조원|경원|억불|만불|조불|경불|억유로|만유로|조유로|경유로|억위안|만위안|조위안|경위안|억엔|만엔|조엔|경엔|만|\d))(?:을|를|이|가|은|는|에|의|와|과|도|로|으로|까지|부터|보다)$/g, '').trim();
}

// Regex Patterns
const sp = "\\s*";
const numPat = "[0-9]+(?:,[0-9]+)*";
const unitsPat = "(?:경|조|억|만|천)+";
const currPat = "(?:원|달러|불|\\$|유로|euro|euros|EUR|€|위안|위안화|CNY|RMB|yuan|엔|엔화|JPY|yen|¥|억원|만원|조원|경원|억불|만불|조불|경불|억유로|만유로|조유로|경유로|억위안|만위안|조위안|경위안|억엔|만엔|조엔|경엔)";
const postposPat = "(?:을|를|이|가|은|는|에|의|와|과|도|로|으로|까지|부터|보다|만|등)?";

const krUnitRegexStr = `(?:(?:${numPat})(?:\\.\\d+)?${sp}${unitsPat}${sp})+(?:(?:${numPat})${sp})?${currPat}?${postposPat}`;
const directCurrRegexStr = `(?:${numPat})(?:\\.\\d+)?${sp}${currPat}${postposPat}`;

const currNamesPat = "(?:dollars|USD|불|euros|EUR|euro|유로|yuan|RMB|CNY|위안|yen|JPY|엔)";
const tbmPat = "(?:T|B|M|Trillion|Billion|Million)";

const symbolEnRegexStr = `(?:\\$|€|¥)${sp}(?:${numPat})(?:\\.\\d+)?(?:${sp}${tbmPat})?(?:${sp}${currNamesPat})?${postposPat}`;
const unitEnRegexStr = `\\b(?:${numPat})(?:\\.\\d+)?${sp}${tbmPat}(?:${sp}${currNamesPat})?${postposPat}`;

const krRegex = new RegExp(`(?:${krUnitRegexStr})|(?:${directCurrRegexStr})`, "g");
const enRegex = new RegExp(`(?:${symbolEnRegexStr})|(?:${unitEnRegexStr})`, "ig");

// Tooltip Element
let tooltipEl = null;

function init() {
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate', 'eurExchangeRate', 'cnyExchangeRate', 'jpyExchangeRate', 'allowedUrls'], (data) => {
    settings = { ...settings, ...data };
    
    const currentUrl = window.location.href;
    const isAllowed = settings.allowedUrls && settings.allowedUrls.some(url => url && currentUrl.startsWith(url));

    if (settings.enabled && isAllowed) {
      createTooltip();
      scanAndHighlight(document.body);
      setupObserver();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
    if (changes.customRateEnabled) settings.customRateEnabled = changes.customRateEnabled.newValue;
    if (changes.customRate) settings.customRate = changes.customRate.newValue;
    if (changes.exchangeRate) settings.exchangeRate = changes.exchangeRate.newValue;
    if (changes.eurExchangeRate) settings.eurExchangeRate = changes.eurExchangeRate.newValue;
    if (changes.cnyExchangeRate) settings.cnyExchangeRate = changes.cnyExchangeRate.newValue;
    if (changes.jpyExchangeRate) settings.jpyExchangeRate = changes.jpyExchangeRate.newValue;
    if (changes.allowedUrls) settings.allowedUrls = changes.allowedUrls.newValue;
  });
}

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
  const rounded = Math.round(num);
  if (rounded >= 1000000000000) return `$${(rounded / 1000000000000).toFixed(2).replace(/\.00$/, '')}T`;
  if (rounded >= 1000000000) return `$${(rounded / 1000000000).toFixed(2).replace(/\.00$/, '')}B`;
  if (rounded >= 1000000) return `$${(rounded / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
  return `$${rounded.toLocaleString('en-US')}`;
}

function formatCurrencySymbol(num, symbol) {
  const rounded = Math.round(num);
  if (rounded === 0) return `${symbol}0`;
  if (rounded >= 1000000000000) return `${symbol}${(rounded / 1000000000000).toFixed(2).replace(/\.00$/, '')}T`;
  if (rounded >= 1000000000) return `${symbol}${(rounded / 1000000000).toFixed(2).replace(/\.00$/, '')}B`;
  if (rounded >= 1000000) return `${symbol}${(rounded / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
  return `${symbol}${rounded.toLocaleString('en-US')}`;
}

function convertValueToTarget(rawText, targetCurrency) {
  const text = stripPostposition(rawText);
  const { usdRate, eurRate, cnyRate, jpyRate } = getActiveRates();
  
  const isJPY = text.includes('엔') || /\b(JPY|yen)\b/i.test(text);
  const isCNY = !isJPY && (text.includes('¥') || /\b(CNY|RMB)\b/i.test(text) || /\byuan\b/i.test(text) || text.includes('위안'));
  const isEUR = !isJPY && !isCNY && (text.includes('€') || /\bEUR\b/i.test(text) || /\beuro(s)?\b/i.test(text) || text.includes('유로'));
  const isUSD = !isJPY && !isCNY && !isEUR && (text.match(enRegex) || text.includes('$') || text.includes('달러') || /\bUSD\b/i.test(text) || text.includes('불'));

  const isSymbolPrefixed = /^[\$€¥]/.test(text);
  const isEnglishUnit = isSymbolPrefixed || /\b(?:T|B|M|Trillion|Billion|Million)\b/i.test(text);

  let baseVal = 0;
  let baseKrwVal = 0;
  let detectTitle = '';
  let originalCurr = 'KRW';

  if (isJPY) {
    baseVal = isEnglishUnit ? parseEnglishNumber(text) : parseKoreanNumber(text);
    baseKrwVal = baseVal * jpyRate;
    detectTitle = '엔화 수치 감지';
    originalCurr = 'JPY';
  } else if (isCNY) {
    baseVal = isEnglishUnit ? parseEnglishNumber(text) : parseKoreanNumber(text);
    baseKrwVal = baseVal * cnyRate;
    detectTitle = '위안화 수치 감지';
    originalCurr = 'CNY';
  } else if (isEUR) {
    baseVal = isEnglishUnit ? parseEnglishNumber(text) : parseKoreanNumber(text);
    baseKrwVal = baseVal * eurRate;
    detectTitle = '유로화 수치 감지';
    originalCurr = 'EUR';
  } else if (isUSD) {
    baseVal = isEnglishUnit ? parseEnglishNumber(text) : parseKoreanNumber(text);
    baseKrwVal = baseVal * usdRate;
    detectTitle = '영미식 수치 감지';
    originalCurr = 'USD';
  } else {
    baseVal = parseKoreanNumber(text);
    baseKrwVal = baseVal;
    detectTitle = '한국식 수치 감지';
    originalCurr = 'KRW';
  }

  const target = targetCurrency || (originalCurr === 'KRW' ? 'USD' : 'KRW');

  let convertedText = '';
  let rateInfoStr = '';

  if (target === 'KRW') {
    convertedText = formatKorean(baseKrwVal);
    rateInfoStr = originalCurr === 'KRW' ? '적용 통화: 원화 (KRW)' : `원화 환산 완료`;
  } else if (target === 'USD') {
    const usdVal = baseKrwVal / usdRate;
    convertedText = formatEnglish(usdVal);
    rateInfoStr = `적용 환율: ₩${usdRate.toLocaleString()}/$`;
  } else if (target === 'EUR') {
    const eurVal = baseKrwVal / eurRate;
    convertedText = formatCurrencySymbol(eurVal, '€');
    rateInfoStr = `적용 환율: ₩${eurRate.toLocaleString()}/€`;
  } else if (target === 'CNY') {
    const cnyVal = baseKrwVal / cnyRate;
    convertedText = formatCurrencySymbol(cnyVal, '¥');
    rateInfoStr = `적용 환율: ₩${cnyRate.toLocaleString()}/위안`;
  } else if (target === 'JPY') {
    const jpyVal = baseKrwVal / jpyRate;
    const jpy100Rate = Math.round(jpyRate * 100);
    convertedText = formatCurrencySymbol(jpyVal, '¥');
    rateInfoStr = `적용 환율: ₩${jpyRate}/¥ (₩${jpy100Rate}/100엔)`;
  }

  return {
    title: detectTitle,
    rawText: `기본 수치: ${baseVal.toLocaleString()}`,
    value: `환율 환산: ${convertedText}`,
    rateInfo: rateInfoStr,
    originalCurr: originalCurr,
    selectedTarget: target
  };
}

function convertValue(text) {
  return convertValueToTarget(text);
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'TD', 'TH', 'TR', 'UL', 'OL', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'BLOCKQUOTE', 'FIGCAPTION', 'FIGURE', 'DD', 'DT', 'DL', 'ADDRESS', 'MAIN']);

function getBlockParent(node) {
  let parent = node.parentElement;
  while (parent) {
    if (BLOCK_TAGS.has(parent.tagName) || parent.tagName === 'BODY') return parent;
    parent = parent.parentElement;
  }
  return document.body;
}

function scanAndHighlight(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'INPUT' || tag === 'TEXTAREA') {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest('.crossscale-highlight') || parent.closest('[contenteditable="true"]') || parent.closest('#crossscale-tooltip')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);

  const blockGroups = new Map();
  let node;
  while ((node = walker.nextNode())) {
    const blockParent = getBlockParent(node);
    if (!blockGroups.has(blockParent)) blockGroups.set(blockParent, []);
    blockGroups.get(blockParent).push(node);
  }

  const combinedRegex = new RegExp(`(${krRegex.source})|(${enRegex.source})`, 'ig');

  for (const nodes of blockGroups.values()) {
    let text = "";
    const textNodes = [];
    for (const n of nodes) {
      const val = n.nodeValue;
      textNodes.push({
        node: n,
        start: text.length,
        end: text.length + val.length
      });
      text += val;
    }

    let match;
    const matches = [];
    combinedRegex.lastIndex = 0; // Reset state for each block
    while ((match = combinedRegex.exec(text)) !== null) {
      if (!match[0].trim()) continue;
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const overlappingNodes = textNodes.filter(tn => tn.start < m.end && tn.end > m.start);
      const highlightElements = [];
      
      for (let j = overlappingNodes.length - 1; j >= 0; j--) {
        const tn = overlappingNodes[j];
        const nodeStart = Math.max(0, m.start - tn.start);
        const nodeEnd = Math.min(tn.node.nodeValue.length, m.end - tn.start);
        
        const originalText = tn.node.nodeValue;
        const beforeStr = originalText.substring(0, nodeStart);
        const matchStr = originalText.substring(nodeStart, nodeEnd);
        const afterStr = originalText.substring(nodeEnd);
        
        const parent = tn.node.parentNode;
        if (!parent) continue;
        
        const afterNode = document.createTextNode(afterStr);
        const span = document.createElement('span');
        span.className = 'crossscale-highlight';
        span.textContent = matchStr;
        const beforeNode = document.createTextNode(beforeStr);

        let origNode;
        if (tn.node.__crossscale_injected) {
            origNode = tn.node.__crossscale_origNode;
            tn.node.replaceWith(beforeNode, span, afterNode);
            if (origNode && origNode.__crossscale_injected_nodes) {
                origNode.__crossscale_injected_nodes.delete(tn.node);
                origNode.__crossscale_injected_nodes.add(beforeNode);
                origNode.__crossscale_injected_nodes.add(span);
                origNode.__crossscale_injected_nodes.add(afterNode);
            }
        } else {
            origNode = tn.node;
            origNode.nodeValue = ""; // Hide original text without removing node to avoid breaking SPA
            
            parent.insertBefore(beforeNode, origNode);
            parent.insertBefore(span, origNode);
            parent.insertBefore(afterNode, origNode);
            
            origNode.__crossscale_injected_nodes = new Set([beforeNode, span, afterNode]);
        }
        
        beforeNode.__crossscale_injected = true;
        span.__crossscale_injected = true;
        afterNode.__crossscale_injected = true;
        
        beforeNode.__crossscale_origNode = origNode;
        span.__crossscale_origNode = origNode;
        afterNode.__crossscale_origNode = origNode;
        
        tn.node = beforeNode;
        
        if (matchStr.trim().length > 0) {
          highlightElements.push(span);
        }
      }
      
      highlightElements.forEach(span => {
        span.addEventListener('mouseenter', (e) => showTooltip(e, m.text));
        span.addEventListener('mouseleave', hideTooltip);
      });
    }
  }
}

let debounceTimer = null;
function debouncedScan() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    scanAndHighlight(document.body);
  }, 500);
}

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach(node => {
          if (node.__crossscale_injected_nodes) {
            node.__crossscale_injected_nodes.forEach(n => {
              if (n.parentNode) n.parentNode.removeChild(n);
            });
            node.__crossscale_injected_nodes.clear();
          }
        });

        mutation.addedNodes.forEach(node => {
          if (node.__crossscale_injected) return;
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (el && el.closest && el.closest('#crossscale-tooltip')) return;
            if (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('crossscale-highlight')) return;
            shouldScan = true;
          }
        });
      } else if (mutation.type === 'characterData') {
        const node = mutation.target;
        if (node.__crossscale_injected_nodes && node.nodeValue !== "") {
          node.__crossscale_injected_nodes.forEach(n => {
            if (n.parentNode) n.parentNode.removeChild(n);
          });
          node.__crossscale_injected_nodes.clear();
        }
        
        if (node.__crossscale_injected) return;

        const el = node.parentElement;
        if (el && el.closest && el.closest('#crossscale-tooltip')) return;
        shouldScan = true;
      }
    }
    if (shouldScan) debouncedScan();
  });
  
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

let currentTooltipText = "";
let activeTargetCurrency = null;

function updateTooltipTarget(targetCurr) {
  if (!currentTooltipText) return;
  activeTargetCurrency = targetCurr;
  const result = convertValueToTarget(currentTooltipText, targetCurr);
  if (!result) return;

  tooltipEl.querySelector('.crossscale-tooltip-title').textContent = result.title;
  tooltipEl.querySelector('.crossscale-tooltip-raw').textContent = result.rawText;
  tooltipEl.querySelector('.crossscale-tooltip-value').textContent = result.value;
  tooltipEl.querySelector('.crossscale-tooltip-rate').textContent = result.rateInfo;

  const buttons = tooltipEl.querySelectorAll('.crossscale-currency-btn');
  buttons.forEach(btn => {
    if (btn.dataset.curr === result.selectedTarget) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function createTooltip() {
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'crossscale-tooltip';
  tooltipEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
      <div class="crossscale-tooltip-title"></div>
    </div>
    
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 6px; padding-bottom: 6px;">
      <div class="crossscale-tooltip-raw" style="font-size: 13px; color: #ced4da;"></div>
      <button class="crossscale-copy-raw" style="background:none; border:none; color:#adb5bd; cursor:pointer; padding:0; margin-left:12px; font-size:14px;" title="기본 수치 복사">📋</button>
    </div>
    
    <div class="crossscale-currency-switch">
      <button class="crossscale-currency-btn" data-curr="KRW">₩ 원</button>
      <button class="crossscale-currency-btn" data-curr="USD">$ 달러</button>
      <button class="crossscale-currency-btn" data-curr="EUR">€ 유로</button>
      <button class="crossscale-currency-btn" data-curr="CNY">¥ 위안</button>
      <button class="crossscale-currency-btn" data-curr="JPY">¥ 엔</button>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div class="crossscale-tooltip-value"></div>
      <button class="crossscale-copy-value" style="background:none; border:none; color:#adb5bd; cursor:pointer; padding:0; margin-left:12px; font-size:14px;" title="환산 수치 복사">📋</button>
    </div>
    
    <div class="crossscale-tooltip-rate" style="margin-top: 6px;"></div>
  `;
  document.body.appendChild(tooltipEl);
  
  tooltipEl.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
  tooltipEl.addEventListener('mouseleave', hideTooltip);
  
  tooltipEl.querySelectorAll('.crossscale-currency-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const curr = btn.dataset.curr;
      updateTooltipTarget(curr);
    });
  });

  document.querySelector('.crossscale-copy-raw').addEventListener('click', (e) => {
    e.stopPropagation();
    const val = tooltipEl.querySelector('.crossscale-tooltip-raw').textContent.replace('기본 수치: ', '');
    navigator.clipboard.writeText(val);
    const btn = e.target;
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1500);
  });
  
  document.querySelector('.crossscale-copy-value').addEventListener('click', (e) => {
    e.stopPropagation();
    const val = tooltipEl.querySelector('.crossscale-tooltip-value').textContent.replace('환율 환산: ', '');
    navigator.clipboard.writeText(val);
    const btn = e.target;
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1500);
  });
}

let hideTimeout = null;

function showTooltip(e, text) {
  clearTimeout(hideTimeout);
  
  const currentUrl = window.location.href;
  const isIgnored = settings.ignoredUrls && settings.ignoredUrls.some(url => currentUrl.startsWith(url));
  
  if (!settings.enabled || isIgnored) return;
  
  currentTooltipText = text;
  const initialResult = convertValueToTarget(text);
  if (!initialResult) return;

  activeTargetCurrency = initialResult.selectedTarget;
  updateTooltipTarget(activeTargetCurrency);
  
  tooltipEl.classList.add('visible');
  
  // Position tooltip
  const rect = e.target.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 5;
  let left = rect.left + window.scrollX;
  
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
  
  // Prevent going off-screen
  requestAnimationFrame(() => {
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let adjustedTop = top;
    let adjustedLeft = left;
    
    if (tooltipRect.right > window.innerWidth) {
      adjustedLeft = window.innerWidth - tooltipRect.width - 10 + window.scrollX;
    }
    if (tooltipRect.bottom > window.innerHeight) {
      adjustedTop = rect.top + window.scrollY - tooltipRect.height - 5;
    }
    
    if (adjustedLeft < window.scrollX) adjustedLeft = window.scrollX + 10;
    if (adjustedTop < window.scrollY) adjustedTop = window.scrollY + 10;

    tooltipEl.style.top = `${adjustedTop}px`;
    tooltipEl.style.left = `${adjustedLeft}px`;
  });
}

function hideTooltip() {
  hideTimeout = setTimeout(() => {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }, 250);
}

init();
