// エントリポイント
// 1日に1回 GitHub Actions から呼び出される想定。
// 月間集計と単日集計を生成し、summary/ 配下にPNGを2枚出力する。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { aggregateMonthly, aggregateDaily } from './aggregate.js';
import { renderMonthly, renderDaily } from './render.js';
import { captureHtmlToPng } from './capture.js';
import { nowJST, toJSTDateString } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// リポジトリルート(scripts/kintone-summary/ から2階層上)
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUMMARY_DIR = path.join(REPO_ROOT, 'summary');
const ARCHIVE_DIR = path.join(SUMMARY_DIR, 'archive');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  // コマンドライン引数で日付を指定できる(テスト用)
  // 例: node run.js --date=2026-04-18
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  const monthArg = args.find(a => a.startsWith('--month='));

  const now = nowJST();
  const dateStr = dateArg ? dateArg.split('=')[1] : toJSTDateString(now);
  const yearMonth = monthArg ? monthArg.split('=')[1] : dateStr.slice(0, 7);
  const compact = dateStr.replace(/-/g, '');

  console.log(`[run] start: date=${dateStr}  month=${yearMonth}`);

  await ensureDir(SUMMARY_DIR);
  await ensureDir(ARCHIVE_DIR);

  // 月間集計
  console.log('[run] monthly: aggregate');
  const monthly = await aggregateMonthly(yearMonth);
  console.log(`[run] monthly: ${monthly.rows.length} rows`);

  const monthlyHtml = renderMonthly(monthly);
  const monthlyLatest = path.join(SUMMARY_DIR, 'latest-monthly.png');
  const monthlyArchive = path.join(ARCHIVE_DIR, `${compact}-monthly.png`);
  await captureHtmlToPng(monthlyHtml, monthlyLatest, 1500);
  await fs.copyFile(monthlyLatest, monthlyArchive);
  console.log(`[run] monthly: saved ${monthlyLatest}`);

  // 単日集計
  console.log('[run] daily: aggregate');
  const daily = await aggregateDaily(dateStr);
  console.log(`[run] daily: ${daily.rows.length} rows (workingCount=${daily.workingCount})`);

  const dailyHtml = renderDaily(daily);
  const dailyLatest = path.join(SUMMARY_DIR, 'latest-daily.png');
  const dailyArchive = path.join(ARCHIVE_DIR, `${compact}-daily.png`);
  await captureHtmlToPng(dailyHtml, dailyLatest, 1100);
  await fs.copyFile(dailyLatest, dailyArchive);
  console.log(`[run] daily: saved ${dailyLatest}`);

  console.log('[run] all done');
}

main().catch(e => {
  console.error('[run] ERROR:', e);
  process.exit(1);
});
