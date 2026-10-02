// App Store 문안 글자 수 — 넘치면 App Store Connect 가 저장을 거부하거나(이름·부제·키워드),
// 대표가 붙여 넣다가 잘린다. 문서(store/APPSTORE-ko.md)의 «## 칸 이름» 바로 아래 첫 줄이 값이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const doc = readFileSync(fileURLToPath(new URL("../../store/APPSTORE-ko.md", import.meta.url)), "utf-8");

function field(title) {
  const lines = doc.split("\n");
  const i = lines.findIndex(l => l.startsWith(`## ${title}`));
  assert.ok(i >= 0, `칸이 없다: ${title}`);
  const v = lines.slice(i + 1).find(l => l.trim());
  return v.trim();
}

test("App Store 이름·부제·키워드·프로모션 텍스트가 칸 크기 안에 든다", () => {
  assert.ok(field("앱 이름").length <= 30, "앱 이름 30자 초과");
  assert.ok(field("부제").length <= 30, "부제 30자 초과");
  assert.ok(field("키워드").length <= 100, "키워드 100자 초과");
  assert.ok(field("프로모션 텍스트").length <= 170, "프로모션 텍스트 170자 초과");
});

test("키워드는 띄어쓰기 없이 · 겹치지 않게 · 이름·부제 낱말과 다르게", () => {
  const kw = field("키워드");
  assert.ok(!/\s/.test(kw), "키워드에 띄어쓰기가 있다(자리 낭비)");
  const words = kw.split(",");
  assert.equal(new Set(words).size, words.length, "키워드가 겹친다");
  const head = field("앱 이름") + " " + field("부제");
  for (const w of words) assert.ok(!head.includes(w), `이름·부제에 이미 있는 낱말: ${w}`);
  for (const brand of ["숨고", "오늘의집", "집닥", "당근"]) assert.ok(!words.includes(brand), `다른 회사 이름: ${brand}`);
});

test("베타에서 에스크로를 운영 중이라 말하지 않는다", () => {
  assert.ok(!/에스크로로|안전결제로 보호/.test(field("프로모션 텍스트")));
});

// ── 스토어 자산이 앱과 갈라지지 않게 (2026-09-30) ──────────────────
// 09-30 점검에서 store/ASO-ko.md 가 아이콘을 «icon-512-v3.png» 로 가리키고 있었다.
// manifest 는 v6 이라, 이대로 스토어에 올렸으면 폰 아이콘과 스토어 아이콘이 달랐다.
const aso = readFileSync(fileURLToPath(new URL("../../store/ASO-ko.md", import.meta.url)), "utf-8");
const manifest = readFileSync(fileURLToPath(new URL("../../public/manifest.json", import.meta.url)), "utf-8");

test("스토어 문안의 앱 아이콘이 manifest 와 같은 판이다", () => {
  const cur = manifest.match(/icon-512-v(\d+)\.png/);
  assert.ok(cur, "manifest 에서 512 아이콘을 못 찾았다");
  const row = aso.split("\n").find(l => l.includes("앱 아이콘 512"));
  assert.ok(row, "store/ASO-ko.md 에 «앱 아이콘 512» 줄이 없다");
  assert.ok(row.includes(`icon-512-v${cur[1]}.png`),
    `스토어 문안 아이콘이 manifest(v${cur[1]}) 와 다르다: ${row.trim()}`);
});

// 붙여 넣는 칸만 본다 — 설명하는 글(«왜 고쳤나» 같은 메모)에는 틀린 문구가 인용으로 나올 수밖에 없다.
function section(full, title, stops) {
  const i = full.indexOf(`## ${title}`);
  assert.ok(i >= 0, `칸이 없다: ${title}`);
  const rest = full.slice(i + title.length + 3);
  const ends = stops.map(t => rest.indexOf(`## ${t}`)).filter(n => n >= 0);
  return rest.slice(0, ends.length ? Math.min(...ends) : rest.length);
}
// 값 줄만 — «> 2026…» 고친 기록 · «> 이전 판» 인용 줄은 뺀다(옛 문구를 일부러 적어 두는 자리)
const pasteOf = (text) => text.split("\n").filter(l => !l.startsWith("> 2026") && !l.startsWith("> 이전")).join("\n");

