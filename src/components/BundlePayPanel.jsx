// 공정 묶음 분할 결제 화면(10-07 · SQL 205 · lib/bundlePay) — 최종 견적서 결제 단계에 붙는다.
//  · 묶음마다 1천만 원 미만 · 한 묶음을 여러 번(카드 여러 장 · 가상계좌 여러 개 섞어) 나눠 낸다 · 모두 채우면 계약 확정
//  · 가상계좌를 맨 위에 둔다(우리 비용이 싸다). 수단별 요금 차이는 쓰지 않는다(수수료는 공간사이 부담 · 여신전문금융업법 19조)
//  · 결제가 열리기 전엔 «결제가 열리면 이렇게 나눠 낼 수 있어요» 미리 보기 — 버튼은 꺼 둔다(없는 기능 약속 금지)
//  · 서버(205)를 못 읽으면 견적서로 앱이 같은 규칙으로 나눠 미리 보여 준다(저장·결제는 하지 않는다)
import { useEffect, useMemo, useState } from "react";
import { C, R, S } from "../constants";
import { BUNDLE_PAY_LIVE } from "../constants/release";
import {
  BUNDLE_METHODS, VA_DUE_DAYS, PART_ERRORS, splitIntoBundles, quoteLines, planSummary, checkPartAmount, fmtWon, headline,
} from "../lib/bundlePay";
import { getBundlePlan, startBundlePart } from "../lib/supabase";
import { getProvider } from "../services/payment";
import { ACTIVE_PROVIDER } from "../services/payment/constants";

const GOLD = "#C8A15A";
// 토스 은행 코드 → 이름(자주 쓰는 곳만 · 모르면 «은행 코드 NN»)
const BANKS = { "39": "경남", "34": "광주", "06": "국민", "03": "기업", "11": "농협", "31": "대구", "32": "부산", "45": "새마을",
  "07": "수협", "88": "신한", "48": "신협", "27": "씨티", "20": "우리", "71": "우체국", "37": "전북", "35": "제주",
  "90": "카카오뱅크", "89": "케이뱅크", "92": "토스뱅크", "81": "하나", "23": "SC제일" };
