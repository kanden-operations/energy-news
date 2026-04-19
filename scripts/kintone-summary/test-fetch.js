// Phase 2 動作確認スクリプト
// 使い方:
//   1) Windows PowerShell/cmd で環境変数を設定(または --env-file=.env でも可)
//   2) node test-fetch.js
//
// 目的: 3つのアプリから件数が取れるかを簡易チェック
//        kintone画面で見える件数と一致すればOK

import { fetchAppA, fetchAppB, fetchWaitCountsByStaff } from './fetch.js';
import { nowJST, toJSTDateString } from './utils.js';
import { A as AF, B as BF } from './config.js';

async function main() {
  const now = nowJST();
  const dateStr = toJSTDateString(now);
  const ym = dateStr.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const startStr = toJSTDateString(start);
  const endStr = toJSTDateString(end);

  console.log(`[test-fetch] 対象期間: ${startStr} 〜 ${endStr}  (単日: ${dateStr})`);

  // Aアプリ(日報): 月間の"最終"レコード件数
  const qA = `${AF.date} >= "${startStr}" and ${AF.date} <= "${endStr}" and ${AF.report} in ("最終")`;
  const recA = await fetchAppA(qA);
  console.log(`[Aアプリ 日報] 月間"最終"レコード: ${recA.length} 件`);

  // Aアプリ(日報): 単日の"最終"レコード件数
  const qADay = `${AF.date} = "${dateStr}" and ${AF.report} in ("最終")`;
  const recADay = await fetchAppA(qADay);
  console.log(`[Aアプリ 日報] 当日"最終"レコード: ${recADay.length} 件`);

  // Bアプリ(目標管理): 当月スタッフ数
  const qB = `${BF.start} = "${startStr}" and ${BF.last} = "${endStr}"`;
  const recB = await fetchAppB(qB);
  console.log(`[Bアプリ 目標管理] 当月対象レコード: ${recB.length} 件`);

  // Cアプリ(契約管理): Bのスタッフ名で対応待ち集計
  const staffNames = recB.map(r => r[BF.staff] && r[BF.staff].value).filter(Boolean);
  const waitMap = await fetchWaitCountsByStaff(staffNames);
  const totalWait = Object.values(waitMap).reduce((a, b) => a + b, 0);
  console.log(`[Cアプリ 契約管理] 対応待ち合計: ${totalWait} 件  (担当者${Object.keys(waitMap).length}人)`);

  console.log('OK');
}

main().catch(e => {
  console.error('[ERROR]', e);
  process.exit(1);
});
