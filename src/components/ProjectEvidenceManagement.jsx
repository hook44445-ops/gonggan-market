import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getProjectChatSummary } from "../lib/supabase";
import { manwonToWon, formatWon, contractFinance } from "../lib/financeUtils";
import {
  flowStageLabel, paymentStatus, settlementStatus, escrowStatusLabel, shortId, fmtDate, txMatchesSearch,
} from "../lib/transactionUtils";
import { isTestRow } from "../lib/testAccounts";
import { useAdminProjectFlow } from "../hooks/useAdminProjectFlow";
import { Chip } from "./common/AdminTableUI";
import { evidenceChatDbg } from "../utils/adminChatDebug"; // 증빙관리 채팅 조회 진단(플래그 시에만 출력)
import { checkpointEvidenceBadge, parseGpsMissingReason } from "../utils/gpsCheckpoint"; // GPS+사진 증빙 상태/누락 사유(읽기 전용)

// ── 프로젝트 증빙관리(V2.3) — 분쟁 시 "누가·언제·어디서·무엇을" 확인하는 콘솔 ──
// 데이터: admin_project_flow_list(GPS/사진/계약/분쟁/리뷰/직거래의심) + 채팅 요약(읽기 전용).
// 읽기 전용 — 수정/삭제/자동제재 없음. 직거래 의심 키워드는 감지 표시만.
const KEYWORDS = ["카톡", "오픈채팅", "계좌", "현금", "직접 연락", "문자주세요", "수수료 빼고", "따로 거래", "직거래", "송금"];

const FILTERS = [
  ["all", "전체"], ["ongoing", "진행중"], ["completed", "완료"], ["dispute", "분쟁"],
  ["gps_missing", "GPS 누락"], ["photo_missing", "사진 누락"], ["no_chat", "채팅 없음"],
  ["ddr", "직거래 의심"], ["reviewed", "리뷰 완료"],
];

const cpFind = (cps, types) => (cps || []).find(c => types.includes(c.checkpoint_type)) || null;
const photoN = (cp) => (Array.isArray(cp?.photos) ? cp.photos.length : 0);
const hasGps = (cp) => !!cp && cp.lat != null && cp.lng != null;

// 한 행의 증빙 파생값(기존 GPS 흐름관리 로직과 동일 기준, 본 컴포넌트 로컬 구현).
export function deriveEvidence(row) {
  const cps = row.checkpoints || [];
  const esc = row.escrow || null;
  const ts  = esc?.transaction_status;
  const cpStart = cpFind(cps, ["start", "construction_start"]);
  const cpMid   = cpFind(cps, ["middle", "mid_inspection"]);
  const cpComp  = cpFind(cps, ["complete", "completion"]);
  const completeReached = ts === "COMPLETED" || ts === "SETTLED" || !!esc?.step4_approved_at || !!cpComp;
  const startReached    = ts === "STARTED" || !!cpStart || completeReached;
  const middleReached   = ts === "MID_INSPECTION" || !!cpMid || completeReached;

  const gpsCount   = cps.filter(c => c.lat != null && c.lng != null).length;
  const photoCount = cps.reduce((n, c) => n + photoN(c), 0);
  const ddrSuspect = (row.direct_deal_reports || []).length > 0;
  const disputed   = ts === "DISPUTE" || esc?.dispute_status != null;
  const reviewed   = (row.review_count ?? 0) > 0;
  const completed  = ts === "SETTLED" || ts === "COMPLETED" || !!esc?.step4_approved_at;

  const startMissing    = startReached    && !cpStart;
  const middleMissing   = middleReached   && !cpMid;
  const completeMissing = completeReached && !cpComp;
  const gpsMissing   = (completeReached && !hasGps(cpComp))
    || (startReached && cpStart && !hasGps(cpStart))
    || (middleReached && cpMid && !hasGps(cpMid));
  const photoMissing = (startReached && cpStart && photoN(cpStart) === 0)
    || (middleReached && cpMid && photoN(cpMid) === 0)
    || (completeReached && cpComp && photoN(cpComp) === 0);
  const evidenceMissing = gpsMissing || photoMissing || startMissing || middleMissing || completeMissing;

  return {
    gpsCount, photoCount, ddrSuspect, disputed, reviewed, completed,
    startMissing, middleMissing, completeMissing, gpsMissing, photoMissing, evidenceMissing,
    cpStart, cpMid, cpComp,
  };
}

const scanKeywords = (text) => KEYWORDS.filter(k => text && String(text).includes(k));

