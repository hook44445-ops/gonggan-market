import test from "node:test";
import assert from "node:assert/strict";
import { splitPhotos, joinPhotos, requestGaps, josa, photosOf, descTextOf, PHOTO_MARK, MAX_REQUEST_PHOTOS } from "./requestPhotos.js";

test("사진 없는 옛 요청서는 글이 그대로 나온다 — 기존 요청이 깨지지 않는다", () => {
  const { text, photos } = splitPhotos("도배, 바닥 — 안방만 해주세요");
  assert.equal(text, "도배, 바닥 — 안방만 해주세요");
  assert.deepEqual(photos, []);
});

test("사진을 넣고 빼도 글이 그대로 남는다", () => {
  const desc = joinPhotos("도배, 바닥 — 안방만", ["https://a/1.jpg", "https://a/2.jpg"]);
  const { text, photos } = splitPhotos(desc);
  assert.equal(text, "도배, 바닥 — 안방만");
  assert.deepEqual(photos, ["https://a/1.jpg", "https://a/2.jpg"]);
});

test("사진이 없으면 마커를 남기지 않는다", () => {
  assert.equal(joinPhotos("안방만", []), "안방만");
  assert.ok(!joinPhotos("안방만", []).includes(PHOTO_MARK));
});

test(`사진은 ${MAX_REQUEST_PHOTOS}장까지만 담는다`, () => {
  const many = Array.from({ length: 9 }, (_, i) => `https://a/${i}.jpg`);
  const { photos } = splitPhotos(joinPhotos("글", many));
  assert.equal(photos.length, MAX_REQUEST_PHOTOS);
});

test("마커가 글 중간에 섞여 있어도 날주소가 업체 화면에 새지 않는다", () => {
  const { text, photos } = splitPhotos(`앞줄\n${PHOTO_MARK}https://a/1.jpg\n뒷줄`);
  assert.equal(text, "앞줄\n뒷줄");
  assert.deepEqual(photos, ["https://a/1.jpg"]);
  assert.ok(!text.includes("https://"));
});

test("빈 주소·이상한 값은 버린다", () => {
  assert.equal(joinPhotos("글", ["", "   ", null, undefined]), "글");
  assert.deepEqual(splitPhotos(`글\n${PHOTO_MARK}`).photos, []);
});

// ── 요청서 빈 곳 ──────────────────────────────────────────────
test("사진이 없으면 «현장 사진»이 빈 곳으로 잡힌다", () => {
  const g = requestGaps({ desc: "도배, 바닥 — 안방 전체를 새로 하고 싶습니다", size: "24" });
  assert.ok(g.gaps.some(x => x.key === "photo"));
  assert.equal(g.photoCount, 0);
  assert.ok(g.line.includes("현장 사진"));
});

test("사진·설명·평수가 다 있으면 빈 곳이 없다", () => {
  const desc = joinPhotos("도배, 바닥 — 안방 전체를 새로 하고 싶습니다", ["https://a/1.jpg"]);
  const g = requestGaps({ desc, size: "24" });
  assert.deepEqual(g.gaps, []);
  assert.equal(g.filled, true);
  assert.equal(g.photoCount, 1);
});

test("점수를 매기지 않고 «채우면 좋아진다»만 말한다 — 고객을 나무라지 않는다", () => {
  const g = requestGaps({ desc: "" });
  assert.ok(!/점|score|나쁨|부족/.test(g.line));
  assert.ok(g.line.includes("채우면"));
  for (const x of g.gaps) assert.ok(x.why && x.why.length > 5, "왜 채워야 하는지를 같이 준다");
});

test("요청이 비어 있어도 깨지지 않는다", () => {
  for (const v of [undefined, null, {}]) assert.ok(Array.isArray(requestGaps(v).gaps));
});

test("받침에 맞는 조사 — 「평수이(가)」처럼 쓰지 않는다", () => {
  assert.equal(josa("평수", "이", "가"), "가");        // 수: 받침 없음
  assert.equal(josa("현장 사진", "이", "가"), "이");   // 진: 받침 있음
  assert.equal(josa("", "이", "가"), "가");
  assert.equal(josa("abc", "이", "가"), "가");          // 한글이 아니면 기본값
  const line = requestGaps({ desc: "", size: "24" }).line;
  assert.ok(!line.includes("이(가)"), `조사가 「이(가)」로 남았다: ${line}`);
});

// ── 칸(requests.photos)과 마커, 두 길 ────────────────────────────────
test("칸이 있으면 칸에서, 없으면 마커에서 읽는다", () => {
  const marker = joinPhotos("글", ["https://a/mark.jpg"]);
  assert.deepEqual(photosOf({ desc: marker }), ["https://a/mark.jpg"]);           // SQL 185 전
  assert.deepEqual(photosOf({ desc: marker, photos: ["https://a/col.jpg"] }),
    ["https://a/col.jpg"]);                                                        // SQL 185 뒤 — 칸이 이긴다
  assert.deepEqual(photosOf({ desc: marker, photos: [] }), ["https://a/mark.jpg"]); // 빈 칸이면 마커로
  assert.deepEqual(photosOf({}), []);
  assert.deepEqual(photosOf(null), []);
});

test("업체 화면에 주는 글에는 어느 길이든 날주소가 없다", () => {
  const marker = joinPhotos("안방 곰팡이", ["https://a/1.jpg"]);
  assert.equal(descTextOf({ desc: marker }), "안방 곰팡이");
  assert.equal(descTextOf({ description: marker, photos: ["https://a/1.jpg"] }), "안방 곰팡이");
  assert.ok(!descTextOf({ desc: marker }).includes("https://"));
});

test("빈 곳 판정도 칸을 먼저 본다", () => {
  const g = requestGaps({ desc: "도배 — 안방 곰팡이랑 장판", size: "24", photos: ["https://a/1.jpg"] });
  assert.equal(g.photoCount, 1);
  assert.ok(!g.gaps.some(x => x.key === "photo"));
});
