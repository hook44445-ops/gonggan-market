// 푸시 정책 — 소식성 타입 목록이 캡 계산과 어긋나지 않는지 지킨다.
// dispatch.js 가 일일 캡을 셀 때 `type=in.(NEWS_TYPES)` 로 질의를 좁힌다.
// 이 목록에 대화/계약이 섞여 들어가면 계약 알림 몇 건에 동네 소식이 막힌다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUSH_TYPE, NEWS_TYPES, NEWS_DAILY_CAP,
  isNewsType, isImmediateType, isWithinNewsWindow,
} from '../utils/pushPolicy.js';

test('NEWS_TYPES 와 isNewsType 이 같은 기준을 본다', () => {
  for (const t of NEWS_TYPES) assert.equal(isNewsType(t), true, t);
  for (const t of Object.values(PUSH_TYPE)) {
    assert.equal(isNewsType(t), NEWS_TYPES.includes(t), t);
  }
});

test('즉시 발송 타입은 캡 대상이 아니다', () => {
  for (const t of [PUSH_TYPE.CHAT, PUSH_TYPE.ESCROW, PUSH_TYPE.LOUNGE_ACTIVITY]) {
    assert.equal(isImmediateType(t), true, t);
    assert.equal(NEWS_TYPES.includes(t), false, t);
  }
});

test('NEWS_TYPES 는 PostgREST in.() 에 그대로 넣어도 안전한 값이다', () => {
  assert.ok(NEWS_TYPES.length > 0);
  for (const t of NEWS_TYPES) assert.match(t, /^[a-z_]+$/, t);
});

test('소식성 시간창은 KST 10시~21시', () => {
  const kst = (h, m = 0) => new Date(Date.UTC(2026, 8, 24, h - 9, m));
  assert.equal(isWithinNewsWindow(kst(9, 59)), false);
  assert.equal(isWithinNewsWindow(kst(10, 0)), true);
  assert.equal(isWithinNewsWindow(kst(21, 0)), true);
  assert.equal(isWithinNewsWindow(kst(21, 1)), false);
});

test('일일 캡은 3건', () => {
  assert.equal(NEWS_DAILY_CAP, 3);
});

test('광고 푸시(157) — 한국 9시~20시만 · 소식 캡과 따로', async () => {
  const { isAdType, isWithinAdWindow, AD_TYPES } = await import('../utils/pushPolicy.js');
  assert.equal(isAdType('event_promo'), true);
  assert.equal(isNewsType('event_promo'), false);
  assert.equal(isWithinAdWindow(new Date('2026-10-01T08:59:00+09:00')), false);
  assert.equal(isWithinAdWindow(new Date('2026-10-01T09:00:00+09:00')), true);
  assert.equal(isWithinAdWindow(new Date('2026-10-01T19:59:00+09:00')), true);
  assert.equal(isWithinAdWindow(new Date('2026-10-01T20:00:00+09:00')), false);
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../../supabase/migrations/157_marketing_consent_event_push.sql', import.meta.url), 'utf-8');
  for (const t of AD_TYPES) assert.ok(sql.includes(`'${t}'`), `SQL 이 ${t} 타입으로 쌓아야 한다`);
  assert.ok(sql.includes("'(광고) '"), '제목 맨 앞 (광고)');
  assert.ok(sql.includes('수신거부'), '본문에 수신거부 방법');
  assert.ok(sql.includes('p.push_marketing = true'), '동의한 사람만');
  assert.ok(sql.includes('v_hour < 9 or v_hour >= 20'), '쌓는 시간도 9~20시');
});

test('관리자 광고 현황(158) — event_promo 타입으로 센다', async () => {
  const { readFileSync } = await import('node:fs');
  const { AD_TYPES } = await import('../utils/pushPolicy.js');
  const sql = readFileSync(new URL('../../supabase/migrations/158_admin_marketing_stats.sql', import.meta.url), 'utf-8');
  assert.ok(sql.includes(`type = '${AD_TYPES[0]}'`));
  assert.ok(sql.includes("'NOT_ADMIN'"));
});

test('초대왕 순위 알림(160) — 푸시는 광고 규칙 그대로', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../../supabase/migrations/160_referral_rank_notify.sql', import.meta.url), 'utf-8');
  assert.ok(sql.includes("'event_promo'"), '광고 타입으로 쌓아야 9~20시·동의 재확인이 적용된다');
  assert.ok(sql.includes("'(광고) '"));
  assert.ok(sql.includes("push_marketing"));
  assert.ok(sql.includes('v_hour >= 9 and v_hour < 20'));
  assert.ok(sql.includes("n.type = 'REFERRAL_RANK'"), '하루 한 번');
});
