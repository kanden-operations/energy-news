// 定数・環境変数のラッパ
// kintone アプリID・フィールドコードは元JS(table10__2_.js)に合わせる。

export const A_APP_ID = 199; // 日報
export const B_APP_ID = 208; // 目標管理
export const C_APP_ID = 101; // 契約管理(対応待ち)

export const A = {
  date: 'work_date',
  staff: 'staff_name',
  contract: 'contract',
  travel: 'travel_allowance',
  kp: 'kp',
  report: 'report_time',
  visits: 'visits',
  negotiation: 'negotiation',
  business_dentou_total: 'business_dentou_total',
  business_douryoku_total: 'business_douryoku_total'
};

export const B = {
  staff: 'staff_name',
  start: 'start_day',
  last: 'last_day',
  schedule: 'schedule',
  goal: 'goal',
  ranking: 'ranking',
  lastKp: 'kp_last_month',
  contractLastMonth: 'contract_last_month',
  contractTwoMonthsAgo: 'contract_two_months_ago'
};

export const C = {
  staff: 'staff_name',
  status: 'status'
};

export function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`環境変数 ${name} が未設定です`);
  return v;
}

export function envConfig() {
  return {
    subdomain: getEnv('KINTONE_SUBDOMAIN'),
    tokenA: getEnv('KINTONE_TOKEN_A'),
    tokenB: getEnv('KINTONE_TOKEN_B'),
    tokenC: getEnv('KINTONE_TOKEN_C')
  };
}
