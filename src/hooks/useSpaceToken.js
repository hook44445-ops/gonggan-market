import { useState, useEffect, useCallback } from 'react';
import { TOKEN_EARN } from '../constants/lounge';
import {
  getSpaceToken,
  upsertSpaceToken,
  createSpaceTokenLog,
  getSpaceTokenLogs,
} from '../lib/supabase';

export function useSpaceToken(userId) {
  const [balance, setBalance] = useState(0);
  const [logs, setLogs]       = useState([]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      getSpaceToken(userId),
      getSpaceTokenLogs(userId),
    ]).then(([tokenResult, logsResult]) => {
      setBalance(tokenResult.data?.balance ?? 20);
      setLogs(logsResult.data ?? []);
    }).catch(() => {
      // graceful — keep defaults
    });
  }, [userId]);

  const earn = useCallback(async (action, description) => {
    const amount = TOKEN_EARN[action.toUpperCase()] ?? TOKEN_EARN[action] ?? 0;
    if (!amount) return false;

    const alreadyEarned = logs.some(l => l.type === 'earn' && l.action === action);
    if (action !== 'weekly_activity' && alreadyEarned) return false;

    const newBalance = balance + amount;
    const log = { type: 'earn', action, amount, description: description ?? action, created_at: new Date().toISOString() };

    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: 'earn', action, amount, description: description ?? null });
    }
    return true;
  }, [balance, logs, userId]);

  const spend = useCallback(async (action, amount, description) => {
    if (balance < amount) return false;

    const newBalance = balance - amount;
    const log = { type: 'spend', action, amount, description: description ?? action, created_at: new Date().toISOString() };

    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: 'spend', action, amount, description: description ?? null });
    }
    return true;
  }, [balance, userId]);

  const adminAdjust = useCallback(async (delta, description) => {
    const newBalance = Math.max(0, balance + delta);
    const log = { type: delta > 0 ? 'earn' : 'spend', action: 'admin_adjust', amount: Math.abs(delta), description, created_at: new Date().toISOString() };

    setBalance(newBalance);
    setLogs(prev => [log, ...prev]);

    if (userId) {
      await upsertSpaceToken(userId, newBalance);
      await createSpaceTokenLog({ userId, type: delta > 0 ? 'earn' : 'spend', action: 'admin_adjust', amount: Math.abs(delta), description: description ?? null });
    }
  }, [balance, userId]);

  return { balance, logs, earn, spend, adminAdjust };
}
