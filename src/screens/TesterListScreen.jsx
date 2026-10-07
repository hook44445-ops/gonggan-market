import { useEffect, useState } from "react";
import { getTesterSignups, markTesterSignup } from "../lib/supabase";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// ════════════════════════════════════════════════════════════════════════════
// /testers — 안드로이드 테스터 신청 목록(대표 09-28 · 147)
//   /download 에서 누가 구글 메일을 남기면 대표 휴대폰(공간랜드 앱)으로 푸시가 오고, 누르면 여기로 온다.
//   Play Console › 비공개 테스트 › 테스터 목록에 메일을 붙여 넣은 뒤 「추가함」을 눌러 표시한다.
//   볼 수 있는 사람: 관리자 또는 대표 번호 계정(로그인 토큰 — 서버가 판정). 메일은 개인정보라 검색에 걸리지 않게 noindex.
// ════════════════════════════════════════════════════════════════════════════

const C = {
  green: "#2E5F4B", bg: "#F5F1EA", surface: "#FFFFFF", line: "#E4DDD0",
  text1: "#1F2A24", text2: "#3A4A3E", text3: "#7A8A7E", beige: "#FBF7EF",
};

const fmt = (iso) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function TesterListScreen() {
  useDocumentMeta({ title: "테스터 신청 목록 — 공간랜드", description: "관리자 전용", path: "/testers" });
  useEffect(() => {   // 검색에 걸리지 않게(목록은 로그인 토큰 없이는 비어 있지만 페이지 자체도 막는다)
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTesterSignups().then(({ data, error }) => {
      if (error) {
        const m = String(error.message ?? "");
        setState({ loading: false, error: /OWNER_ONLY/.test(m)
          ? "공간랜드 앱에서 대표 번호(관리자) 계정으로 로그인한 뒤 이 알림을 다시 열어 주세요."
          : /tester_signups_list/.test(m) ? "아직 준비 중이에요(SQL 147)." : "목록을 불러오지 못했어요." });
        return;
      }
      setRows(data ?? []);
      setState({ loading: false, error: null });
    });
  }, []);

  const waiting = rows.filter(r => !r.added_at);

  const copyWaiting = async () => {
    const text = waiting.map(r => r.email).join(", ");
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("복사해서 Play Console 에 붙여 넣으세요", text); }
  };

  const toggle = async (r) => {
    const next = !r.added_at;
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, added_at: next ? new Date().toISOString() : null } : x));
    const { error } = await markTesterSignup(r.id, next);
    if (error) setRows(prev => prev.map(x => x.id === r.id ? { ...x, added_at: r.added_at } : x));   // 되돌림
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.text1 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <a href="/" aria-label="공간랜드 홈" style={{ fontSize: 22, color: C.text1, textDecoration: "none" }}>←</a>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>테스터 신청 목록</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>Play Console › 비공개 테스트 › 테스터 목록에 넣어 주세요</div>
          </div>
        </div>

        {state.loading && <div style={{ fontSize: 13, color: C.text3, textAlign: "center", padding: 24 }}>불러오는 중…</div>}
        {state.error && (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, fontSize: 13.5, lineHeight: 1.6, color: C.text2 }}>
            {state.error}
          </div>
        )}

        {!state.loading && !state.error && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[["전체", rows.length], ["추가 대기", waiting.length], ["추가함", rows.length - waiting.length]].map(([k, v]) => (
                <div key={k} style={{ flex: 1, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: k === "추가 대기" && v > 0 ? C.green : C.text1 }}>{v}</div>
                </div>
              ))}
            </div>

            <button onClick={copyWaiting} disabled={waiting.length === 0}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", marginBottom: 16,
                background: waiting.length ? C.green : "#D8D2C6", color: "#fff", fontSize: 15, fontWeight: 800,
                cursor: waiting.length ? "pointer" : "default" }}>
              {copied ? "복사했어요 — Play Console 에 붙여 넣으세요" : `추가 대기 메일 ${waiting.length}개 한 번에 복사`}
            </button>

            {rows.length === 0 && (
              <div style={{ background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 14, padding: 20, textAlign: "center", fontSize: 13, color: C.text3 }}>
                아직 신청이 없어요. 마이 › 친구 초대 › 「테스터 부탁 보내기」로 링크를 보내 보세요.
              </div>
            )}

            {rows.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`,
                borderRadius: 12, padding: "12px 14px", marginBottom: 8, opacity: r.added_at ? 0.6 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "break-all" }}>{r.email}</div>
                  <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
                    {[r.name, fmt(r.created_at), r.ref_code ? `초대 ${r.ref_code}` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button onClick={() => toggle(r)} aria-pressed={!!r.added_at}
                  style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                    border: `1.5px solid ${C.green}`, background: r.added_at ? C.green : C.surface, color: r.added_at ? "#fff" : C.green }}>
                  {r.added_at ? "추가함 ✓" : "추가함"}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
