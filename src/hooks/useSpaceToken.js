import { useState, useEffect, useCallback, useRef } from 'react';
import { TOKEN_EARN } from '../constants/lounge';
import { DAILY_MISSIONS, earnedToday } from '../utils/tokenCalculator';
import {
  getSpaceToken,
  getTokenSummary,
  upsertSpaceToken,
  createSpaceTokenLog,
  getSpaceTokenLogs,
  getUserMissionStats,
  earnSpaceToken,
  spendSpaceToken,
} from '../lib/supabase';

// 매일 미션(좋아요 20 · 댓글 10 · 글 3) — «오늘(한국 날짜)» 숫자로, 하루 한 번(서버 198 과 같다)
const THRESHOLD_MISSIONS = DAILY_MISSIONS;
const REPEAT_DAILY_ACTIONS = new Set(THRESHOLD_MISSIONS.map(m => m.action));

// 예전 이름 유지(호출부 호환) — 이제 «오늘 이미 받았나»
export const earnedWithinWindow = earnedToday;

async function grantThresholds(userId, balance, logs, stats) {
  if (!stats) return { balance, logs };
  let cur = balance;
  let curLogs = logs;
  for (const { action, key, threshold } of THRESHOLD_MISSIONS) {
    if ((stats[key] ?? 0) < threshold) continue;
    const already = earnedWithinWindow(curLogs, action);
    if (already) continue;
    const amount = TOKEN_EARN[action.toUpperCase()] ?? TOKEN_EARN[action] ?? 0;
    if (!amount) continue;
    if (!userId) continue;
    // 서버가 «오늘 숫자»와 하루 한 번을 다시 확인하고 적립한다(198). 적립된 경우에만 화면에 반영.
    const { data } = await earnSpaceToken(userId, action, null);
    if (data?.status !== 'earned') continue;
    const log = { type: 'earn', action, amount: data.amount ?? amount, description: action, created_at: new Date().toISOString() };
    curLogs = [log, ...curLogs];
    cur = typeof data.balance === 'number' ? data.balance : cur + amount;
  }
  return { balance: cur, logs: curLogs };
}

export function useSpaceToken(userId) {
  const [balance,      setBalance]      = useState(0);
  const [logs,         setLogs]         = useState([]);
  const [missionStats, setMissionStats] = useState(null);
  const balanceRef = useRef(0);
  const logsRef    = useRef([]);

  // 잔액/원장/미션 통계 재조회 — 최초 마운트와 외부 이벤트(예: 토큰 구매 결제 복귀) 공용.
  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // 서버 함수(SQL 134)로 읽는다. 함수가 아직 없으면(실행 전) 예전 직접 읽기로 — 순서가 어긋나도 깨지지 않게.
      const [summary, stats] = await Promise.all([
        getTokenSummary(userId),
        getUserMissionStats(userId),
      ]);
      let initBalance, initLogs;
      if (!summary.error && summary.data && typeof summary.data.balance === 'number') {
        initBalance = summary.data.balance;
        initLogs    = Array.isArray(summary.data.logs) ? summary.data.logs : [];
      } else {
        const [tokenResult, logsResult] = await Promise.all([getSpaceToken(userId), getSpaceTokenLogs(userId)]);
        initBalance = tokenResult.data?.balance ?? 20;
        initLogs    = logsResult.data ?? [];
      }
      const { balance: finalBalance, logs: finalLogs } = await grantThresholds(userId, initBalance, initLogs, stats);
      balanceRef.current = finalBalance;
      logsRef.current    = finalLogs;
      setBalance(finalBalance);
      setLogs(finalLogs);
      setMissionStats(stats);
    } catch {
      // graceful — keep defaults
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  // 앱 밖(App)에서 서버가 토큰을 준 뒤 — 예: 초대 가입 선물(148) — 잔액을 다시 읽는다
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("gonggan:tokens-changed", onChanged);
    return () => window.removeEventListener("gonggan:tokens-changed", onChanged);
  }, [load]);

  const earn = useCallback(async (action, description) => {
    const amount = TOKEN_EARN[action.toUpperCase()] ?? TOKEN_EARN[action] ?? 0;
    if (!amount) return false;

    let alreadyEarned;
    if (REPEAT_DAILY_ACTIONS.has(action)) {
      // 매일 미션: 오늘(한국 날짜) 이미 받았으면 다시 주지 않는다
      alreadyEarned = earnedWithinWindow(logsRef.current, action);
    } else if (action === 'construction_review') {
      // 후기 보상: 완료된 계약 1건당 1회 — description(계약 식별 포함) 단위로 중복 차단
      alreadyEarned = logsRef.current.some(l => l.type === 'earn' && l.action === action
        && (l.description ?? null) === (description ?? null));
    } else {
      alreadyEarned = logsRef.current.some(l => l.type === 'earn' && l.action === action);
    }
    if (alreadyEarned) return false;

    if (!userId) return false;
    // 서버가 금액·중복을 정하고 적립한다(migration 111). 저장된 경우에만 화면 잔액을 바꾼다.
    const { data, error } = await earnSpaceToken(userId, action, description ?? null);
    if (error || data?.status !== 'earned') return false;
    const newBalance = typeof data.balance === 'number' ? data.balance : balanceRef.current + amount;
    const log = { type: 'earn', action, amount: data.amount ?? amount, description: description ?? action, created_at: new Date().toISOString() };

    balanceRef.current = newBalance;
    logsRef.current    = [log, ...logsRef.current];
    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);
    return true;
  }, [userId]);

  const spend = useCallback(async (action, amount, description) => {
    if (balanceRef.current < amount) return false;
    if (!userId) return false;
    // 서버에서 잔액 확인 후 차감(migration 111). 예전엔 화면에서만 빠지고 저장되지 않았다.
    const { data, error } = await spendSpaceToken(userId, action, amount, description ?? null);
    if (error || data?.status !== 'spent') {
      if (typeof data?.balance === 'number') { balanceRef.current = data.balance; setBalance(data.balance); }
      return false;
    }
    const newBalance = typeof data.balance === 'number' ? data.balance : balanceRef.current - amount;
    const log = { type: 'spend', action, amount, description: description ?? action, created_at: new Date().toISOString() };

    balanceRef.current = newBalance;
    logsRef.current    = [log, ...logsRef.current];
    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);
    return true;
  }, [userId]);

  const adminAdjust = useCallback(async (delta, description) => {
    const newBalance = Math.max(0, balanceRef.current + delta);
    const log = { type: delta > 0 ? 'earn' : 'spend', action: 'admin_adjust', amount: Math.abs(delta), description, created_at: new Date().toISOString() };

    balanceRef.current = newBalance;
    logsRef.current    = [log, ...logsRef.current];
    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: delta > 0 ? 'earn' : 'spend', action: 'admin_adjust', amount: Math.abs(delta), description: description ?? null });
    }
  }, [userId]);

  const refreshMissionStats = useCallback(async () => {
    if (!userId) return;
    try {
      const stats = await getUserMissionStats(userId);
      setMissionStats(stats);
      await grantThresholds(userId, balanceRef.current, logsRef.current, stats);
    } catch {}
  }, [userId]);

  return { balance, logs, missionStats, earn, spend, adminAdjust, refreshMissionStats, reload: load };
}
