import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import {
  getChangeOrders, createChangeOrder, setChangeOrderAmount,
  approveChangeOrder, rejectChangeOrder,
  completeChangeOrder, cancelChangeOrder, createNotification, uploadFile,
} from "../lib/supabase";
import { payChangeOrder } from "../services/payment";
import ImageViewerModal from "./ImageViewerModal"; // QA: 변경요청 사진 확대보기(Add Only)

// 추가견적은 예외 흐름 — 일반 기능처럼 보이지 않도록 업체 화면에선 "문제 발생" 안에 접어 둔다.
const REASONS = [
  ["hidden_defect",    "숨은 하자 발견"],
  ["plumbing_issue",   "배관 노후/문제"],
  ["leak_issue",       "누수"],
  ["electrical_issue", "전기 배선 문제"],
  ["layout_change",    "구조/배치 변경"],
  ["customer_request", "고객 변경 요청"],
  ["material_upgrade", "자재 업그레이드"],
  ["etc",              "기타 불가피한 현장 이슈"],
];
const REASON_LABEL = Object.fromEntries(REASONS);

const STATUS_META = {
  requested:       { label: "요청됨",     fg: "#7A5C1E", bg: C.sand },
  approved:        { label: "승인됨",     fg: C.brand,   bg: C.brandL },
  payment_pending: { label: "결제 대기",  fg: "#7A5C1E", bg: C.sand },
  paid:            { label: "결제 완료",  fg: C.brand,   bg: C.brandL },
  completed:       { label: "완료",       fg: C.green,   bg: C.greenL },
  rejected:        { label: "거절됨",     fg: C.text4,   bg: C.bg },
  cancelled:       { label: "취소됨",     fg: C.text4,   bg: C.bg },
};

const fmtAmt = (n) => `${Number(n ?? 0).toLocaleString()}만원`;

function Backdrop({ onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 320 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
        {children}
      </div>
    </div>
  );
}

