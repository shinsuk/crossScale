// test.js - CrossScale Chrome Extension Unit Test Suite
const assert = require('assert');

// Mock chrome.storage and DOM for testing environment
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb({}),
      set: () => {}
    },
    onChanged: {
      addListener: () => {}
    }
  }
};

const makeMockElem = () => ({
  appendChild: () => {},
  addEventListener: () => {},
  querySelector: () => makeMockElem(),
  querySelectorAll: () => [makeMockElem()],
  classList: { add: () => {}, remove: () => {} },
  style: {}
});

global.window = { location: { href: 'http://localhost' } };
global.document = {
  createElement: makeMockElem,
  querySelector: () => makeMockElem(),
  querySelectorAll: () => [makeMockElem()],
  body: makeMockElem(),
  createTreeWalker: () => ({ nextNode: () => null })
};
global.NodeFilter = { SHOW_TEXT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
global.MutationObserver = class {
  observe() {}
  disconnect() {}
};

// Load logic from content.js
const fs = require('fs');
let contentCode = fs.readFileSync('./content.js', 'utf8');
// Expose krRegex and enRegex globally for testing
contentCode += '\nglobal.krRegex = krRegex;\nglobal.enRegex = enRegex;';

// Evaluate content.js within test scope
eval(contentCode);

let passedCount = 0;
let failedCount = 0;

function runTest(description, testFn) {
  try {
    testFn();
    console.log(`  ✅ PASS: ${description}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failedCount++;
  }
}

console.log('====================================================');
console.log('🧪 CrossScale 확장 프로그램 종합 단위 테스트 시작');
console.log('====================================================\n');

// 1. 조사 정제 (stripPostposition) 테스트
console.log('[카테고리 1] 조사 정제 (stripPostposition) 테스트');
runTest('조사 "를" 정제 ("3,500유로를" -> "3,500유로")', () => {
  assert.strictEqual(stripPostposition("3,500유로를"), "3,500유로");
});
runTest('조사 "으로" 정제 ("270만 엔으로" -> "270만 엔")', () => {
  assert.strictEqual(stripPostposition("270만 엔으로"), "270만 엔");
});
runTest('조사 "을" 정제 ("$1,000을" -> "$1,000")', () => {
  assert.strictEqual(stripPostposition("$1,000을"), "$1,000");
});
runTest('조사 "은" 정제 ("5천만원은" -> "5천만원")', () => {
  assert.strictEqual(stripPostposition("5천만원은"), "5천만원");
});
runTest('유로 끝 글자 "로" 보존 ("3,500유로" -> "3,500유로")', () => {
  assert.strictEqual(stripPostposition("3,500유로"), "3,500유로");
});

console.log('\n[카테고리 2] 수치 파싱 엔진 (parseKoreanNumber & parseEnglishNumber) 테스트');
runTest('한국어 대형 단위 파싱 ("12조 5,000억")', () => {
  assert.strictEqual(parseKoreanNumber("12조 5,000억"), 12500000000000);
});
runTest('한국어 만 단위 파싱 ("3,400만")', () => {
  assert.strictEqual(parseKoreanNumber("3,400만"), 34000000);
});
runTest('한국어 천 단위 파싱 ("5천만")', () => {
  assert.strictEqual(parseKoreanNumber("5천만"), 50000000);
});
runTest('영문 B 단위 파싱 ("$1.5B")', () => {
  assert.strictEqual(parseEnglishNumber("$1.5B"), 1500000000);
});
runTest('영문 T/B/M 생략 기호 수치 파싱 ("$8,970,000")', () => {
  assert.strictEqual(parseEnglishNumber("$8,970,000"), 8970000);
});

console.log('\n[카테고리 3] 화폐별 정규식 및 파싱 감지 테스트');
runTest('유로화 + 조사 감지 ("3,500유로를")', () => {
  const res = convertValueToTarget("3,500유로를", "KRW");
  assert.strictEqual(res.title, "유로화 수치 감지");
  assert.strictEqual(res.rawText, "기본 수치: 3,500");
  assert.strictEqual(res.value, "환율 환산: 511만원");
});

runTest('엔화 + 조사 감지 ("270만 엔으로")', () => {
  const res = convertValueToTarget("270만 엔으로", "KRW");
  assert.strictEqual(res.title, "엔화 수치 감지");
  assert.strictEqual(res.rawText, "기본 수치: 2,700,000");
  assert.strictEqual(res.value, "환율 환산: 2,430만원");
});

runTest('T/B/M 생략 달러 + 조사 감지 ("$1,000을")', () => {
  const res = convertValueToTarget("$1,000을", "KRW");
  assert.strictEqual(res.title, "영미식 수치 감지");
  assert.strictEqual(res.rawText, "기본 수치: 1,000");
  assert.strictEqual(res.value, "환율 환산: 135만원");
});

runTest('T/B/M 생략 대형 달러 금액 감지 ("$8,970,000")', () => {
  const res = convertValueToTarget("$8,970,000", "KRW");
  assert.strictEqual(res.title, "영미식 수치 감지");
  assert.strictEqual(res.rawText, "기본 수치: 8,970,000");
  assert.strictEqual(res.value, "환율 환산: 121억 950만원");
});

runTest('위안화 감지 ("500억 위안")', () => {
  const res = convertValueToTarget("500억 위안", "KRW");
  assert.strictEqual(res.title, "위안화 수치 감지");
  assert.strictEqual(res.value, "환율 환산: 9조 3,500억원");
});

console.log('\n[카테고리 4] 동적 통화 교차 변환 (In-Tooltip Currency Switcher) 테스트');
runTest('유로화 -> 달러($) 스위치 변환 ("3,500유로" -> USD)', () => {
  const res = convertValueToTarget("3,500유로", "USD");
  assert.strictEqual(res.selectedTarget, "USD");
  assert.strictEqual(res.value, "환율 환산: $3,785");
});

runTest('유로화 -> 엔화(¥) 스위치 변환 ("3,500유로" -> JPY)', () => {
  const res = convertValueToTarget("3,500유로", "JPY");
  assert.strictEqual(res.selectedTarget, "JPY");
  assert.strictEqual(res.value, "환율 환산: ¥567,778");
});

runTest('원화 -> 달러($) 스위치 변환 ("5000만원" -> USD)', () => {
  const res = convertValueToTarget("5000만원", "USD");
  assert.strictEqual(res.selectedTarget, "USD");
  assert.strictEqual(res.value, "환율 환산: $37,037");
});

console.log('\n[카테고리 5] 실제 트윗 문장 전체 패턴 추출 테스트');
runTest('트윗 문장 내 $ 기호 수치 7개 전체 추출 검증', () => {
  const tweetText = `
15년 전 오늘 $1,000을 투자했다면 그 가치는 다음과 같을 것입니다:
• 비트코인: $8,970,000
• 엔비디아: $735,000
• 테슬라: $231,000
• 애플: $29,000
• S&P: $8,400
• 금: $2,150
  `;
  
  const combinedRegex = new RegExp(`(${global.krRegex.source})|(${global.enRegex.source})`, 'ig');
  const matches = [];
  let match;
  while ((match = combinedRegex.exec(tweetText)) !== null) {
    if (match[0].trim()) {
      matches.push(stripPostposition(match[0].trim()));
    }
  }

  const expected = ["$1,000", "$8,970,000", "$735,000", "$231,000", "$29,000", "$8,400", "$2,150"];
  assert.deepStrictEqual(matches, expected);
});

console.log('\n====================================================');
console.log(`📊 테스트 결과: 총 ${passedCount + failedCount}개 검증 중 ${passedCount}개 성공, ${failedCount}개 실패`);
console.log('====================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
