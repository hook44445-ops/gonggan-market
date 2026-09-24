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
