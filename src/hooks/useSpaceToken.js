// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// ─────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { TOKEN_EARN } from '../constants/lounge';

const STORAGE_KEY = 'lounge_token_data';

function loadTokenData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { balance: 20, logs: [{ type: 'earn', action: 'signup', amount: 20, description: '첫 가입 보너스', created_at: new Date().toISOString() }] };
}

function saveTokenData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function useSpaceToken(userId) {
  const [data, setData] = useState(() => loadTokenData());

  const balance = data.balance;
  const logs    = data.logs;

  const earn = useCallback((action, description) => {
    const amount = TOKEN_EARN[action.toUpperCase()] ?? TOKEN_EARN[action] ?? 0;
    if (!amount) return false;

    const alreadyEarned = data.logs.some(l => l.type === 'earn' && l.action === action);
    if (action !== 'weekly_activity' && alreadyEarned) return false;

    const log = { type: 'earn', action, amount, description: description ?? action, created_at: new Date().toISOString() };
    const next = { balance: data.balance + amount, logs: [log, ...data.logs] };
    setData(next);
    saveTokenData(next);
    return true;
  }, [data]);

  const spend = useCallback((action, amount, description) => {
    if (data.balance < amount) return false;
    const log = { type: 'spend', action, amount, description: description ?? action, created_at: new Date().toISOString() };
    const next = { balance: data.balance - amount, logs: [log, ...data.logs] };
    setData(next);
    saveTokenData(next);
    return true;
  }, [data]);

  const adminAdjust = useCallback((delta, description) => {
    const next = { balance: Math.max(0, data.balance + delta), logs: [{ type: delta > 0 ? 'earn' : 'spend', action: 'admin_adjust', amount: Math.abs(delta), description, created_at: new Date().toISOString() }, ...data.logs] };
    setData(next);
    saveTokenData(next);
  }, [data]);

  return { balance, logs, earn, spend, adminAdjust };
}
