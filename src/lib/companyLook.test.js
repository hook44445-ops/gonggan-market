import { test } from "node:test";
import assert from "node:assert/strict";
import { cardVisual, moodBandFor, whyThisCompany, specialtyChips } from "./companyLook.js";

test("업체가 올린 시공 사진이 있으면 그걸 앞에 세운다", () => {
  const v = cardVisual({}, ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg", "https://x/4.jpg"]);
  assert.equal(v.kind, "work");
  assert.equal(v.photos.length, 3);
  assert.equal(v.caption, "시공 사례 4장");
});

test("사진이 없으면 자재 이미지 + «분위기»라고 밝힌다(시공 사진인 척 금지)", () => {
  const v = cardVisual({ specialties: ["카페/식당"] }, []);
  assert.equal(v.kind, "mood");
  assert.equal(v.photos[0], "/images/trade/shop.webp");
  assert.match(v.caption, /분위기/);
  assert.equal(cardVisual({}, ["blob:bad", "data:bad"]).kind, "mood"); // 죽은 링크는 사진으로 치지 않는다
});

test("전문분야로 자재 이미지를 고르고, 없으면 주거", () => {
  assert.equal(moodBandFor({ specialties: ["욕실"] }), "/images/trade/water.webp");
  assert.equal(moodBandFor({ specialties: ["인테리어 필름"] }), "/images/trade/finish.webp");
  assert.equal(moodBandFor({}), "/images/trade/home.webp");
});

test("«왜 이 업체»는 실제 값이 기준을 넘을 때만", () => {
  assert.deepEqual(whyThisCompany({ completedJobs: 0, recontractRate: 0, asRate: 0 }), []);
  assert.deepEqual(whyThisCompany({ completedJobs: 12, recontractRate: 41, asRate: 95, hasInsurance: true }),
    ["공간마켓 시공 12건", "재계약 41%", "A/S 응답 95%"]);
});

test("요청한 공사와 겹치는 전문분야가 앞에 온다", () => {
  const r = specialtyChips({ specialties: ["철거", "인테리어 필름", "욕실"] }, "필름 위주로 부탁드려요");
  assert.equal(r.chips[0], "인테리어 필름");
  assert.equal(r.matchedCount, 1);
  assert.equal(specialtyChips({ specialties: [] }, "").chips.length, 0);
});