export default function ChangeOrderPanel({ contractId, requestId = null, actorId, role, customerId, companyOwnerId, onChanged }) {
  const isCompany = role === "company";
  const [orders, setOrders] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);     // 업체: "문제 발생" 접힘
  const [approveTarget, setApproveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null); // QA: 변경요청 사진 확대보기 { images, index }

  const load = () => {
    if (!contractId) return;
    getChangeOrders(contractId)
      .then(({ data }) => { if (Array.isArray(data)) setOrders(data); })
      .catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contractId]);

  const notify = (toId, type, title, message) => {
    if (!toId) return;
    createNotification({ userId: toId, type, title, message, relatedId: contractId, relatedType: "contract", priority: "HIGH" }).catch(() => {});
  };

  const runAction = async (fn, okMsg, notifyArgs) => {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { alert("처리 실패: " + (error.message ?? "")); return; }
    if (notifyArgs) notify(...notifyArgs);
    load();
    onChanged?.();
  };

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
      {photoViewer && (
        <ImageViewerModal images={photoViewer.images} startIndex={photoViewer.index} onClose={() => setPhotoViewer(null)} />
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🧩 추가견적</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.lg }}>
        추가견적은 원계약에 포함되지 않은 예외 작업입니다. 숨은 하자·변경 요청 등 꼭 필요한 경우에만 사용해 주세요.
      </div>

      {/* 목록 */}
      {orders.length === 0 ? (
        <div style={{ fontSize: 13, color: C.text4, padding: `${S.md}px 0`, textAlign: "center" }}>등록된 추가견적이 없습니다.</div>
      ) : orders.map((o) => {
        const sm = STATUS_META[o.status] ?? STATUS_META.requested;
        const mineCompanyReq = o.requested_by_role === "consumer"; // 고객이 올린 변경요청(업체가 금액 제시 가능)
        return (
          <div key={o.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.lg, marginBottom: S.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{REASON_LABEL[o.reason_type] ?? "추가 작업"}</span>
              <span style={{ background: sm.bg, color: sm.fg, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{sm.label}</span>
            </div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 6 }}>{o.description}</div>
            <div style={{ fontSize: 11, color: C.text4, marginBottom: 6 }}>
              {o.requested_by_role === "company" ? "업체 요청" : "고객 변경요청"} · 추가금액 <b style={{ color: C.brand }}>{fmtAmt(o.amount)}</b>
            </div>
            {Array.isArray(o.photos) && o.photos.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {o.photos.map((u, i) => (
                  <div key={i} onClick={() => setPhotoViewer({ images: o.photos, index: i })}
                    style={{ width: 56, height: 56, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgWarm}`, cursor: "zoom-in" }}>
                    <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}

            {/* 액션 */}
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
              {/* 고객: 업체가 올린 추가견적 requested → 승인/거절 (본인 변경요청은 업체 금액 제시 대기) */}
              {!isCompany && o.status === "requested" && o.requested_by_role === "company" && (
                <>
                  <button disabled={busy} onClick={() => setApproveTarget(o)} style={btn(C.brand, "#fff")}>승인</button>
                  <button disabled={busy} onClick={() => runAction(() => rejectChangeOrder(o.id, actorId), null, [companyOwnerId, "CHANGE_ORDER_RESULT", "추가견적 거절", "고객이 추가견적을 거절했습니다."])} style={btnGhost()}>거절</button>
                </>
              )}
              {/* 고객: approved/payment_pending → 추가 결제(원계약과 분리된 결제주문 생성) */}
              {!isCompany && (o.status === "approved" || o.status === "payment_pending") && (
                <button disabled={busy} onClick={() => runAction(
                  () => payChangeOrder({ order: o, contractId, requestId, userId: actorId, paymentMethod: "CARD" }),
                  null,
                  [companyOwnerId, "CHANGE_ORDER_RESULT", "추가견적 결제 완료", "고객이 추가 결제를 완료했습니다. 추가 공사를 진행해 주세요."]
                )} style={btn(C.brand, "#fff")}>추가 결제하기</button>
              )}
              {/* 업체: 고객 변경요청 requested → 금액 제시 */}
              {isCompany && o.status === "requested" && mineCompanyReq && (
                <button disabled={busy} onClick={() => setShowCreate({ editId: o.id, base: o })} style={btnGhost()}>금액 제시/수정</button>
              )}
              {/* 업체: paid → 추가공사 완료 */}
              {isCompany && o.status === "paid" && (
                <button disabled={busy} onClick={() => runAction(() => completeChangeOrder(o.id, actorId), null, [customerId, "CHANGE_ORDER_RESULT", "추가 공사 완료", "추가 공사가 완료 처리되었습니다."])} style={btn(C.brand, "#fff")}>추가공사 완료</button>
              )}
              {/* 양측: 결제 전 취소 */}
              {["requested", "approved", "payment_pending"].includes(o.status) && (
                <button disabled={busy} onClick={() => runAction(() => cancelChangeOrder(o.id, actorId))} style={btnGhost()}>취소</button>
              )}
            </div>
          </div>
        );
      })}

      {/* 생성 진입 — 업체는 "문제 발생" 안에 숨김, 고객은 "변경 요청하기" */}
      <div style={{ marginTop: S.md }}>
        {isCompany ? (
          <>
            <button onClick={() => setMoreOpen((v) => !v)} style={{ width: "100%", padding: S.md, background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, fontWeight: 700, color: C.text3, cursor: "pointer" }}>
              {moreOpen ? "▲ 문제 발생 / 더보기" : "▼ 문제 발생 / 더보기"}
            </button>
            {moreOpen && (
              <button onClick={() => setShowCreate({})} style={{ width: "100%", marginTop: S.sm, padding: S.lg, background: C.surface, border: `1.5px solid ${C.brandM}`, borderRadius: R.lg, fontSize: 14, fontWeight: 800, color: C.brand, cursor: "pointer" }}>
                + 추가견적 요청
              </button>
            )}
          </>
        ) : (
          <button onClick={() => setShowCreate({})} style={{ width: "100%", padding: S.lg, background: C.surface, border: `1.5px solid ${C.brandM}`, borderRadius: R.lg, fontSize: 14, fontWeight: 800, color: C.brand, cursor: "pointer" }}>
            + 변경 요청하기
          </button>
        )}
      </div>

      {showCreate && (
        <CreateModal
          isCompany={isCompany} actorId={actorId} contractId={contractId}
          edit={showCreate.editId ? showCreate.base : null}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); onChanged?.(); notify(isCompany ? customerId : companyOwnerId, "CHANGE_ORDER_REQUEST", isCompany ? "추가견적 요청 도착" : "변경 요청 도착", isCompany ? "업체가 추가견적을 요청했습니다. 확인 후 승인해 주세요." : "고객이 변경을 요청했습니다."); }}
        />
      )}

      {approveTarget && (
        <ApproveModal
          order={approveTarget} actorId={actorId}
          onClose={() => setApproveTarget(null)}
          onDone={() => { setApproveTarget(null); load(); onChanged?.(); notify(companyOwnerId, "CHANGE_ORDER_RESULT", "추가견적 승인", "고객이 추가견적을 승인했습니다."); }}
        />
      )}
    </div>
  );
}

const btn = (bg, fg) => ({ flex: 1, minWidth: 88, padding: "10px", background: bg, color: fg, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: "pointer" });
const btnGhost = () => ({ flex: 1, minWidth: 88, padding: "10px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" });

// ── 생성/금액수정 모달 ──
function CreateModal({ isCompany, actorId, contractId, edit, onClose, onDone }) {
  const [reasonType, setReasonType] = useState(edit?.reason_type ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [amount, setAmount] = useState(edit?.amount != null ? String(edit.amount) : "");
  const [photos, setPhotos] = useState(edit?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const pickPhotos = async (e) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photos.length);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // 저장 경로는 항상 안전한 키(인덱스+확장자)로 고정 — 파일명에 공백/한글/특수문자가 있으면
      // 스토리지가 키를 거부해 업로드가 조용히 실패하던 문제 방지(현장 확인 사진과 동일 규칙).
      const ext = (f.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      try {
        const url = await uploadFile("documents", `change_orders/${contractId}/${Date.now()}_${i}.${ext}`, f);
        if (url) urls.push(url);
      } catch (err) { console.error("[CHANGE_ORDER_PHOTO_UPLOAD_FAILED]", err); }
    }
    setPhotos((p) => [...p, ...urls].slice(0, 3));
    setUploading(false);
  };

  const submit = async () => {
    if (!reasonType) { alert("사유를 선택해 주세요"); return; }
    if (!description.trim()) { alert("사유 설명을 입력해 주세요"); return; }
    setSaving(true);
    const amt = amount ? Number(amount) : 0;
    const { error } = edit
      ? await setChangeOrderAmount(edit.id, { actorId, amount: amt, description, photos })
      : await createChangeOrder({ contractId, actorId, role: isCompany ? "company" : "consumer", reasonType, description, amount: amt, photos });
    setSaving(false);
    if (error) { alert("저장 실패: " + (error.message ?? "")); return; }
    onDone();
  };

  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
        {edit ? "추가견적 금액 제시" : isCompany ? "추가견적 요청" : "변경 요청하기"}
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.lg }}>
        예외 작업에만 사용합니다. 사유와 설명은 필수, 사진 첨부를 권장합니다.
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>사유 *</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.lg }}>
        {REASONS.map(([k, label]) => (
          <button key={k} onClick={() => setReasonType(k)} style={{ padding: "8px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: reasonType === k ? C.brand : C.bg, color: reasonType === k ? "#fff" : C.text2, border: `1px solid ${reasonType === k ? C.brand : C.bgWarm}` }}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>사유 설명 *</div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
        placeholder={isCompany ? "예) 철거 후 배관 노후 확인 — 교체 필요" : "예) 붙박이장 추가를 요청합니다"}
        style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 14, outline: "none", boxSizing: "border-box", color: C.text1, background: C.surface, fontFamily: "inherit", resize: "none", marginBottom: S.lg }} />

      {(isCompany || edit) && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>추가 금액 (만원)</div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예) 80"
            style={{ width: "100%", padding: "13px 16px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 15, outline: "none", boxSizing: "border-box", color: C.text1, background: C.surface, fontFamily: "inherit", marginBottom: S.lg }} />
        </>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>사진 (권장, 최대 3장)</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.xl }}>
        {photos.map((u, i) => (
          <div key={i} style={{ width: 72, height: 72, borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
            <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ))}
        {photos.length < 3 && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 72, height: 72, borderRadius: R.md, border: `2px dashed ${C.bgWarm}`, background: C.bg, fontSize: 22, color: C.text3, cursor: "pointer" }}>{uploading ? "..." : "+"}</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pickPhotos} />
      </div>

      <button onClick={submit} disabled={saving} style={{ width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "처리중..." : edit ? "금액 제시하기" : "제출하기"}
      </button>
    </Backdrop>
  );
}

// ── 고객 승인 모달 (확인 문구 + 체크박스 필수) ──
function ApproveModal({ order, actorId, onClose, onDone }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!checked) return;
    setSaving(true);
    const { error } = await approveChangeOrder(order.id, actorId);
    setSaving(false);
    if (error) { alert("승인 실패: " + (error.message ?? "")); return; }
    onDone();
  };
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: S.md }}>추가견적 승인</div>
      <div style={{ background: C.sand, borderRadius: R.lg, padding: S.lg, marginBottom: S.lg }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{REASON_LABEL[order.reason_type] ?? "추가 작업"} · {fmtAmt(order.amount)}</div>
        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>{order.description}</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.8, marginBottom: S.lg }}>
        추가견적은 <b>원계약에 포함되지 않은 작업</b>입니다.<br />
        승인 후에는 <b>추가 결제</b>가 진행됩니다.<br />
        내용을 확인 후 승인해 주세요.
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: S.xl, cursor: "pointer", fontSize: 13, color: C.text1 }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: 18, height: 18 }} />
        위 내용을 확인했으며 추가 결제 진행에 동의합니다.
      </label>
      <button onClick={submit} disabled={!checked || saving} style={{ width: "100%", padding: S.xl, background: checked ? C.brand : C.bgWarm, color: checked ? "#fff" : C.text4, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: checked ? "pointer" : "not-allowed" }}>
        {saving ? "처리중..." : "승인하기"}
      </button>
    </Backdrop>
  );
}
