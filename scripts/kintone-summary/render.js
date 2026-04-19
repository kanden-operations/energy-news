// aggregate.js の結果を HTML 文字列に変換する
// 元JS(table10__2_.js)のセル組み立てロジックを忠実に移植
// - TOP3 のセルに rank1/2/3 クラス + メダル + グラデ背景
// - 不備% に応じて defect10 / defect15 クラスを付与

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readTemplate(name) {
  return fs.readFileSync(path.join(__dirname, 'templates', name), 'utf8');
}
function readStyle() {
  return fs.readFileSync(path.join(__dirname, 'templates', 'style.css'), 'utf8');
}

// メダルSVG(元JS medalSvgData と同一。ただし data URI は文字列埋め込みする)
function medalSvgData(rank) {
  let fill = '#d4af37';
  if (rank === 2) fill = '#c0c0c0';
  if (rank === 3) fill = '#cd7f32';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
      `<defs>` +
        `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>` +
          `<stop offset="0.35" stop-color="${fill}" stop-opacity="1"/>` +
          `<stop offset="0.7" stop-color="#ffffff" stop-opacity="0.55"/>` +
          `<stop offset="1" stop-color="${fill}" stop-opacity="1"/>` +
        `</linearGradient>` +
      `</defs>` +
      `<path d="M18 4h10l4 10-8 6-8-6 2-10z" fill="#e74c3c"/>` +
      `<path d="M36 4h10l2 10-8 6-8-6 4-10z" fill="#3498db"/>` +
      `<circle cx="32" cy="40" r="16" fill="url(#g)" stroke="#111" stroke-width="2"/>` +
      `<circle cx="32" cy="40" r="10" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function rankClassByRankNum(rank) {
  if (rank === 1) return 'rank1';
  if (rank === 2) return 'rank2';
  if (rank === 3) return 'rank3';
  return '';
}
function medalBgByRank(rank) {
  if (rank === 1) return 'linear-gradient(135deg,#8f6b1f,#f5d76e,#fff7c2,#f5d76e,#8f6b1f)';
  if (rank === 2) return 'linear-gradient(135deg,#777,#eee,#fff,#eee,#777)';
  if (rank === 3) return 'linear-gradient(135deg,#6b3e1e,#d98c4a,#ffd8b0,#d98c4a,#6b3e1e)';
  return '';
}
function prevRankIsTop3(v) {
  return v === 1 || v === 2 || v === 3;
}
function defectClass(p) {
  const v = Number(p || 0);
  if (v > 15) return 'defect15';
  if (v > 10) return 'defect10';
  return '';
}

function tplReplace(tpl, map) {
  return tpl
    .replace(/\{\{TITLE\}\}/g, escapeHtml(map.TITLE))
    .replace(/\{\{STYLE\}\}/g, map.STYLE) // CSSはエスケープしない
    .replace(/\{\{HEADER\}\}/g, map.HEADER)
    .replace(/\{\{ROWS\}\}/g, map.ROWS)
    .replace(/\{\{TOTAL\}\}/g, map.TOTAL);
}

// ------- 月間集計 HTML -------------------------------------------------------
export function renderMonthly(summary) {
  const tpl = readTemplate('monthly.html');
  const style = readStyle();
  const { title, rows, tops, total } = summary;

  const header = `<tr style="background:#dde9ff;font-weight:bold">
<th style="width:80px;">当月順位</th>
<th style="width:100px;">担当者名</th>
<th style="width:70px;">稼動予定<br>日数</th>
<th style="width:50px;">月間<br>目標P</th>
<th style="width:80px;">1日あたり<br>必要ｐｔ</th>
<th style="width:50px;">稼働<br>日数</th>
<th style="width:80px;">成約数</th>
<th style="width:80px;">現pt</th>
<th style="width:80px;">進捗％</th>
<th style="width:80px;">着地予想</th>
<th style="width:80px;">前月pt</th>
<th style="width:80px;">前月順位</th>
<th style="width:90px;">前月件数</th>
<th style="width:90px;">前々月件数</th>
<th style="width:110px;">過去2ヵ月<br>合計件数</th>
<th style="width:90px;">対応待ち<br>件数</th>
<th style="width:90px;">不備件数<br>割合</th>
</tr>`;

  function bg(list, name) {
    const i = list.indexOf(name);
    return i >= 0 ? medalBgByRank(i + 1) : '';
  }
  function rankClass(list, name) {
    const i = list.indexOf(name);
    if (i === 0) return 'rank1';
    if (i === 1) return 'rank2';
    if (i === 2) return 'rank3';
    return '';
  }

  const rowsHtml = rows.map((r, idx) => {
    const bgRow = (idx % 2) ? '#f6f9ff' : '#fff';
    const thisRank = Number(r.thisRank || 0);
    const thisRankCls = rankClassByRankNum(thisRank);
    const thisRankBg = medalBgByRank(thisRank);
    const thisMedal = (thisRank >= 1 && thisRank <= 3)
      ? `<img class="rank-medal" src="${medalSvgData(thisRank)}" alt="">`
      : '';

    const prevRankNum = (r.prevRankVal == null) ? null : Number(r.prevRankVal);
    const prevRankCls = prevRankIsTop3(prevRankNum) ? rankClassByRankNum(prevRankNum) : '';
    const prevRankBg = prevRankIsTop3(prevRankNum) ? medalBgByRank(prevRankNum) : '';

    const topRowCls = (thisRank >= 1 && thisRank <= 3) ? thisRankCls : '';
    const topRowBg = (thisRank >= 1 && thisRank <= 3) ? medalBgByRank(thisRank) : '';

    return `<tr style="background:${bgRow}">
<td class="lux-cell rank-cell ${thisRankCls}" style="background:${thisRankBg}">
  <div class="rank-cell-inner">${thisMedal}<span>${thisRank || '-'}</span></div>
</td>
<td class="lux-cell ${topRowCls}" style="background:${topRowBg}">${escapeHtml(r.n)}</td>
<td class="lux-cell ${topRowCls}" style="background:${topRowBg}">${r.sch}</td>
<td class="lux-cell ${topRowCls}" style="background:${topRowBg}">${r.goal}</td>
<td class="lux-cell ${topRowCls}" style="background:${topRowBg}">${Number(r.need).toFixed(2)}</td>
<td class="lux-cell ${topRowCls}" style="background:${topRowBg}">${r.c}</td>

<td class="lux-cell ${rankClass(tops.con, r.n)}" style="background:${bg(tops.con, r.n)}">${r.con}</td>
<td class="lux-cell ${rankClass(tops.kp, r.n)}" style="background:${bg(tops.kp, r.n)}">${r.kp}</td>
<td class="lux-cell ${rankClass(tops.prog, r.n)}" style="background:${bg(tops.prog, r.n)}">${Number(r.prog).toFixed(1)}%</td>
<td class="lux-cell ${rankClass(tops.fore, r.n)}" style="background:${bg(tops.fore, r.n)}">${Number(r.fore).toFixed(2)}</td>

<td class="lux-cell ${rankClass(tops.last, r.n)}" style="background:${bg(tops.last, r.n)}">${r.last}</td>

<td class="lux-cell ${prevRankCls}" style="background:${prevRankBg}">${escapeHtml(r.prevRankDisp)}</td>

<td class="lux-cell ${rankClass(tops.prevCon, r.n)}" style="background:${bg(tops.prevCon, r.n)}">${r.prevCon}</td>
<td class="lux-cell ${rankClass(tops.prevPrevCon, r.n)}" style="background:${bg(tops.prevPrevCon, r.n)}">${r.prevPrevCon}</td>
<td class="lux-cell ${rankClass(tops.past2Con, r.n)}" style="background:${bg(tops.past2Con, r.n)}">${r.past2Con}</td>

<td class="${defectClass(r.defectPercent)}">${r.waitCount}</td>
<td class="${defectClass(r.defectPercent)}">${r.defectPercent}%</td>
</tr>`;
  }).join('\n');

  const totalDefectCls = defectClass(total.defectPercent);
  const totalHtml = `<tr style="background:#ffe0b2">
<td colspan="5" style="font-weight:bold;text-align:center;">全合計</td>
<td>${total.c}</td>
<td>${total.con}</td>
<td>${total.kp}</td>
<td>${Number(total.prog).toFixed(1)}%</td>
<td>${Number(total.fore).toFixed(2)}</td>
<td>${total.last}</td>
<td>-</td>
<td>${total.prevCon}</td>
<td>${total.prevPrevCon}</td>
<td>${total.past2Con}</td>
<td class="${totalDefectCls}">${total.waitCount}</td>
<td class="${totalDefectCls}">${total.defectPercent}%</td>
</tr>`;

  return tplReplace(tpl, {
    TITLE: title,
    STYLE: style,
    HEADER: header,
    ROWS: rowsHtml,
    TOTAL: totalHtml
  });
}

// ------- 単日集計 HTML -------------------------------------------------------
export function renderDaily(summary) {
  const tpl = readTemplate('daily.html');
  const style = readStyle();
  const { title, rows, tops, total, workingCount } = summary;

  const header = `<tr style="background:#dde9ff;font-weight:bold">
<th style="width:80px;">当日順位</th>
<th style="width:120px;">担当者名</th>
<th style="width:70px;">訪問数</th>
<th style="width:70px;">商談数</th>
<th style="width:90px;">ビジネス<br>電灯</th>
<th style="width:90px;">ビジネス<br>動力</th>
<th style="width:80px;">当日pt</th>
<th style="width:80px;">月間pt</th>
<th style="width:80px;">当日件数</th>
<th style="width:80px;">月間件数</th>
</tr>`;

  function bg(list, name) {
    const i = list.indexOf(name);
    return i >= 0 ? medalBgByRank(i + 1) : '';
  }
  function rankClass(list, name) {
    const i = list.indexOf(name);
    if (i === 0) return 'rank1';
    if (i === 1) return 'rank2';
    if (i === 2) return 'rank3';
    return '';
  }

  const rowsHtml = rows.map((r, idx) => {
    const bgRow = (idx % 2) ? '#f6f9ff' : '#fff';
    const rankNum = Number(r.dayRank || 0);
    const rankCls = rankClassByRankNum(rankNum);
    const rankBg = medalBgByRank(rankNum);
    const medal = (rankNum >= 1 && rankNum <= 3)
      ? `<img class="rank-medal" src="${medalSvgData(rankNum)}" alt="">`
      : '';

    const staffTopCls = (rankNum >= 1 && rankNum <= 3) ? rankCls : '';
    const staffTopBg = (rankNum >= 1 && rankNum <= 3) ? rankBg : '';

    return `<tr style="background:${bgRow}">
<td class="lux-cell rank-cell ${rankCls}" style="background:${rankBg}">
  <div class="rank-cell-inner">${medal}<span>${rankNum || '-'}</span></div>
</td>
<td class="lux-cell ${staffTopCls}" style="background:${staffTopBg}">${escapeHtml(r.n)}</td>
<td class="lux-cell ${rankClass(tops.day_visits, r.n)}" style="background:${bg(tops.day_visits, r.n)}">${r.day_visits}</td>
<td class="lux-cell ${rankClass(tops.day_negotiation, r.n)}" style="background:${bg(tops.day_negotiation, r.n)}">${r.day_negotiation}</td>
<td class="lux-cell ${rankClass(tops.day_dentou, r.n)}" style="background:${bg(tops.day_dentou, r.n)}">${r.day_dentou}</td>
<td class="lux-cell ${rankClass(tops.day_douryoku, r.n)}" style="background:${bg(tops.day_douryoku, r.n)}">${r.day_douryoku}</td>
<td class="lux-cell ${rankClass(tops.day_kp, r.n)}" style="background:${bg(tops.day_kp, r.n)}">${r.day_kp}</td>
<td class="lux-cell ${rankClass(tops.month_kp, r.n)}" style="background:${bg(tops.month_kp, r.n)}">${r.month_kp}</td>
<td class="lux-cell ${rankClass(tops.day_con, r.n)}" style="background:${bg(tops.day_con, r.n)}">${r.day_con}</td>
<td class="lux-cell ${rankClass(tops.month_con, r.n)}" style="background:${bg(tops.month_con, r.n)}">${r.month_con}</td>
</tr>`;
  }).join('\n');

  const totalHtml = `<tr style="background:#ffe0b2">
<td colspan="1" style="font-weight:bold;text-align:center;">合計</td>
<td style="font-weight:bold;text-align:center;">${workingCount}人</td>
<td>${total.visits}</td>
<td>${total.negotiation}</td>
<td>${total.dentou}</td>
<td>${total.douryoku}</td>
<td>${total.day_kp}</td>
<td>${total.month_kp}</td>
<td>${total.day_con}</td>
<td>${total.month_con}</td>
</tr>`;

  return tplReplace(tpl, {
    TITLE: title,
    STYLE: style,
    HEADER: header,
    ROWS: rowsHtml,
    TOTAL: totalHtml
  });
}
