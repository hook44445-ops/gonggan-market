import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getAdminLogs } from "../lib/supabase";

// ── 관리자 로그 조회(ADMIN LOG VIEW v1) — admin_logs 읽기 전용 화면 ──────────────
// 기존 getAdminLogs() 재사용. 신규 DB/RPC/Migration 없음.
// 표시: created_at / admin_id / action / target_type / target_id / before_val / after_val / reason

// 액션 코드 → 한글 라벨(표시용). 매칭 없으면 원문 노출.
const ACTION_LABEL = {
  SET_COMPANY_BADGE:    "업체 배지 변경",
  SET_COMPANY_STATUS:   "업체 상태 변경",
  REGISTER_OPERATOR:    "운영자 등록",
  UPDATE_PERMISSIONS:   "운영자 권한 수정",
  RESET_PIN:            "PIN 재발급",
  UNREGISTER_OPERATOR:  "운영자 해제",
  SET_OPERATOR:         "운영자 지정",
  UNSET_OPERATOR:       "운영자 해제",
  SET_TEST_ACCOUNT:     "테스트 계정 지정",
  UNSET_TEST_ACCOUNT:   "테스트 계정 해제",
  SETTLEMENT_SET_STATUS:"정산 상태 변경",
  SETTLEMENT_SAVE_MEMO: "정산 메모 저장",
  HIDE_REVIEW:          "리뷰 숨김",
  UPDATE_REVIEW:        "리뷰 수정",
  HIDE_POST:            "라운지 글 숨김",
  UNHIDE_POST:          "라운지 글 노출",
};

// jsonb 값을 "키:값 · 키:값" 형태로 짧게 표현(원시값은 그대로).
function fmtVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return String(v);
  const keys = Object.keys(v);
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}: ${v[k] === null ? "—" : (typeof v[k] === "object" ? JSON.stringify(v[k]) : v[k])}`).join(" · ");
}

const fmtTime = (t) =>
  t ? new Date(t).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const shortId = (id) => (id ? String(id).slice(0, 8) : "—");

export default function AdminLogView() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);
  const [search, setSearch]   = useState("");

  const load = async () => {
    setLoading(true); setErrMsg(null);
    const { data, error } = await getAdminLogs();
    if (error) {
      setErrMsg(error.message || "조회 실패"); setRows([]);
    } else {
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const s = search.trim().toLowerCase();
  const filtered = !s ? rows : rows.filter((r) =>
    [r.action, r.target_type, r.target_id, r.admin_id, r.reason,
     JSON.stringify(r.before_val ?? ""), JSON.stringify(r.after_val ?? "")]
      .some((f) => f && String(f).toLowerCase().includes(s))
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>관리자 로그</div>
        <button onClick={load} disabled={loading}
          style={{ marginLeft: "auto", background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 12 }}>
        관리자·운영자 액션 기록(admin_logs)을 최신순으로 조회합니다. (읽기 전용)
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="액션 · 대상유형 · 대상ID · 관리자 · 사유 검색"
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>지우기</button>
        )}
      </div>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>
        로그 {loading ? "…" : filtered.length}건 {!loading && rows.length !== filtered.length && <span style={{ color: C.text4, fontWeight: 500 }}>/ 전체 {rows.length}</span>}
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>표시할 로그가 없습니다</div>
      ) : (
        filtered.map((r) => {
          const before = fmtVal(r.before_val);
          const after = fmtVal(r.after_val);
          return (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: C.text3 }}>{fmtTime(r.created_at)}</span>
                <span style={{ background: `${C.brand}1A`, color: C.brand, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>
                  {ACTION_LABEL[r.action] || r.action || "—"}
                </span>
                {r.target_type && (
                  <span style={{ fontSize: 11, color: C.text4 }}>{r.target_type} · {shortId(r.target_id)}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: (before || after || r.reason) ? 6 : 0 }}>
                관리자: <span style={{ fontFamily: "monospace" }}>{r.admin_id ? shortId(r.admin_id) : "코드관리자(admin)"}</span>
              </div>
              {(before || after) && (
                <div style={{ fontSize: 12.5, color: C.text1, lineHeight: 1.55 }}>
                  {before && <span style={{ color: C.text3 }}>{before}</span>}
                  {before && after && <span style={{ color: C.text4 }}> → </span>}
                  {after && <span style={{ fontWeight: 600 }}>{after}</span>}
                </div>
              )}
              {r.reason && (
                <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>사유: {r.reason}</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
