// 集計ロジック
// 元JS(table10__2_.js)の createMonthlySummary() / createDailySummary() を
// Node.js 用に忠実に移植する。HTML は生成しない、純粋な集計オブジェクトのみ返す。

import { A, B } from './config.js';
import { fetchAppA, fetchAppB, fetchWaitCountsByStaff } from './fetch.js';
import {
  numVal,
  getNumByFieldCodes,
  contractNetFromRecord,
  percentInt,
  toJSTDateString
} from './utils.js';

// ------- 月間集計 ------------------------------------------------------------
// ym: "YYYY-MM"
export async function aggregateMonthly(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const startStr = toJSTDateString(start);
  const endStr = toJSTDateString(end);

  // Aアプリ(日報) 月間 "最終" レコード
  const qA = `${A.date} >= "${startStr}" and ${A.date} <= "${endStr}" and ${A.report} in ("最終")`;
  const recA = await fetchAppA(qA);

  // Bアプリ(目標管理) 当月
  const qB = `${B.start} = "${startStr}" and ${B.last} = "${endStr}"`;
  const recB = await fetchAppB(qB);

  const bMap = {};
  for (const r of recB) {
    const staffName = r[B.staff] ? r[B.staff].value : '';
    if (!staffName) continue;
    bMap[staffName] = r;
  }

  // 担当者ごとの集計(元JS と同じキー c,con,kp)
  const sum = {};
  Object.keys(bMap).forEach(n => { sum[n] = { c: 0, con: 0, kp: 0 }; });

  for (const r of recA) {
    const n = r[A.staff] ? r[A.staff].value : '';
    if (!n) continue;
    if (!sum[n]) sum[n] = { c: 0, con: 0, kp: 0 };
    sum[n].c++;
    sum[n].con += contractNetFromRecord(r, A);
    sum[n].kp += numVal(r[A.kp] && r[A.kp].value != null ? r[A.kp].value : 0);
  }

  // Cアプリ(対応待ち) — 対象担当者全員分を取得
  const staffNamesAll = Object.keys(sum);
  const waitMap = await fetchWaitCountsByStaff(staffNamesAll);

  // 担当者ごとの行を構築
  const rowsAll = [];
  for (const n of Object.keys(sum)) {
    const a = sum[n] || { c: 0, con: 0, kp: 0 };
    const b = bMap[n] || {};

    const sch = numVal(b[B.schedule] && b[B.schedule].value != null ? b[B.schedule].value : 0);
    const goal = numVal(b[B.goal] && b[B.goal].value != null ? b[B.goal].value : 0);
    const last = numVal(b[B.lastKp] && b[B.lastKp].value != null ? b[B.lastKp].value : 0);

    const prevRankRaw = (b[B.ranking] && b[B.ranking].value != null)
      ? String(b[B.ranking].value).trim()
      : '';
    const prevRankVal = (prevRankRaw !== '' && !isNaN(Number(prevRankRaw)))
      ? Number(prevRankRaw)
      : null;
    const prevRankDisp = (prevRankVal === null) ? '-' : String(prevRankVal);

    const bRecId = (b.$id && b.$id.value != null && !isNaN(Number(b.$id.value)))
      ? Number(b.$id.value)
      : Number.POSITIVE_INFINITY;

    const prevCon = numVal(b[B.contractLastMonth] && b[B.contractLastMonth].value != null
      ? b[B.contractLastMonth].value : 0);
    const prevPrevCon = numVal(b[B.contractTwoMonthsAgo] && b[B.contractTwoMonthsAgo].value != null
      ? b[B.contractTwoMonthsAgo].value : 0);
    const past2Con = prevCon + prevPrevCon;

    const waitCount = numVal(waitMap[n] || 0);
    const defectPercent = percentInt(waitCount, past2Con);

    const need = sch ? Math.ceil(goal / sch * 100) / 100 : 0;
    const fore = a.c ? Math.floor(a.kp / a.c * sch * 100) / 100 : 0;
    const prog = (a.c ? (a.kp / a.c) : 0) / (sch ? (goal / sch) : 1) * 100;

    rowsAll.push({
      n,
      bRecId,
      sch,
      goal,
      need,
      c: a.c,
      con: a.con,
      kp: a.kp,
      prog,
      fore,
      last,
      prevRankVal,
      prevRankDisp,
      prevCon,
      prevPrevCon,
      past2Con,
      waitCount,
      defectPercent,
      thisRank: null
    });
  }

  // 順位タイブレーク: 現pt降順 → 前月pt → 前月件数 → 前々月件数 → bRecId昇順
  rowsAll.sort((a, b) => {
    const ak = Number(a.kp || 0);
    const bk = Number(b.kp || 0);
    if (bk !== ak) return bk - ak;

    const al = Number(a.last || 0);
    const bl = Number(b.last || 0);
    if (bl !== al) return bl - al;

    const apc = Number(a.prevCon || 0);
    const bpc = Number(b.prevCon || 0);
    if (bpc !== apc) return bpc - apc;

    const appc = Number(a.prevPrevCon || 0);
    const bppc = Number(b.prevPrevCon || 0);
    if (bppc !== appc) return bppc - appc;

    return a.bRecId - b.bRecId;
  });

  for (let i = 0; i < rowsAll.length; i++) {
    rowsAll[i].thisRank = i + 1;
  }

  // TOP3リスト作成(各指標ごとに降順→bRecId昇順、上位3名の氏名)
  function top3Desc(key) {
    return [...rowsAll].sort((a, b) => {
      const av = Number(a[key] || 0);
      const bv = Number(b[key] || 0);
      if (bv !== av) return bv - av;
      return a.bRecId - b.bRecId;
    }).slice(0, 3).map(r => r.n);
  }

  const tops = {
    con: top3Desc('con'),
    kp: top3Desc('kp'),
    prog: top3Desc('prog'),
    fore: top3Desc('fore'),
    last: top3Desc('last'),
    prevCon: top3Desc('prevCon'),
    prevPrevCon: top3Desc('prevPrevCon'),
    past2Con: top3Desc('past2Con')
  };

  // 全合計の再計算(元JS と同じロジック)
  const total = {
    c: 0, con: 0, kp: 0, sch: 0, goal: 0,
    fore: 0, last: 0, prevCon: 0, prevPrevCon: 0, past2Con: 0, waitCount: 0
  };
  for (const r of rowsAll) {
    total.c += r.c;
    total.con += r.con;
    total.kp += r.kp;
    total.sch += r.sch;
    total.goal += r.goal;
    total.fore += r.fore;
    total.last += r.last;
    total.prevCon += r.prevCon;
    total.prevPrevCon += r.prevPrevCon;
    total.past2Con += r.past2Con;
    total.waitCount += r.waitCount;
  }
  const totalProg = (total.c && total.sch && total.goal)
    ? (total.kp / total.c) / (total.goal / total.sch) * 100
    : 0;
  const totalDefectPercent = percentInt(total.waitCount, total.past2Con);

  return {
    title: `${ym} 集計`,
    ym,
    rows: rowsAll,
    tops,
    total: { ...total, prog: totalProg, defectPercent: totalDefectPercent }
  };
}