const PAY_NOTICE = "앱 안 안전결제(에스크로)는 정식 서비스에서 제공되며, 그 전까지는 계약서에 적은 단계대로 업체와 직접 진행합니다.";
const CELLS = () => [
  ["APPSTORE 앱 이름", field("앱 이름")],
  ["APPSTORE 부제", field("부제")],
  ["APPSTORE 프로모션 텍스트", field("프로모션 텍스트")],
  ["ASO 앱 이름", pasteOf(section(aso, "앱 이름 (30자)", ["간단한 설명"]))],
  ["ASO 간단한 설명", pasteOf(section(aso, "간단한 설명 (80자) — 매력", ["자세한 설명"]))],
  // 맨 아래 «안내»의 결제 문구는 기존 그대로 둔다(대표 10-02 «결제 약속은 기존 것으로 · 아직 바꾸지 마») — 이 한 문장만 검사에서 뺀다
  ["ASO 자세한 설명", section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"]).replace(PAY_NOTICE, "")],
];

// 10-02 USP 최신판(docs/USP-2026-10-02.md 4절 «아직 USP 로 말하면 안 되는 것»)과 코드의 사실.
//   · 09-30 에는 «사업자등록 확인 업체만 견적»을 막았다(가입만 해도 300만원까지 입찰) — SQL 124(09-25)부터 그 칸은 0 이라
//     지금은 사실이다(partnerTier LIMITS.NONE = 0). 대신 반대쪽 «승인을 기다리지 않고 바로 입찰»이 사실이 아니게 됐다.
const NOT_TRUE = [
  [/승인을 기다리지 않고|바로 입찰합니다|가입만 해도[^.]{0,12}입찰/, "사업자등록 확인 전엔 입찰이 잠긴다(SQL 124 · LIMITS.NONE = 0)"],
  [/에스크로|안전결제|안전지급|대금 보관|대금을 보관/, "결제는 PAYMENTS_LIVE 전 — 맨 아래 기존 안내 한 문장 말고는 쓰지 않는다(USP 4절)"],
  [/최저가|1위|1등|업계 최초|No\.?\s?1/i, "순위·최저 근거 없음(표시광고법 · USP 4절)"],
  [/[0-9][0-9,]*\s*(곳의|개 업체|곳 이상|건 완료|건의 시공)/, "업체 수·완료 건수 같은 숫자는 아직 없다(USP 4절)"],
  [/24시간 (내|안에)/, "«보통 24시간 내»는 화면에만 둔다 — 광고 문구로 키우지 않는다(USP 4절)"],
  [/본인인증/, "본인인증은 포트원 키 전(USP 4절)"],
];

test("스토어에 붙여 넣는 칸이 USP 4절(아직 말하면 안 되는 것)과 사실 아닌 말을 쓰지 않는다", () => {
  for (const [name, text] of CELLS()) {
    for (const [re, why] of NOT_TRUE) assert.ok(!re.test(text), `${name}: ${why} — «${text.match(re)?.[0]}»`);
  }
});

test("첫눈에 보이는 칸(이름·부제·프로모션·간단한 설명)은 아직 화면에 잘 안 나오는 시세(USP 4)를 앞세우지 않는다", () => {
  for (const [name, text] of CELLS().filter(([n]) => !n.includes("자세한"))) {
    assert.ok(!/시세/.test(text), `${name}: 평당 시세는 완공 표본 5건 전엔 안 보인다(USP 5절)`);
  }
});

// USP 최신판 · 광고 영상과 같은 말 — 스토어가 다른 이야기를 하면 영상을 보고 온 사람이 헷갈린다.
const usp = readFileSync(fileURLToPath(new URL("../../docs/USP-2026-10-02.md", import.meta.url)), "utf-8");

test("USP 최신판에 영상 자막과 «말하면 안 되는 것» 칸이 있다(스토어 문안의 출처)", () => {
  for (const cap of ["견적서 세 장, 셋 다 다른 말", "같은 조건으로, 나란히 비교", "공사는 품격 있게, 기록은 끝까지", "사장님은 광고비 없이", "무료 비교견적 받기 · 파트너 입점 1분"]) {
    assert.ok(usp.includes(cap), `USP 2-1 에 영상 자막이 없다: ${cap}`);
  }
  assert.ok(/## 4\. 아직 USP 로 말하면 안 되는 것/.test(usp));
});

test("스토어 자세한 설명이 USP 새 판 순서(걱정 → 해결 → 신뢰 → 전환)의 말을 담는다", () => {
  const body = section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"]);
  const order = ["셋 다 다른 말", "같은 조건", "나란히", "부가세·철거", "계약은 사업자등록을 확인한 업체와만", "광고비", "무료 비교견적 받기", "파트너 입점 1분"];
  let at = -1;
  for (const w of order) {
    const i = body.indexOf(w, at + 1);
    assert.ok(i > at, `자세한 설명에 «${w}»가 없거나 순서가 바뀌었다`);
    at = i;
  }
  assert.ok(field("프로모션 텍스트").includes("같은 조건"), "App Store 프로모션 텍스트가 USP 의 «같은 조건»을 말하지 않는다");
  assert.ok(field("앱 이름").includes("비교견적") && section(aso, "앱 이름 (30자)", ["간단한 설명"]).includes("비교견적"), "두 스토어 이름이 «비교견적»으로 같지 않다");
});

// 반대로 «계약은 사업자등록 확인 업체와만» 은 코드로 막혀 있는 우리만의 말이다 — 자세한 설명에서 빠지지 않게.
test("결제 안내는 기존 문장 그대로다(대표 10-02 — 바꾸지 않는다)", () => {
  assert.ok(section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"]).includes(PAY_NOTICE), "기존 결제 안내 문장이 바뀌었거나 빠졌다");
});

test("스토어 자세한 설명이 계약 단계의 사업자등록 확인을 말한다", () => {
  const body = section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"]);
  assert.ok(/계약은 사업자등록을 확인한 업체와만/.test(body), "ASO 자세한 설명에서 사라졌다");
});

// 10-02 로컬: App Store 설명에 «━»·«✓» 를 넣으면 거절된다 → «■»·«·» 로. App Store 설명은 ASO 자세한 설명을 그대로 붙여 넣는다.
test("App Store 에 붙여 넣는 칸에 «━»·«✓» 가 없다(애플 거절)", () => {
  const appstoreCells = [
    ["APPSTORE 앱 이름", field("앱 이름")], ["APPSTORE 부제", field("부제")], ["APPSTORE 키워드", field("키워드")],
    ["APPSTORE 프로모션 텍스트", field("프로모션 텍스트")],
    ["ASO 자세한 설명(= App Store 설명)", section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"])],
    ["APPSTORE 새로운 기능", section(doc, "이번 버전의 새로운 기능", ["카테고리"])],
  ];
  for (const [name, text] of appstoreCells) assert.ok(!/[━✓✔]/.test(text), `${name} 에 «━»·«✓» 가 있다 — «■»·«·» 로`);
});
