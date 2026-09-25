// 저장소(Supabase Storage) 경로의 마지막 조각(파일 이름)을 영문·숫자로만 — 점검 6차(09-25).
//   Storage 는 한글 등 ASCII 밖 글자가 든 키를 「Invalid key」로 거절한다. 휴대폰에서 카카오톡 등으로 받은 사진은
//   이름이 한글인 경우가 많아, 업체가 공사 사진·서류·포트폴리오를 올리다 막혔다.
//   폴더 부분(요청·업체 ID 등)은 그대로 두고, 파일 이름에서 안전한 글자만 남긴다. 확장자는 지킨다.
export function safeStorageKey(path) {
  const s = String(path ?? "");
  const cut = s.lastIndexOf("/");
  const dir = cut >= 0 ? s.slice(0, cut + 1) : "";
  const name = cut >= 0 ? s.slice(cut + 1) : s;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  let safe = base.replace(/\s+/g, "_").replace(/[^A-Za-z0-9._-]/g, "").replace(/_+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
  if (!safe) safe = `f${Math.random().toString(36).slice(2, 8)}`;
  return `${dir}${safe}${ext ? `.${ext}` : ""}`;
}