// ------- 単日集計 ------------------------------------------------------------
// dateStr: "YYYY-MM-DD"
export async function aggregateDaily(dateStr) {
  // 当日 "最終"
  const qDay = `${A.date} = "${dateStr}" and ${A.report} in ("最終")`;
  const recDay = await fetchAppA(qDay);

  // 当月累計 "最終" (月初〜当日)
  const monthStart = dateStr.slice(0, 8) + '01';
  const qMonth = `${A.date} >= "${monthStart}" and ${A.date} <= "${dateStr}" and ${A.report} in ("最終")`;
  const recMonth = await fetchAppA(qMonth);

  const dayByStaff = {};
  for (const r of recDay) {
    const n = r[A.staff] ? r[A.staff].value : '';
    if (!n) continue;
    if (!dayByStaff[n]) {
      dayByStaff[n] = { visits: 0, negotiation: 0, dentou: 0, douryoku: 0, kp: 0, con: 0 };
    }
    dayByStaff[n].visits += getNumByFieldCodes(r, [A.visits]);
    // 元JS は ['商談数'] (日本語フィールドコード) で取得していた点に注意
    dayByStaff[n].negotiation += getNumByFieldCodes(r, ['商談数']);
    dayByStaff[n].dentou += getNumByFieldCodes(r, [A.business_dentou_total]);
    dayByStaff[n].douryoku += getNumByFieldCodes(r, [A.business_douryoku_total]);
    dayByStaff[n].kp += getNumByFieldCodes(r, [A.kp]);
    dayByStaff[n].con += contractNetFromRecord(r, A);
  }

  const monthByStaff = {};
  for (const r of recMonth) {
    const n = r[A.staff] ? r[A.staff].value : '';
    if (!n) continue;
    if (!monthByStaff[n]) monthByStaff[n] = { kp: 0, con: 0 };
    monthByStaff[n].kp += getNumByFieldCodes(r, [A.kp]);
    monthByStaff[n].con += contractNetFromRecord(r, A);
  }

  const staffNames = Object.keys(dayByStaff);
  const workingCount = staffNames.length;

  const rows = staffNames.map(n => {
    const d = dayByStaff[n] || { visits: 0, negotiation: 0, dentou: 0, douryoku: 0, kp: 0, con: 0 };
    const mv = monthByStaff[n] || { kp: 0, con: 0 };
    return {
      n,
      day_visits: d.visits,
      day_negotiation: d.negotiation,
      day_dentou: d.dentou,
      day_douryoku: d.douryoku,
      day_kp: d.kp,
      month_kp: mv.kp,
      day_con: d.con,
      month_con: mv.con,
      dayRank: null
    };
  });

  // 順位タイブレーク: 当日kp → 月間kp → 当日成約 → 月間成約 → 氏名(日本語ソート)
  rows.sort((a, b) => {
    const a1 = Number(a.day_kp || 0);
    const b1 = Number(b.day_kp || 0);
    if (b1 !== a1) return b1 - a1;

    const a2 = Number(a.month_kp || 0);
    const b2 = Number(b.month_kp || 0);
    if (b2 !== a2) return b2 - a2;

    const a3 = Number(a.day_con || 0);
    const b3 = Number(b.day_con || 0);
    if (b3 !== a3) return b3 - a3;

    const a4 = Number(a.month_con || 0);
    const b4 = Number(b.month_con || 0);
    if (b4 !== a4) return b4 - a4;

    return String(a.n).localeCompare(String(b.n), 'ja');
  });

  for (let i = 0; i < rows.length; i++) {
    rows[i].dayRank = i + 1;
  }

  function top3Desc(key) {
    return [...rows].sort((a, b) => {
      const av = Number(a[key] || 0);
      const bv = Number(b[key] || 0);
      if (bv !== av) return bv - av;

      const ar = Number(a.dayRank || 0);
      const br = Number(b.dayRank || 0);
      if (ar !== br) return ar - br;

      return String(a.n).localeCompare(String(b.n), 'ja');
    }).slice(0, 3).map(r => r.n);
  }

  const tops = {
    day_visits: top3Desc('day_visits'),
    day_negotiation: top3Desc('day_negotiation'),
    day_dentou: top3Desc('day_dentou'),
    day_douryoku: top3Desc('day_douryoku'),
    day_kp: top3Desc('day_kp'),
    month_kp: top3Desc('month_kp'),
    day_con: top3Desc('day_con'),
    month_con: top3Desc('month_con')
  };

  const total = {
    visits: 0, negotiation: 0, dentou: 0, douryoku: 0,
    day_kp: 0, month_kp: 0, day_con: 0, month_con: 0
  };
  for (const r of rows) {
    total.visits += Number(r.day_visits || 0);
    total.negotiation += Number(r.day_negotiation || 0);
    total.dentou += Number(r.day_dentou || 0);
    total.douryoku += Number(r.day_douryoku || 0);
    total.day_kp += Number(r.day_kp || 0);
    total.month_kp += Number(r.month_kp || 0);
    total.day_con += Number(r.day_con || 0);
    total.month_con += Number(r.month_con || 0);
  }

  return {
    title: `${dateStr} 集計`,
    dateStr,
    workingCount,
    rows,
    tops,
    total
  };
}
