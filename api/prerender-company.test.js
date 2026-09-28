import { test } from 'node:test';
import assert from 'node:assert/strict';

test('업체 공유 이미지는 실제 사례 우선이며 기본 커버를 시공 증거로 쓰지 않는다', async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://company-preview.invalid';
  process.env.SUPABASE_ANON_KEY = 'fixture-only';
  t.after(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalKey;
  });
  const { default: handler } = await import('./prerender.js');
  const company = { id: '11111111-1111-4111-8111-111111111111', name: '우리집 시공', slug: 'our-home', specialties: ['욕실'] };
  let works = [];
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => String(url).includes('/companies?') ? [company]
      : String(url).includes('/portfolios?') ? works : [],
  }));
  async function render() {
    let html;
    const res = { setHeader() {}, end(value) { html = value; } };
    await handler({ headers: { host: 'gongganmarket.com' }, query: { page: 'company', id: 'our-home' } }, res);
    assert.equal(res.statusCode, 200);
    return html;
  }
  const empty = await render();
  assert.match(empty, /property="og:image" content="https:\/\/gongganmarket.com\/images\/company-cover\/bath.webp"/);
  assert.doesNotMatch(empty, /"aggregateRating"/);
  assert.doesNotMatch(empty, /"image":"[^" ]*company-cover/);
  assert.doesNotMatch(empty, /<h2>시공 사례<\/h2>/);

  works = [{ title: '실제 사례', after_photos: ['https://example.com/after.jpg'], before_photos: ['https://example.com/before.jpg'] }];
  assert.match(await render(), /property="og:image" content="https:\/\/example.com\/after.jpg"/);
  works[0].after_photos = [];
  assert.match(await render(), /property="og:image" content="https:\/\/example.com\/before.jpg"/);
});
