// ════════════════════════════════════════════════════════════════════
// 공간라운지 Story Engine — 연재(시리즈) 시스템 (Phase 24)
//
//   공간을 무대로 한 연재물을 운영한다: 시리즈 · 세계관 · 등장인물 · Story Bible ·
//   Episode 자동 증가 · 다음 화 힌트 · 회차 관리. 하루 최소 1편의 다음 화 후보를 만든다.
//
//   생성 자체는 기존 편집국 엔진(generateForWorkbench, mode:'voice'/v3)을 그대로 쓰고,
//   발행은 기존 스토리 발행 흐름(is_story=true insert)을 재사용한다 — 여기서는 "Story Bible"
//   상태와 "다음 화 프롬프트"만 조립한다.
//
//   ⚠️ Regression Zero: DB/Migration/Cron/API 없음. Story Bible 은 localStorage 에만 저장.
//   순수 함수 · 기존 엔진 무수정.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_story_bible_v1";

const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} return list; };
const uid = () => `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// 시리즈 목록.
export function getSeriesList() { return load(); }
export function getSeries(id) { return load().find((s) => s.id === id) || null; }

// 시리즈 생성/수정.
//   { title, world, characters:[{name, role, note}], synopsis, cadenceHours, category }
export function upsertSeries(input = {}) {
  const list = load();
  if (input.id) {
    const next = list.map((s) => (s.id === input.id ? { ...s, ...input, updatedAt: Date.now() } : s));
    return save(next).find((s) => s.id === input.id);
  }
  const series = {
    id: uid(),
    title: input.title || "제목 없는 연재",
    world: input.world || "",
    characters: Array.isArray(input.characters) ? input.characters : [],
    synopsis: input.synopsis || "",
    category: input.category || "daily",
    cadenceHours: Number.isFinite(input.cadenceHours) ? input.cadenceHours : 24, // 연재 주기(기본 하루 1편)
    episode: 0,           // 마지막 발행 회차
    lastPublishedAt: null,
    episodes: [],         // [{ n, title, hint, at }]
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  return save([series, ...list])[0];
}

export function removeSeries(id) { return save(load().filter((s) => s.id !== id)); }

// 회차 자동 증가 — 다음 화 발행을 기록(episode+1). 생성/발행 성공 후 호출.
export function advanceEpisode(id, { title = "", hint = "" } = {}, now = Date.now()) {
  const list = load();
  const next = list.map((s) => {
    if (s.id !== id) return s;
    const n = (s.episode || 0) + 1;
    return { ...s, episode: n, lastPublishedAt: now, updatedAt: now,
      episodes: [{ n, title, hint, at: now }, ...(s.episodes || [])].slice(0, 100) };
  });
  save(next);
  return next.find((s) => s.id === id);
}

// 다음 화 힌트 — Story Bible + 직전 회차로 다음 전개 방향을 제안(결정론적).
export function nextEpisodeHint(series) {
  if (!series) return "";
  const n = (series.episode || 0) + 1;
  const last = (series.episodes || [])[0];
  const beat = ["새로운 공간과의 만남", "관계의 변화", "작은 사건과 선택", "공간이 남긴 흔적", "다음 계절로의 이행"][n % 5];
  return `${series.title} ${n}화 — ${beat}` + (last ? ` (직전: ${last.title || `${last.n}화`})` : "");
}

// 다음 화 생성 프롬프트 — generateForWorkbench(issue) 에 넣을 "주제 문자열"을 만든다.
export function nextEpisodePrompt(series) {
  if (!series) return "";
  const n = (series.episode || 0) + 1;
  const chars = (series.characters || []).map((c) => `${c.name}(${c.role || "인물"})`).join(", ");
  return [
    `[연재] ${series.title} ${n}화`,
    series.world ? `세계관: ${series.world}` : "",
    chars ? `등장인물: ${chars}` : "",
    series.synopsis ? `줄거리: ${series.synopsis}` : "",
    `방향: ${nextEpisodeHint(series)}`,
    "공간라운지 연재 스토리 톤으로 이어서 써라.",
  ].filter(Boolean).join("\n");
}

// 오늘 다음 화 후보 — 연재 주기(cadence)가 도래한 시리즈들. 하루 최소 1편 지향.
export function dueSeries(now = Date.now()) {
  return load()
    .filter((s) => !s.lastPublishedAt || now - s.lastPublishedAt >= (s.cadenceHours || 24) * 36e5)
    .map((s) => ({ series: s, nextN: (s.episode || 0) + 1, hint: nextEpisodeHint(s), prompt: nextEpisodePrompt(s) }));
}
