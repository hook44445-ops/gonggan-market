import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { warrantyCareItem } from "../lib/homeCare";
import { kstDay } from "../lib/pageViews";
import { getEstimateForRequest, addHomeCareItem } from "../lib/supabase";

// 공사 완료 뒤 «하자보수 끝나기 전 알림» 제안 — 후기를 안 쓰는 고객도 보게(09-29 · 재방문).
//   견적서 하자보수 기간이 없거나, 이미 적었거나 닫았으면(요청마다 한 번) 안 보인다.
const KEY = "gonggan_warranty_offer";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") || {}; } catch { return {}; } };
export const warrantyOffered = (requestId) => !!(requestId && read()[requestId]);
export const markWarrantyOffered = (requestId, v = "done") => {
  if (!requestId) return;
  try { const all = read(); all[requestId] = v; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 기기 저장 못 해도 진행 */ }
};

export default function WarrantyCareOffer({ userId, requestId, companyName }) {
  const [note, setNote] = useState(null);     // 견적서 하자보수 조건 글
  const [closed, setClosed] = useState(false);
  const [state, setState] = useState(null);   // null | "busy" | "done" | 오류 문구

  useEffect(() => {
    if (!userId || !requestId || warrantyOffered(requestId)) return;
    let alive = true;
    getEstimateForRequest(requestId).then(({ data }) => {
      const e = Array.isArray(data) ? data[0] : data;
      if (alive && e?.warranty_note) setNote(e.warranty_note);
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId, requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 업체 이름은 화면이 나중에 받아 올 수 있어 그릴 때 계산한다
  const item = closed ? null : warrantyCareItem({ warrantyNote: note, companyName, doneOn: kstDay() });
  if (!item) return null;
  const add = async () => {
    if (state === "busy" || state === "done") return;
    setState("busy");
    const { kind, label, cycle_months, done_on, memo } = item;
    const res = await addHomeCareItem(userId, { kind, label, cycle_months, done_on, memo }).catch(() => null);
    if (res?.data) { markWarrantyOffered(requestId); setState("done"); }
    else setState("지금은 적지 못했어요 · 마이 › 내 집 관리 수첩에서 적을 수 있어요");
  };
  const close = () => { markWarrantyOffered(requestId, "closed"); setClosed(true); };

  return (
    <div style={{ margin: `${S.md}px ${S.lg}px`, background: C.surface, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b style={{ fontSize: 13.5, color: C.text1 }}>🛠 하자보수는 {item.until}까지예요</b>
        <button onClick={close} aria-label="닫기" style={{ background: "none", border: "none", color: C.text3, fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginTop: 3, lineHeight: 1.6 }}>
        내 집 관리 수첩에 적어 두면 끝나기 한 달 전에 알려 드려요 — 그때 집을 둘러보고 업체에 말하면 돼요.
      </div>
      <button onClick={add} disabled={state === "busy" || state === "done"}
        style={{ marginTop: 8, width: "100%", padding: 11, borderRadius: R.md, border: `1.5px solid ${state === "done" ? C.brand : C.brandM}`,
          background: C.brandL, color: C.brand, fontSize: 13.5, fontWeight: 800, cursor: state === "done" ? "default" : "pointer" }}>
        {state === "done" ? "✓ 수첩에 적었어요" : state === "busy" ? "적는 중…" : "수첩에 적고 알림 받기"}
      </button>
      {state && state !== "busy" && state !== "done" && <div style={{ fontSize: 12, color: "#B4432F", marginTop: 6 }}>{state}</div>}
    </div>
  );
}
