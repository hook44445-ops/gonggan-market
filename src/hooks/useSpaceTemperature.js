// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// 공간온도 = 쌓인 신뢰의 증명
// ─────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { SPACE_TEMPERATURE_BASE } from '../constants/lounge';

const STORAGE_KEY = 'lounge_temperature_data';

function loadTempData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    temperature:       SPACE_TEMPERATURE_BASE,
    review_trust_pct:  0,
    recontract_pct:    0,
    response_speed:    '보통',
    report_count:      0,
  };
}

function saveTempData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function useSpaceTemperature(userId) {
  const [data, setData] = useState(() => loadTempData());

  const adjust = useCallback((delta, reason) => {
    const next = {
      ...data,
      temperature: Math.min(99.9, Math.max(0, parseFloat((data.temperature + delta).toFixed(1)))),
    };
    setData(next);
    saveTempData(next);
  }, [data]);

  const getLevel = (temp) => {
    if (temp >= 45) return { label: '홈마스터',    icon: '👑', color: '#C8A15A' };
    if (temp >= 40) return { label: '드림하우스',   icon: '🏰', color: '#2E5F4B' };
    if (temp >= 36) return { label: '다정한 이웃',  icon: '🏡', color: '#3A7A5C' };
    return                 { label: '새 이웃',      icon: '🏠', color: '#7A8A7E' };
  };

  return { ...data, adjust, level: getLevel(data.temperature) };
}
