// 파트너센터 돈 숫자 — 한 계산으로(C14). 화면(DashboardScreen)과 시험이 같은 함수를 쓴다.
//   · 계약 전(에스크로 없음) 공사는 정산 예정·입금 예정에서 뺀다 — 현장방문 단계에 「입금 예정 240만원」이 뜨던 것.
//   · 금액은 업체 실수령(수수료 PLATFORM_FEE_RATE 뺀 값), 만원 단위 반올림.
//   · 이번 달 수익 = 진행 중 공사에서 이미 지급된 몫 + 이번 달 정산 완료된 공사 전액(실수령).
import { PLATFORM_FEE_RATE } from "./financeUtils.js";

const net = (manwon) => Math.round((Number(manwon) || 0) * (1 - PLATFORM_FEE_RATE));

export function partnerMoney({ activeJobs = [], completedJobs = [], now = new Date() } = {}) {
  const contracted = activeJobs.filter(j => j && j.contracted);
  const paidNow  = contracted.reduce((s, j) => s + (Number(j.total) || 0) * (Number(j.paid) || 0) / 100, 0);
  const pending  = contracted.reduce((s, j) => s + (Number(j.total) || 0) * (100 - (Number(j.paid) || 0)) / 100, 0);
  const ym = `${now.getFullYear()}-${now.getMonth()}`;
  const settledThisMonth = completedJobs
    .filter(c => c && c.settled && c.date && (() => { const d = new Date(c.date); return `${d.getFullYear()}-${d.getMonth()}` === ym; })())
    .reduce((s, c) => s + (Number(c.total) || 0), 0);
  return {
    monthRevenue: net(paidNow + settledThisMonth),
    pending:      net(pending),
    contractedCount: contracted.length,
  };
}

// 남은 날짜 — 공사 기간(일)을 모르면 null(화면에서 숨긴다). 예전엔 무조건 30일로 셌다(3일 공사가 D-30).
export function daysLeft(startIso, durationDays, now = Date.now()) {
  const d = Number(durationDays);
  if (!startIso || !Number.isFinite(d) || d <= 0) return null;
  const elapsed = Math.floor((now - new Date(startIso).getTime()) / 864e5);
  return Math.max(0, d - elapsed);
}
