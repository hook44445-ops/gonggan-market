import { useState, useEffect, useCallback, useRef } from 'react';
import { TOKEN_EARN } from '../constants/lounge';
import {
  getSpaceToken,
  upsertSpaceToken,
  createSpaceTokenLog,
  getSpaceTokenLogs,
  getUserMissionStats,
} from '../lib/supabase';

const THRESHOLD_MISSIONS = [
  { action: 'likes_received_20',   key: 'likes_received', threshold: 20 },
  { action: 'comments_written_10', key: 'comments',       threshold: 10 },
  { action: 'posts_written_3',     key: 'posts',          threshold: 3  },
];

// 매일 반복 미션(좋아요20/댓글10/게시글3) — 마지막 획득 후 24시간 지나면 재지급
const REPEAT_WINDOW_MS = 24 * 3600000;
const REPEAT_24H_ACTIONS = new Set(THRESHOLD_MISSIONS.map(m => m.action));

export function earnedWithinWindow(logs, action, now = Date.now()) {
  const last = logs.find(l => l.type === 'earn' && l.action === action);
  return !!last && now - new Date(last.created_at).getTime() < REPEAT_WINDOW_MS;
}

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
    const newBalance = cur + amount;
    const log = { type: 'earn', action, amount, description: action, created_at: new Date().toISOString() };
    curLogs = [log, ...curLogs];
    cur = newBalance;
    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: 'earn', action, amount, description: null });
    }
  }
  return { balance: cur, logs: curLogs };
}

export function useSpaceToken(userId) {
  const [balance,      setBalance]      = useState(0);
  const [logs,         setLogs]         = useState([]);
  const [missionStats, setMissionStats] = useState(null);
  const balanceRef = useRef(0);
  const logsRef    = useRef([]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      getSpaceToken(userId),
      getSpaceTokenLogs(userId),
      getUserMissionStats(userId),
    ]).then(async ([tokenResult, logsResult, stats]) => {
      const initBalance = tokenResult.data?.balance ?? 20;
      const initLogs    = logsResult.data ?? [];
      const { balance: finalBalance, logs: finalLogs } = await grantThresholds(userId, initBalance, initLogs, stats);
      balanceRef.current = finalBalance;
      logsRef.current    = finalLogs;
      setBalance(finalBalance);
      setLogs(finalLogs);
      setMissionStats(stats);
    }).catch(() => {
      // graceful — keep defaults
    });
  }, [userId]);

  const earn = useCallback(async (action, description) => {
    const amount = TOKEN_EARN[action.toUpperCase()] ?? TOKEN_EARN[action] ?? 0;
    if (!amount) return false;

    let alreadyEarned;
    if (REPEAT_24H_ACTIONS.has(action)) {
      // 매일 반복 미션: 24시간 이내 재지급 차단
      alreadyEarned = earnedWithinWindow(logsRef.current, action);
    } else if (action === 'construction_review') {
      // 후기 보상: 완료된 계약 1건당 1회 — description(계약 식별 포함) 단위로 중복 차단
      alreadyEarned = logsRef.current.some(l => l.type === 'earn' && l.action === action
        && (l.description ?? null) === (description ?? null));
    } else {
      alreadyEarned = logsRef.current.some(l => l.type === 'earn' && l.action === action);
    }
    if (alreadyEarned) return false;

    const newBalance = balanceRef.current + amount;
    const log = { type: 'earn', action, amount, description: description ?? action, created_at: new Date().toISOString() };

    balanceRef.current = newBalance;
    logsRef.current    = [log, ...logsRef.current];
    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: 'earn', action, amount, description: description ?? null });
    }
    return true;
  }, [userId]);

  const spend = useCallback(async (action, amount, description) => {
    if (balanceRef.current < amount) return false;

    const newBalance = balanceRef.current - amount;
    const log = { type: 'spend', action, amount, description: description ?? action, created_at: new Date().toISOString() };

    balanceRef.current = newBalance;
    logsRef.current    = [log, ...logsRef.current];
    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: 'spend', action, amount, description: description ?? null });
    }
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

  return { balance, logs, missionStats, earn, spend, adminAdjust, refreshMissionStats };
}
