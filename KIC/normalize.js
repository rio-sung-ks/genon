
function extractString(v) {
  // JSON 형태라면 label/name/value 키 우선 추출
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const cands = ['label', 'value', 'type', 'name', 'route'];
    for (const k of cands) {
      if (typeof v[k] === 'string') return v[k];
    }
    // 객체 전체를 문자열로
    try { return JSON.stringify(v); } catch { return ''; }
  }
  return String(v ?? '');
}

let raw = $type;

// 문자열인 경우 파싱 시도
try {
  const maybeObj = JSON.parse(String($type));
  raw = extractString(maybeObj);
} catch {
  raw = extractString($type);
}

// 공백/따옴표/백틱 제거 + 대문자
let norm = String(raw)
  .trim()
  .toUpperCase()
  .replace(/["'`]/g, '');

// 알파벳/밑줄/하이픈 외 제거
norm = norm.replace(/[^A-Z_-]/g, '');

// 최종 매핑 (이외 값은 RAG로 폴백)
let out;
if (norm === 'DA') {
  out = 'DA';
} else if (norm === 'CANNOT_DA') {
  out = 'CANNOT_DA';
} else {
  out = 'GENERAL';
}

return out;