// 채팅 메시지가 이미지/파일/링크 URL이면 관리자 상세에서 라벨로 구분 표시(읽기 전용).
// chats.text는 not-null 단일 컬럼이라 별도 첨부 컬럼이 없다 — URL 형태만 감지해 표기한다.
const mediaLabel = (text) => {
  const t = String(text ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return null;
  if (/\.(png|jpe?g|gif|webp|heic|bmp)(\?|$)/i.test(t)) return "📷 사진";
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|hwp)(\?|$)/i.test(t)) return "📎 첨부파일";
  return "🔗 링크";
};

export default function ProjectEvidenceManagement({ adminUserId, showToast }) {
  const { rows, loading, errMsg, testSet, reload } = useAdminProjectFlow(adminUserId, { limit: 300 });
  const [chatMap, setChatMap] = useState(new Map()); // request_id -> { count, last, recent, kw }
  const [chatLoading, setChatLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [excludeTest, setExcludeTest] = useState(true);
  const [selected, setSelected] = useState(null);

  const txAll = rows;
  const testCount = txAll.filter(r => isTestRow(r, testSet)).length;
  const visibleRows = excludeTest ? txAll.filter(r => !isTestRow(r, testSet)) : txAll;

  const matchesFilter = (row) => {
    const ev = deriveEvidence(row);
    switch (filter) {
      case "all":           return true;
      case "ongoing":       return !ev.completed;
      case "completed":     return ev.completed;
      case "dispute":       return ev.disputed;
      case "gps_missing":   return ev.gpsMissing;
      case "photo_missing": return ev.photoMissing;
      case "ddr":           return ev.ddrSuspect;
      case "reviewed":      return ev.reviewed;
      case "no_chat":       return chatMap.has(row.request_id) ? (chatMap.get(row.request_id).count === 0) : false;
      default:              return true;
    }
  };
  const filtered = visibleRows.filter(row => txMatchesSearch(row, search) && matchesFilter(row));

  // 채팅 집계(on-demand) — 표시 중인 행에 한해 채팅 요약을 로드(과도한 자동조회 방지).
  const loadChatSummaries = async () => {
    if (chatLoading) return;
    setChatLoading(true);
    const target = filtered.slice(0, 120); // 비용 상한
    const next = new Map(chatMap);
    const chunk = 6;
    try {
      for (let i = 0; i < target.length; i += chunk) {
        const slice = target.slice(i, i + chunk);
        const results = await Promise.all(slice.map(async (row) => {
          const s = await getProjectChatSummary({
            customerId: row.customer?.id, companyId: row.company?.id, ownerId: row.company?.owner_id,
          });
          const kw = new Set();
          (s.recent || []).forEach(m => scanKeywords(m.text).forEach(k => kw.add(k)));
          return [row.request_id, { count: s.count, last: s.last, recent: s.recent, kw: [...kw] }];
        }));
        results.forEach(([id, v]) => next.set(id, v));
        setChatMap(new Map(next));
      }
      showToast?.(`채팅 집계 완료 (${target.length}건)`);
    } catch (e) {
      showToast?.("채팅 집계 일부 실패", false);
    } finally {
      setChatLoading(false);
    }
  };

  const Tag = ({ children, color, bg }) => (
    <span style={{ background: bg, color, borderRadius: R.sm, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{children}</span>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>프로젝트 증빙관리</div>
        <button onClick={reload} disabled={loading}
          style={{ marginLeft: "auto", background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        GPS, 사진, 채팅, 단계승인 증빙을 거래 단위로 확인합니다. 분쟁 발생 시 "누가·언제·어디서·무엇을" 진행했는지 추적하는 읽기 전용 콘솔입니다.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
          background: C.surface, border: `1px solid ${excludeTest ? C.brand : C.bgWarm}`, borderRadius: R.lg, padding: "8px 12px" }}>
          <input type="checkbox" checked={excludeTest} onChange={e => setExcludeTest(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: C.brand, cursor: "pointer" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>
            테스트 거래 제외 {!loading && testCount > 0 && <span style={{ color: C.text4, fontWeight: 500 }}>({testCount}건)</span>}
          </span>
        </label>
        <button onClick={loadChatSummaries} disabled={chatLoading || loading}
          style={{ background: chatLoading ? C.bgWarm : C.navyL ?? C.brandL, color: C.brand, border: `1px solid ${C.brandM ?? C.bgWarm}`,
            borderRadius: R.lg, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: chatLoading ? "default" : "pointer" }}>
          {chatLoading ? "채팅 집계 중..." : "💬 채팅 집계 로드"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="고객명 · 업체명 · 전화번호 · request_id · contract_id · 지역"
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>지우기</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {FILTERS.map(([v, l]) => (
          <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>{l}</Chip>
        ))}
      </div>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
        </div>
      )}
      {filter === "no_chat" && chatMap.size === 0 && (
        <div style={{ background: C.brandL, color: C.brand, borderRadius: R.lg, padding: "9px 12px", fontSize: 12, marginBottom: 12 }}>
          "채팅 없음" 필터는 💬 채팅 집계 로드 후 적용됩니다.
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>
        결과 {loading ? "…" : filtered.length}건 {!loading && visibleRows.length !== filtered.length && <span style={{ color: C.text4, fontWeight: 500 }}>/ 전체 {visibleRows.length}</span>}
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>해당 조건의 프로젝트가 없습니다</div>
      ) : (
        filtered.map(row => {
          const ev = deriveEvidence(row);
          const isTest = isTestRow(row, testSet);
          const fin = contractFinance(manwonToWon(row.escrow?.total_amount));
          const chat = chatMap.get(row.request_id);
          return (
            <div key={row.request_id} onClick={() => setSelected(row)}
              style={{ background: isTest ? "#FFFBEF" : C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                {isTest && <Tag color="#fff" bg="#8A5C00">TEST</Tag>}
                <span style={{ background: `${C.brand}1A`, color: C.brand, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>{flowStageLabel(row.flow_stage)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{row.area || "지역 미상"}</span>
                <span style={{ fontSize: 12, color: C.text3 }}>· {row.space_type || "—"}</span>
                {ev.completed && <span style={{ marginLeft: "auto", fontSize: 11, color: "#27AE60", fontWeight: 700 }}>완료</span>}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                고객 {row.customer?.name || "—"} · 업체 {row.company?.name || "미배정"} · 계약 {fin.gmv ? formatWon(fin.gmv) : "—"}
              </div>
              <div style={{ fontSize: 11, color: C.text4, marginBottom: 6, fontFamily: "monospace" }}>
                req {shortId(row.request_id)} · contract {shortId(row.escrow?.id)}
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>📍 GPS {ev.gpsCount}</span>
                <span>📷 사진 {ev.photoCount}</span>
                <span>💬 채팅 {chat ? `${chat.count}건${chat.last ? ` · ${fmtDate(chat.last)}` : ""}` : "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ev.disputed       && <Tag color={C.red}   bg="#FFF0F0">분쟁</Tag>}
                {ev.ddrSuspect     && <Tag color={C.red}   bg="#FFF0F0">직거래 의심</Tag>}
                {chat?.kw?.length  ? <Tag color="#9B59B6" bg="#F5EEF8">키워드 {chat.kw.length}</Tag> : null}
                {ev.evidenceMissing && <Tag color={C.gold} bg="#FBF5E8">증빙 누락</Tag>}
                {ev.reviewed       && <Tag color="#27AE60" bg="#EAF7EE">리뷰</Tag>}
              </div>
            </div>
          );
        })
      )}

      {selected && (
        <EvidenceDetail row={selected} chat={chatMap.get(selected.request_id)} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ── 증빙 상세(모달) — 탭: 타임라인/GPS/사진/채팅/계약·결제/분쟁·신고 ──────────
function EvidenceDetail({ row, chat: chatPreloaded, onClose }) {
  const esc = row.escrow;
  const ev = deriveEvidence(row);
  const fin = contractFinance(manwonToWon(esc?.total_amount));
  const cps = row.checkpoints || [];
  const [tab, setTab] = useState("timeline");
  const [chat, setChat] = useState(chatPreloaded || null);
  const [chatLoading, setChatLoading] = useState(false);

  const loadChat = async () => {
    if (chat || chatLoading) return;
    setChatLoading(true);
    const s = await getProjectChatSummary({
      customerId: row.customer?.id, companyId: row.company?.id, ownerId: row.company?.owner_id,
    });
    // 진단(기본 무출력) — room_id 후보 누락 재발 방지용. 프로젝트 1건 열 때 핵심 값 출력.
    evidenceChatDbg("프로젝트 채팅 조회", {
      project_id:    row.request_id,
      customerId:    row.customer?.id ?? null,
      companyId:     row.company?.id ?? null,
      ownerId:       row.company?.owner_id ?? null,
      roomCandidates: s.rooms ?? [],
      matchedRoomIds: s.matchedRoomIds ?? [],
      count:         s.count,
      error:         s.error?.message ?? null,
    });
    const kw = new Set();
    (s.recent || []).forEach(m => scanKeywords(m.text).forEach(k => kw.add(k)));
    setChat({ count: s.count, last: s.last, recent: s.recent, kw: [...kw] });
    setChatLoading(false);
  };
  useEffect(() => { if (tab === "chat") loadChat(); /* eslint-disable-next-line */ }, [tab]);

  // Project Timeline(Digital Twin 권장 순서) — 견적 → 프로젝트 채팅 → 현장방문(GPS) → 계약 →
  // 에스크로 결제 → 착공 → 중간점검 → 완료 → 리뷰 → 사진/첨부 → 정산. (읽기 전용, 기존 데이터 파생)
  const TIMELINE = [
    { key: "request",  label: "견적요청",        on: true },
    { key: "bid",      label: "입찰",            on: (row.bids_count ?? 0) > 0 },
    { key: "chat",     label: "프로젝트 채팅",   on: !!(chat?.count) },
    { key: "gps",      label: "현장방문(GPS)",   on: ev.gpsCount > 0 },
    { key: "contract", label: "계약",            on: !!esc },
    { key: "pay",      label: "에스크로 결제",   on: !!esc?.step1_deposited_at },
    { key: "start",    label: "착공",            on: ev.cpStart != null || esc?.transaction_status === "STARTED" },
    { key: "mid",      label: "중간점검",        on: ev.cpMid != null || esc?.transaction_status === "MID_INSPECTION" },
    { key: "complete", label: "완료",            on: ev.completed },
    { key: "review",   label: "리뷰",            on: ev.reviewed },
    { key: "photo",    label: "사진/첨부 증빙",  on: ev.photoCount > 0 },
    { key: "settle",   label: "정산",            on: esc?.transaction_status === "SETTLED" },
  ];
  const TABS = [
    ["timeline", "타임라인"], ["gps", `GPS ${ev.gpsCount}`], ["photo", `사진 ${ev.photoCount}`],
    ["chat", "채팅"], ["contract", "계약·결제"], ["dispute", "분쟁·신고"],
  ];

  const Row = ({ k, v }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12 }}>
      <span style={{ color: C.text3 }}>{k}</span>
      <span style={{ color: C.text1, fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
    </div>
  );

  const photoCps = cps.filter(c => photoN(c) > 0);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>증빙 상세</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text3 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>
          {row.area || "—"} · {row.customer?.name || "—"} ↔ {row.company?.name || "미배정"} · req {shortId(row.request_id)}
        </div>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {TABS.map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ padding: "6px 11px", borderRadius: R.full, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                border: `1px solid ${tab === v ? C.brand : C.bgWarm}`, cursor: "pointer",
                background: tab === v ? C.brand : C.surface, color: tab === v ? "#fff" : C.text2 }}>{l}</button>
          ))}
        </div>

        {tab === "timeline" && (
          <div style={{ background: C.bg, borderRadius: R.md, padding: "12px 14px" }}>
            {TIMELINE.map((t, i) => (
              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: t.on ? C.brand : C.bgWarm, color: "#fff", fontSize: 11, fontWeight: 800 }}>{t.on ? "✓" : i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.on ? C.text1 : C.text4 }}>{t.label}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "gps" && (
          <div>
            {cps.filter(c => c.lat != null || c.lng != null).length === 0 ? (
              <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>GPS 체크포인트가 없습니다</div>
            ) : cps.map((cp, i) => {
              const badge = checkpointEvidenceBadge(cp);
              const reason = parseGpsMissingReason(cp.note);
              return (
              <div key={cp.id || i} style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text2 }}>{cp.checkpoint_type || "체크포인트"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: badge.tone === "ok" ? "#27AE60" : badge.tone === "bad" ? C.red : "#B8860B" }}>{badge.icon} {badge.label}</span>
                </div>
                <Row k="lat / lng" v={cp.lat != null ? `${cp.lat}, ${cp.lng}` : "—"} />
                <Row k="주소" v={cp.road_address || cp.jibun_address || "—"} />
                <Row k="정확도(m)" v={cp.accuracy != null ? cp.accuracy : "—"} />
                <Row k="캡처 시각" v={fmtDate(cp.captured_at)} />
                <Row k="업로더" v={shortId(cp.captured_by)} />
                <Row k="사진" v={`${photoN(cp)}장`} />
                {reason && <Row k="GPS 누락 사유" v={`“${reason}”`} />}
              </div>
              );
            })}
          </div>
        )}

        {tab === "photo" && (
          <div>
            {photoCps.length === 0 ? (
              <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>등록된 사진 증빙이 없습니다</div>
            ) : photoCps.map((cp, i) => (
              <div key={cp.id || i} style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text2 }}>{cp.checkpoint_type} · {photoN(cp)}장</span>
                  <span style={{ fontSize: 11, color: C.text3 }}>{fmtDate(cp.captured_at)} · {shortId(cp.captured_by)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(cp.photos || []).map((p, j) => (
                    <img key={j} src={typeof p === "string" ? p : p?.url} alt="" loading="lazy"
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.sm, border: `1px solid ${C.bgWarm}` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "chat" && (
          <div>
            {chatLoading ? (
              <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>채팅 불러오는 중...</div>
            ) : !chat ? (
              <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>채팅 정보를 불러올 수 없습니다</div>
            ) : (
              <>
                <div style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px", marginBottom: 10 }}>
                  <Row k="메시지 수" v={`${chat.count}건`} />
                  <Row k="마지막 대화" v={fmtDate(chat.last)} />
                  <Row k="직거래 의심 키워드" v={chat.kw?.length ? chat.kw.join(", ") : "없음"} />
                </div>
                {chat.kw?.length > 0 && (
                  <div style={{ background: "#FFF0F0", color: C.red, borderRadius: R.md, padding: "8px 12px", fontSize: 11.5, marginBottom: 10, lineHeight: 1.6 }}>
                    ⚠️ 직거래 의심 키워드 감지({chat.kw.length}) — 표시 전용이며 자동 제재는 적용되지 않습니다.
                  </div>
                )}
                {(chat.recent || []).length === 0 ? (
                  <div style={{ color: C.text4, fontSize: 13, padding: "12px 0", textAlign: "center" }}>채팅 내역이 없습니다.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>최근 메시지</div>
                    {(chat.recent || []).slice(0, 20).map((m, i) => {
                      const hit = scanKeywords(m.text);
                      const att = mediaLabel(m.text); // 이미지/파일/링크 URL이면 라벨, 아니면 null
                      return (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.bg}` }}>
                          <div style={{ fontSize: 11, color: C.text4 }}>{m.sender_type || "—"} · {fmtDate(m.created_at)}</div>
                          <div style={{ fontSize: 12.5, color: hit.length ? C.red : C.text1, lineHeight: 1.5, wordBreak: "break-all" }}>
                            {att ? `${att} ${m.text}` : (m.text || "—")}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === "contract" && (
          <div style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px" }}>
            <Row k="계약번호(contract)" v={shortId(esc?.id)} />
            <Row k="계약금액(GMV)" v={fin.gmv ? formatWon(fin.gmv) : "—"} />
            <Row k="플랫폼 수수료(4.4%)" v={formatWon(fin.feeTotal)} />
            <Row k="정산예정금" v={fin.gmv ? formatWon(fin.companyPayout) : "—"} />
            <Row k="결제상태" v={paymentStatus(esc).label} />
            <Row k="에스크로상태" v={escrowStatusLabel(esc?.transaction_status)} />
            <Row k="정산상태" v={settlementStatus(esc).label} />
            <Row k="결제일" v={fmtDate(esc?.step1_deposited_at)} />
            <Row k="완료확인일" v={fmtDate(esc?.step4_approved_at)} />
          </div>
        )}

        {tab === "dispute" && (
          <div style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px" }}>
            <Row k="분쟁 여부" v={ev.disputed ? "분쟁 있음" : "없음"} />
            <Row k="분쟁 상태" v={esc?.dispute_status || "—"} />
            <Row k="분쟁 사유" v={esc?.dispute_reason || "—"} />
            <Row k="직거래 의심 신고" v={`${(row.direct_deal_reports || []).length}건`} />
            {(row.direct_deal_reports || []).map((d, i) => (
              <div key={d.id || i} style={{ fontSize: 11, color: C.text3, padding: "4px 0", borderTop: `1px solid ${C.bgWarm}` }}>
                {d.trigger_type} · {d.status} · {fmtDate(d.detected_at)}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6, marginTop: 12 }}>
          ※ 읽기 전용 증빙 콘솔입니다. 채팅·GPS·사진의 수정/삭제·자동 제재는 제공하지 않습니다. 직거래 의심 키워드는 감지 표시만 합니다.
        </div>
      </div>
    </div>
  );
}
