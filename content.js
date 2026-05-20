// content.js
let settings = {
  enabled: true,
  customRateEnabled: false,
  customRate: 1350,
  exchangeRate: 1350,
  ignoredUrls: []
};

// Regex Patterns
const sp = "\\s*";
const numPat = "[0-9]+(?:,[0-9]+)*";
const krRegex = new RegExp(`(?:(?:${numPat})(?:\\.\\d+)?${sp}(?:경|조|억|만|천)${sp})+(?:(?:${numPat})${sp})?(?:원|달러|\\$|억원|만원|조원|경원)?`, "g");
const enRegex = new RegExp(`(?:\\$)${sp}(?:${numPat})(?:\\.\\d+)?${sp}(?:T|B|M|Trillion|Billion|Million)(?:${sp}(?:dollars|USD))?|(?:${numPat})(?:\\.\\d+)?${sp}(?:T|B|M|Trillion|Billion|Million)\\b(?:${sp}(?:dollars|USD))?`, "ig");

// Tooltip Element
let tooltipEl = null;

function init() {
  chrome.storage.local.get(['enabled', 'customRateEnabled', 'customRate', 'exchangeRate', 'ignoredUrls'], (data) => {
    settings = { ...settings, ...data };
    
    const currentUrl = window.location.href;
    const isIgnored = settings.ignoredUrls && settings.ignoredUrls.some(url => currentUrl.startsWith(url));

    if (settings.enabled && !isIgnored) {
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
    if (changes.ignoredUrls) settings.ignoredUrls = changes.ignoredUrls.newValue;
  });
}

function getActiveRate() {
  return settings.customRateEnabled ? settings.customRate : settings.exchangeRate;
}

function parseKoreanNumber(str) {
  let total = 0;
  const parts = str.match(/[\d,]+(?:\.\d+)?\s*(?:경|조|억|만|천)?/g);
  if (!parts) return 0;
  
  for (const part of parts) {
    const numMatch = part.match(/[\d,]+(?:\.\d+)?/);
    if (!numMatch) continue;
    let num = parseFloat(numMatch[0].replace(/,/g, ''));
    if (part.includes('경')) num *= 10000000000000000;
    else if (part.includes('조')) num *= 1000000000000;
    else if (part.includes('억')) num *= 100000000;
    else if (part.includes('만')) num *= 10000;
    else if (part.includes('천')) num *= 1000;
    total += num;
  }
  return total;
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
  
  if (gyeong > 0) result += `${gyeong.toLocaleString()}경 `;
  if (jo > 0) result += `${jo.toLocaleString()}조 `;
  if (uk > 0) result += `${uk.toLocaleString()}억 `;
  if (man > 0) result += `${man.toLocaleString()}만 `;
  
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
  
  if (text.match(enRegex) || text.includes('$') || text.includes('달러') || text.includes('USD')) {
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
    
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div class="crossscale-tooltip-value"></div>
      <button class="crossscale-copy-value" style="background:none; border:none; color:#adb5bd; cursor:pointer; padding:0; margin-left:12px; font-size:14px;" title="환산 수치 복사">📋</button>
    </div>
    
    <div class="crossscale-tooltip-rate" style="margin-top: 6px;"></div>
  `;
  document.body.appendChild(tooltipEl);
  
  tooltipEl.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
  tooltipEl.addEventListener('mouseleave', hideTooltip);
  
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
  const result = convertValue(text);
  if (!result) return;
  
  tooltipEl.querySelector('.crossscale-tooltip-title').textContent = result.title;
  tooltipEl.querySelector('.crossscale-tooltip-raw').textContent = result.rawText;
  tooltipEl.querySelector('.crossscale-tooltip-value').textContent = result.value;
  tooltipEl.querySelector('.crossscale-tooltip-rate').textContent = result.rateInfo;
  
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
