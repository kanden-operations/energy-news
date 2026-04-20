// 元JS(table10__2_.js)の数値ヘルパを同じ挙動で再現する

export function numVal(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// 複数フィールドコード候補のうち、値が入っている最初のものを数値で返す
// 例: getNumByFieldCodes(rec, ['商談数']) のように元JSが単一配列でも呼び出す
export function getNumByFieldCodes(rec, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  for (const c of list) {
    if (!c) continue;
    if (rec[c] && rec[c].value != null && rec[c].value !== '') {
      return numVal(rec[c].value);
    }
  }
  return 0;
}

// 成約数 = contract - travel_allowance (元JS contractNetFromRecord)
export function contractNetFromRecord(rec, A) {
  const c = numVal(rec[A.contract] && rec[A.contract].value != null ? rec[A.contract].value : 0);
  const t = numVal(rec[A.travel] && rec[A.travel].value != null ? rec[A.travel].value : 0);
  return c - t;
}

// 不備割合(整数%): Math.round(w / b * 100)
export function percentInt(waitCount, baseCount) {
  const b = Number(baseCount || 0);
  const w = Number(waitCount || 0);
  if (!b) return 0;
  return Math.round((w / b) * 100);
}


// JST 時刻 (Node.js 側で利用)
// サーバのタイムゾーン(GitHub Actions=UTC)に依存せず JST 基準で日付を返す
export function nowJST() {
  return new Date();
}

export function toJSTDateString(date) {
  // Intl.DateTimeFormat で直接 JST の "YYYY-MM-DD" を組み立てる
  // (元JSの toLocaleString 二重変換はブラウザJST前提で、Node/UTCサーバでは1日ずれる)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}




// kintone のクエリ値エスケープ
export function escapeQueryValue(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// HTML エスケープ(テンプレ埋め込み用)
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
