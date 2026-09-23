// docObjectRef — 저장값(경로·옛 공개주소·옛 서명주소)에서 버킷/경로를 꺼낸다.
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase 클라이언트를 끌어오지 않도록 같은 규칙을 복사해 검증한다(순수 함수).
const PRIVATE_DOC_BUCKETS = ["documents", "company-documents"];
const docObjectRef = (value) => {
  const v = String(value ?? "").trim();
  if (!v || v.startsWith("blob:") || v.startsWith("data:")) return null;
  const m = v.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  if (/^https?:/i.test(v)) return null;
  const slash = v.indexOf("/");
  if (slash <= 0) return null;
  const bucket = v.slice(0, slash);
  if (!PRIVATE_DOC_BUCKETS.includes(bucket)) return null;
  return { bucket, path: v.slice(slash + 1) };
};

test("새 저장값(버킷/경로)", () => {
  assert.deepEqual(docObjectRef("documents/partner_leads/12/biz_1.pdf"),
    { bucket: "documents", path: "partner_leads/12/biz_1.pdf" });
});

test("예전 공개 주소에서 경로를 꺼낸다", () => {
  assert.deepEqual(docObjectRef("https://x.supabase.co/storage/v1/object/public/documents/a/b%20c.pdf"),
    { bucket: "documents", path: "a/b c.pdf" });
});

test("예전 서명 주소(토큰 붙음)도 같은 경로", () => {
  assert.deepEqual(docObjectRef("https://x.supabase.co/storage/v1/object/sign/documents/a/b.pdf?token=zz"),
    { bucket: "documents", path: "a/b.pdf" });
});

test("사진 버킷·외부 주소·임시 주소는 건드리지 않는다", () => {
  assert.equal(docObjectRef("photos/portfolio/1.jpg"), null);
  assert.equal(docObjectRef("https://example.com/a.pdf"), null);
  assert.equal(docObjectRef("blob:http://localhost/abc"), null);
  assert.equal(docObjectRef(""), null);
  assert.equal(docObjectRef(null), null);
});
