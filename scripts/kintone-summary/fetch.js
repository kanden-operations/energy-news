// kintone API 取得層
// - 500件ずつページング
// - 担当者名チャンク分割(Cアプリ用・40名ずつ)
// - 読み取り(GET)専用。書き込みは絶対にしない。

import { A_APP_ID, B_APP_ID, C_APP_ID, C, envConfig } from './config.js';
import { escapeQueryValue } from './utils.js';

async function getAllRecords({ subdomain, token, appId, query, fields }) {
  const all = [];
  let offset = 0;
  while (true) {
    const url = new URL(`https://${subdomain}.cybozu.com/k/v1/records.json`);
    url.searchParams.set('app', String(appId));
    url.searchParams.set('query', `${query} limit 500 offset ${offset}`);
    if (Array.isArray(fields) && fields.length) {
      fields.forEach((f, i) => url.searchParams.append(`fields[${i}]`, f));
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-Cybozu-API-Token': token }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`kintone API error (app=${appId} status=${res.status}): ${text}`);
    }
    const data = await res.json();
    all.push(...data.records);
    if (data.records.length < 500) break;
    offset += 500;
  }
  return all;
}

export async function fetchAppA(query, fields) {
  const { subdomain, tokenA } = envConfig();
  return getAllRecords({ subdomain, token: tokenA, appId: A_APP_ID, query, fields });
}

export async function fetchAppB(query, fields) {
  const { subdomain, tokenB } = envConfig();
  return getAllRecords({ subdomain, token: tokenB, appId: B_APP_ID, query, fields });
}

export async function fetchAppC(query, fields) {
  const { subdomain, tokenC } = envConfig();
  return getAllRecords({ subdomain, token: tokenC, appId: C_APP_ID, query, fields });
}

// Cアプリ(契約管理)から担当者ごとの対応待ち件数を集計
// 元JS の getWaitCountsByStaff と同じ挙動(40名ずつチャンク分割)
export async function fetchWaitCountsByStaff(staffNames) {
  const waitMap = {};
  const names = (staffNames || []).filter(Boolean);
  if (!names.length) return waitMap;

  const CHUNK = 40;
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK).map(n => `"${escapeQueryValue(n)}"`);
    const q = `${C.status} in ("対応待ち") and ${C.staff} in (${chunk.join(',')})`;
    const recs = await fetchAppC(q, [C.staff, C.status]);
    for (const r of recs) {
      const name = r[C.staff] ? r[C.staff].value : '';
      if (!name) continue;
      waitMap[name] = (waitMap[name] || 0) + 1;
    }
  }
  return waitMap;
}
