import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { coverKeyFor, coverFor } from './companyCover.js';

test('첫 공종이 공개 커버를 결정한다', () => {
  const groups = {
    bath: ['욕실', '방수/누수', '줄눈/탄성코트'], kitchen: ['주방'],
    film: ['인테리어 필름', '몰딩/도어'], finish: ['바닥/도배', '페인트', '타일'],
    repair: ['집수리 일반', '조명/전기', '철거'],
    space: ['아파트 전체/부분', '아파트 전체', '아파트 부분', '원룸', '원룸/오피스텔', '카페/식당', '오피스', '상가'],
  };
  for (const [key, specialties] of Object.entries(groups)) {
    for (const specialty of specialties) assert.equal(coverKeyFor([specialty, '욕실']), key);
  }
  assert.equal(coverKeyFor([' 주방 ', '욕실']), 'kitchen');
});

test('없거나 알 수 없는 첫 공종은 집수리 커버다', () => {
  for (const value of [undefined, null, [], '욕실', {}, [null], ['미등록', '욕실']]) {
    assert.equal(coverKeyFor(value), 'repair');
  }
  assert.equal(coverFor(null), '/images/company-cover/repair.webp');
});

test('업체 고유 커버를 보존하고 기본 그림은 별도 경로로만 제공한다', () => {
  const company = { cover: 'https://example.com/own.jpg', specialties: ['주방'] };
  assert.equal(coverFor(company), company.cover);
  assert.equal(coverFor({ cover: '', specialties: ['주방'] }), '/images/company-cover/kitchen.webp');
});

test('모든 기본 커버와 빈 상태 그림이 용량 예산 안에 있다', () => {
  for (const key of ['bath', 'kitchen', 'film', 'finish', 'repair', 'space']) {
    const file = new URL(`../../public/images/company-cover/${key}.webp`, import.meta.url);
    assert.ok(existsSync(file), key);
    assert.ok(statSync(file).size <= 60000, key);
  }
  for (const key of ['portfolio-first', 'review-first']) {
    const file = new URL(`../../public/images/empty/${key}.webp`, import.meta.url);
    assert.ok(existsSync(file), key);
    assert.ok(statSync(file).size <= 25000, key);
  }
});