const bankName = (va) => va?.bank ?? (va?.bankCode ? (BANKS[va.bankCode] ?? `은행 코드 ${va.bankCode}`) : "은행");
const dueText = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}까지`;
};
const STATUS_CHIP = {
  PAID:    { label: "결제 완료", bg: C.brandL, fg: C.brand },
  PENDING: { label: "입금 기다리는 중", bg: "#FBF3E2", fg: "#8A6420" },
  PARTIAL: { label: "일부 결제", bg: "#FBF3E2", fg: "#8A6420" },
  OPEN:    { label: "결제 전", bg: C.surface2, fg: C.text3 },
};
const PART_LABEL = { DONE: "완료", WAITING_FOR_DEPOSIT: "입금 대기", REQUESTED: "진행 중" };

// 서버 응답(205) → 화면 모양. 서버를 못 읽으면 견적서로 미리 보기.
function fromServer(p) {
  const bundles = (p.bundles ?? []).map((b) => ({ ...b, amountWon: Number(b.amount_won) || 0 }));
  return { source: "server", open: !!p.open, vaDueDays: p.va_due_days ?? VA_DUE_DAYS, bundles, escrowId: p.escrow_id ?? null };
}
function fromQuote(estimate, fallbackManwon) {
  return { source: "local", open: false, vaDueDays: VA_DUE_DAYS, escrowId: null,
    bundles: splitIntoBundles(quoteLines(estimate, fallbackManwon)).map((b) => ({ ...b, parts: [] })) };
}

export default function BundlePayPanel({ requestId, estimate, fallbackTotalManwon, onBeforePay, onToast, onContractReady, previewPlan = null }) {
  const [plan, setPlan] = useState(() => previewPlan ?? fromQuote(estimate, fallbackTotalManwon));
  const [openSeq, setOpenSeq] = useState(null);
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState(BUNDLE_METHODS[0].id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (previewPlan || !requestId) return;
    let alive = true;
    getBundlePlan(requestId).then(({ data, error } = {}) => {
      if (!alive) return;
      if (!error && data && !data.error && Array.isArray(data.bundles)) setPlan(fromServer(data));
    }).catch(() => {});
    return () => { alive = false; };
  }, [requestId, previewPlan]);

  const summary = useMemo(() => planSummary(plan.bundles, {}), [plan]);
  const live = BUNDLE_PAY_LIVE && plan.source === "server" && plan.open;
  const preview = !live;
  useEffect(() => { if (summary.contractReady && plan.source === "server") onContractReady?.(plan.escrowId); }, [summary.contractReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summary.count) return null;

  const openRow = summary.rows.find((r) => r.seq === openSeq) ?? null;
  const amountWon = Math.round(Number(String(amountText).replace(/[^0-9]/g, "")) || 0);
  const amountErr = openRow ? checkPartAmount(openRow.progress, amountWon) : null;

  const toggle = (row) => {
    if (openSeq === row.seq) { setOpenSeq(null); return; }
    setOpenSeq(row.seq);
    setAmountText(row.progress.remainingWon ? row.progress.remainingWon.toLocaleString("ko-KR") : "");
  };

  const pay = async () => {
    if (!live) { onToast?.(PART_ERRORS.NOT_OPEN); return; }
    if (!openRow || amountErr || busy) { if (amountErr) onToast?.(PART_ERRORS[amountErr]); return; }
    setBusy(true);
    try {
      if (onBeforePay && !(await onBeforePay())) return;
      const { data, error } = await startBundlePart({ requestId, seq: openRow.seq, amountWon, method });
      if (error || !data || data.error) { onToast?.(PART_ERRORS[data?.error] ?? "결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요."); return; }
      const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
      if (!clientKey) { onToast?.("지금은 결제를 받을 수 없어요. 고객센터로 문의해 주세요."); return; }
      try { localStorage.setItem("pg_bundle_pending", JSON.stringify({ requestId, orderId: data.order_id, savedAt: Date.now() })); } catch { /* noop */ }
      const m = BUNDLE_METHODS.find((x) => x.id === method);
      await getProvider(ACTIVE_PROVIDER).requestPayment({
        clientKey, tossMethod: m.tossMethod, amount: data.amount_won, orderId: data.order_id, orderName: data.order_name,
        customerName: "고객", successUrl: window.location.origin + "/?pg_success=1", failUrl: window.location.origin + "/?pg_fail=1",
        extra: data.valid_hours ? { validHours: data.valid_hours } : {},
      });
    } catch (e) {
      onToast?.(e?.code === "PAYMENTS_PAUSED" ? e.message : "결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const pct = (n) => `${Math.max(0, Math.min(100, (n / (summary.totalWon || 1)) * 100))}%`;

  return (
    <section aria-label="공사비 나눠 내기" style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`, overflow: "hidden", marginBottom: S.lg }}>
      {/* 머리 — 결제 전엔 «열리면» 미리 보기 */}
      <div style={{ padding: `${S.lg}px ${S.lg}px ${S.md}px`, background: C.ivory, borderBottom: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, letterSpacing: "0.04em" }}>공정 묶음 결제</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginTop: 4, lineHeight: 1.4, wordBreak: "keep-all" }}>
          {preview ? "결제가 열리면 이렇게 나눠 낼 수 있어요" : headline(summary)}
        </div>
        <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.6, wordBreak: "keep-all" }}>
          {preview
            ? `최종 견적서 ${fmtWon(summary.totalWon)}을 공정별 ${summary.count}개 묶음으로 나눴어요. 묶음마다 1천만 원 미만이고, 한 묶음을 여러 번에 나눠 낼 수 있어요.`
            : "묶음을 모두 채우면 계약이 확정되고 착공 단계가 열려요."}
        </div>
        {/* 전체 진행 — 낸 금액(초록) · 입금 기다리는 금액(금색) */}
        {!preview && (
          <div style={{ marginTop: S.md }}>
            <div style={{ height: 10, borderRadius: R.full, background: C.bgWarm, overflow: "hidden", display: "flex" }}>
              <span style={{ width: pct(summary.paidWon), background: C.brand }} />
              <span style={{ width: pct(summary.rows.reduce((s, r) => s + r.progress.pendingWon, 0)), background: GOLD }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text3, marginTop: 6 }}>
              <span>낸 금액 <b style={{ color: C.text1 }}>{fmtWon(summary.paidWon)}</b></span>
              <span>전체 {fmtWon(summary.totalWon)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 묶음 목록 */}
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {summary.rows.map((row) => {
          const st = STATUS_CHIP[row.progress.status] ?? STATUS_CHIP.OPEN;
          const isOpen = openSeq === row.seq;
          const parts = Array.isArray(row.parts) ? row.parts : [];
          const canPay = row.progress.remainingWon > 0;
          return (
            <li key={row.seq} style={{ borderBottom: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", gap: S.md, alignItems: "flex-start", padding: `${S.md}px ${S.lg}px` }}>
                <span aria-hidden style={{ flex: "0 0 26px", height: 26, borderRadius: R.full, background: row.progress.status === "PAID" ? C.brand : C.brandL,
                  color: row.progress.status === "PAID" ? "#fff" : C.brand, fontSize: 12.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {row.progress.status === "PAID" ? "✓" : row.seq}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: S.sm, alignItems: "baseline" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: C.text1, wordBreak: "keep-all" }}>{row.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: C.text1, whiteSpace: "nowrap" }}>{fmtWon(row.progress.amountWon)}</span>
                  </div>
                  {row.lines?.length > 1 && (
                    <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2, lineHeight: 1.6 }}>
                      {row.lines.map((l) => `${l.name} ${fmtWon(l.won)}`).join(" · ")}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: R.full, background: st.bg, color: st.fg }}>{st.label}</span>
                    {row.progress.status !== "PAID" && row.progress.paidWon + row.progress.pendingWon > 0 && (
                      <span style={{ fontSize: 12, color: C.text2 }}>남은 금액 <b>{fmtWon(row.progress.remainingWon)}</b></span>
                    )}
                  </div>
                  {/* 이 묶음에 낸 결제들 — 결제 1회 = 주문번호 1개 · 가상계좌는 결제마다 새 계좌 */}
                  {parts.length > 0 && (
                    <ul style={{ listStyle: "none", margin: `${S.sm}px 0 0`, padding: 0, display: "grid", gap: 4 }}>
                      {parts.map((p, i) => (
                        <li key={i} style={{ fontSize: 12, color: C.text2, background: C.surface2, borderRadius: R.md, padding: "6px 10px", lineHeight: 1.6 }}>
                          <b>{p.method === "VIRTUAL_ACCOUNT" ? "가상계좌" : "카드"}</b> {fmtWon(p.amount_won)} · {PART_LABEL[p.status] ?? p.status}
                          {p.status === "WAITING_FOR_DEPOSIT" && p.virtual_account?.accountNumber && (
                            <span style={{ display: "block", color: C.text1 }}>
                              {bankName(p.virtual_account)} {p.virtual_account.accountNumber} · {dueText(p.due_at)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {canPay && (
                <div style={{ padding: `0 ${S.lg}px ${S.md}px 54px` }}>
                  <button type="button" onClick={() => toggle(row)} aria-expanded={isOpen}
                    style={{ border: `1px solid ${C.brandM}`, background: isOpen ? C.brandL : C.surface, color: C.brand, borderRadius: R.full,
                      padding: "6px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    {isOpen ? "닫기" : row.progress.paidWon + row.progress.pendingWon > 0 ? "남은 금액 내기" : "이 묶음 내기"}
                  </button>
                </div>
              )}
              {isOpen && (
                <div style={{ margin: `0 ${S.lg}px ${S.lg}px`, padding: S.md, borderRadius: R.lg, background: C.surface2, border: `1px solid ${C.bgWarm}` }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.text2 }} htmlFor={`bundle-amt-${row.seq}`}>이번에 낼 금액</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <input id={`bundle-amt-${row.seq}`} inputMode="numeric" value={amountText}
                      onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9]/g, "")); setAmountText(n ? n.toLocaleString("ko-KR") : ""); }}
                      style={{ flex: 1, minWidth: 0, height: 44, borderRadius: R.md, border: `1px solid ${amountText && amountErr ? C.red : C.bgWarm}`, padding: "0 12px",
                        fontSize: 16, fontWeight: 800, color: C.text1, background: C.surface, fontFamily: "inherit" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>원</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {[["남은 금액 전부", row.progress.remainingWon], ["절반", Math.floor(row.progress.remainingWon / 2 / 10_000) * 10_000]]
                      .filter(([, v]) => v > 0).map(([k, v]) => (
                        <button key={k} type="button" onClick={() => setAmountText(v.toLocaleString("ko-KR"))}
                          style={{ border: `1px solid ${C.bgWarm}`, background: C.surface, borderRadius: R.full, padding: "4px 10px", fontSize: 12, color: C.text2, cursor: "pointer", fontFamily: "inherit" }}>
                          {k} · {fmtWon(v)}
                        </button>
                      ))}
                  </div>
                  {amountText && amountErr && <div role="alert" style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{PART_ERRORS[amountErr]}</div>}

                  <div role="radiogroup" aria-label="결제 수단" style={{ display: "grid", gap: 6, marginTop: S.md }}>
                    {BUNDLE_METHODS.map((m) => {
                      const on = method === m.id;
                      return (
                        <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMethod(m.id)}
                          style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: "inherit",
                            border: `1.5px solid ${on ? C.brand : C.bgWarm}`, background: on ? C.brandL : C.surface }}>
                          <span aria-hidden style={{ width: 16, height: 16, borderRadius: R.full, border: `2px solid ${on ? C.brand : C.text4}`, background: on ? `radial-gradient(${C.brand} 45%, transparent 50%)` : "transparent", flex: "0 0 16px" }} />
                          <span style={{ flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: C.text1 }}>{m.label}</span>
                            <span style={{ display: "block", fontSize: 11.5, color: C.text3 }}>
                              {m.id === "VIRTUAL_ACCOUNT" ? `${m.desc} · 입금 기한 ${plan.vaDueDays}일` : m.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button type="button" onClick={pay} disabled={!live || !!amountErr || busy}
                    style={{ width: "100%", height: 50, marginTop: S.md, borderRadius: R.lg, border: "none", fontSize: 15, fontWeight: 800, fontFamily: "inherit",
                      background: live && !amountErr ? C.brand : C.bgWarm, color: live && !amountErr ? "#fff" : C.text3, cursor: live && !amountErr ? "pointer" : "not-allowed" }}>
                    {!live ? "결제 준비 중 · 열리면 여기서 내요"
                      : busy ? "결제창 여는 중…"
                      : `${fmtWon(amountWon)} ${method === "VIRTUAL_ACCOUNT" ? "가상계좌로" : "카드로"} 내기`}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* 가상계좌가 막히지 않게 — 기한·이체 한도·섞어 내기·계약 확정 · 업체 지급 기준 */}
      <div style={{ padding: `${S.md}px ${S.lg}px 0`, fontSize: 12, fontWeight: 800, color: C.text1 }}>{preview ? "결제가 열리면" : "알아 두세요"}</div>
      <ul style={{ margin: 0, padding: `${S.xs}px ${S.lg}px ${S.lg}px ${S.lg + 16}px`, fontSize: 12, color: C.text2, lineHeight: 1.8, background: C.surface }}>
        <li>가상계좌는 결제할 때마다 새 계좌번호가 나와요. 입금 기한은 {plan.vaDueDays}일이고, 하루 전에 알려 드려요.</li>
        <li>하루 이체 한도를 넘으면 며칠에 나눠 넣으셔도 됩니다.</li>
        <li>입금이 막히면 남은 금액만 카드로 내셔도 돼요. 카드 여러 장도 괜찮아요.</li>
        <li>입금이 확인되면 바로 고객님과 업체에 알려 드려요.</li>
        <li>업체에는 묶음과 상관없이 계약 전체 금액 기준으로, 단계를 확인할 때마다 나눠 지급돼요.</li>
      </ul>
    </section>
  );
}
