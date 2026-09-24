// 파트너 가입 — 「들어오는 건 쉽게, 안의 시스템은 단단하게」(대표 2026-09-24).
//
// 받는 것은 셋뿐이다: 업체명 · 영업 지역 · 공종. 끝나면 바로 기본 파트너로 활동한다(1건 300만원까지).
// 사업자등록증·시공보험·보증금은 가입에서 받지 않는다 — 안에서 원할 때 하나씩 내면 한도가 오른다
// (lib/partnerTier.js 의 계단). 그래서 가입 즉시 company_status=ACTIVE 로 둔다: 안전은 승인 대기가 아니라
// 수주 한도가 맡는다.
//
// 예전 가입(5단계 + 결제 화면)에서 걷어낸 것 — 거짓이거나 입구를 막던 것:
//   · 사업자번호 「✓ 인증」 버튼 — 숫자 10자리면 조회 없이 인증으로 바뀌었다
//   · 사업자등록증 필수 업로드, 서약 5개 + 에스크로 확인 4개 + 필수 동의 4개
//   · 결제 화면 — 돈을 받지 않고 보증금 등급(badge)과 예치금을 기록했다(= 수주 한도를 공짜로 가져감)
//   · 「신탁 계좌 보관」「정산 시 수수료 자동 차감」「에스크로 안전 정산 적용」「착공 즉시 선금 30%」
//     「상단 노출 우선순위」 — 아직 돌아가지 않는 약속
//   · 수수료 4.4% 배너 — 입구에서 수수료를 보여 주지 않는다(대표 2026-09-24)
//   · 업체 소개를 입력받고 저장하지 않던 것 → 이제 companies.desc 에 저장한다

import { useState } from "react";
import { C, R, S, SPECIALTIES } from "../constants";
import { upsertUserByPhone, upsertCompany } from "../lib/supabase";
import RegionSelectSheet from "../components/RegionSelectSheet";
import { getPrimaryRegion, regionKey } from "../constants/regions";
import PartnerLadder from "../components/partner/PartnerLadder";

const INK = "#1F2A24";
const MUTED = "#8C8577";
const GOLD = "#B08A3E";
const STEPS = ["업체", "지역", "공종"];

export default function CompanyOnboarding({ phone, onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ bizName: "", name: "", serviceRegions: [], specialties: [], desc: "", agree: false });
  const [regionSheetOpen, setRegionSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(null);   // 가입이 끝난 사용자 — 계단 화면을 보여 준 뒤 onDone
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (v) => setForm(f => ({ ...f, specialties: f.specialties.includes(v) ? f.specialties.filter(x => x !== v) : [...f.specialties, v] }));

  const iS = { width: "100%", padding: "14px 16px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 15,
    outline: "none", boxSizing: "border-box", marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface };
  const primary = (on) => ({ width: "100%", padding: S.xl, background: on ? C.brand : "#E8E4DC", color: "#fff", border: "none",
    borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: on ? "pointer" : "default" });
  const back = { background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 20, fontWeight: 600, padding: 0 };

  const ok1 = form.bizName.trim().length > 0;
  const ok2 = form.serviceRegions.length > 0;
  const ok3 = form.specialties.length > 0 && form.agree;

  const submit = async () => {
    if (!ok3 || saving) return;
    setSaving(true); setError(null);
    try {
      const primarySR = getPrimaryRegion(form.serviceRegions);
      const region = primarySR ? regionKey(primarySR.city, primarySR.district) : "";
      const profile = { name: form.name.trim() || form.bizName.trim(), role: "company", region, phone };
      const { data: userRow, error: uErr } = await upsertUserByPhone(profile);
      if (uErr || !userRow?.id) throw uErr || new Error("user");
      const joinedAt = new Date();
      const until = new Date(joinedAt); until.setFullYear(until.getFullYear() + 1);
      const { error: cErr } = await upsertCompany({
        owner_id: userRow.id,
        name: form.bizName.trim(),
        phone,
        region,
        service_regions: form.serviceRegions,
        default_service_region_id: primarySR ? (primarySR.id ?? regionKey(primarySR.city, primarySR.district)) : null,
        specialties: form.specialties,
        desc: form.desc.trim() || null,
        company_status: "ACTIVE",               // 가입 즉시 활동 — 안전은 수주 한도(가입만 300만원)가 맡는다
        is_early_partner: true,
        early_partner_joined_at: joinedAt.toISOString(),
        early_partner_benefit_until: until.toISOString(),
      });
      if (cErr) throw cErr;
      setJoined(userRow);
    } catch {
      setError("가입을 마치지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  // ── 가입 완료 — 지금 한도와 계단. 프리미엄이 «다음에 할 일»로 보이게 한다. ──
  if (joined) {
    return (
      <div style={{ width: "100%", maxWidth: 390 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.14em", marginBottom: 8 }}>PARTNER</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "-0.02em", lineHeight: 1.35 }}>
          기본 파트너로 시작했어요
        </div>
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.75, marginTop: 8, marginBottom: 22 }}>
          지금부터 견적 요청을 보고 입찰할 수 있어요.<br />
          증빙을 하나씩 낼 때마다 받을 수 있는 공사가 커집니다.
        </div>

        <PartnerLadder current="none" style={{ marginBottom: 22 }} />

        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>
          서류는 마이 → 서류함에서 언제든 낼 수 있어요. 금액은 공사 1건 기준입니다.
        </div>
        <button onClick={() => onDone(joined)} style={primary(true)}>공간마켓 시작하기</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 390 }}>
      {/* 진행 — 세 칸뿐이라는 걸 먼저 보여 준다 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: step >= i + 1 ? C.brand : C.bgWarm, transition: "background .2s" }} />
            <div style={{ fontSize: 11, marginTop: 6, color: step === i + 1 ? C.brand : C.text4, fontWeight: step === i + 1 ? 800 : 500 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 1 && <>
        <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.14em", marginBottom: 8 }}>PARTNER</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "-0.02em", marginBottom: 6 }}>어떤 업체인가요?</div>
        <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.7, marginBottom: 24 }}>
          1분이면 끝나요. 서류는 나중에, 원할 때 내면 됩니다.
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8 }}>업체명</div>
        <input value={form.bizName} onChange={e => set("bizName", e.target.value)} placeholder="예: 한결 인테리어" style={iS} autoFocus />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8 }}>
          대표자 이름 <span style={{ color: C.text4, fontWeight: 500 }}>(선택)</span>
        </div>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="홍길동" style={{ ...iS, marginBottom: 24 }} />
        <button onClick={() => ok1 && setStep(2)} style={primary(ok1)}>다음</button>
      </>}

      {step === 2 && <>
        <button onClick={() => setStep(1)} style={back}>← 뒤로</button>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "-0.02em", marginBottom: 6 }}>어디서 일하시나요?</div>
        <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 22 }}>이 지역의 견적 요청을 먼저 보여 드려요 (최대 2곳)</div>
        {form.serviceRegions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: S.lg }}>
            {form.serviceRegions.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: i === 0 ? C.brandL : C.surface,
                border: `1.5px solid ${i === 0 ? C.brand : C.bgWarm}`, borderRadius: R.full, padding: "8px 14px" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? C.brand : C.text1 }}>
                  {r.district || r.city}{i === 0 ? " · 기본" : ""}
                </span>
                <button onClick={() => set("serviceRegions", form.serviceRegions.filter((_, j) => j !== i))}
                  aria-label="지역 빼기"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.text3, padding: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setRegionSheetOpen(true)}
          style={{ width: "100%", padding: 16, marginBottom: S.xl, background: C.surface,
            border: `1.5px dashed ${form.serviceRegions.length < 2 ? C.brandM : C.bgWarm}`, borderRadius: R.lg,
            color: form.serviceRegions.length < 2 ? C.brand : C.text3, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {form.serviceRegions.length === 0 ? "+ 영업 지역 고르기" : form.serviceRegions.length === 1 ? "+ 한 곳 더 (1/2)" : "영업 지역 바꾸기"}
        </button>
        <RegionSelectSheet
          open={regionSheetOpen}
          onClose={() => setRegionSheetOpen(false)}
          selectedRegions={form.serviceRegions}
          maxCount={2}
          title="영업 지역"
          subtitle="영업하실 지역을 최대 2곳까지 고를 수 있어요"
          onSave={(entries) => { set("serviceRegions", entries); setRegionSheetOpen(false); }}
        />
        <button onClick={() => ok2 && setStep(3)} style={primary(ok2)}>다음</button>
      </>}

      {step === 3 && <>
        <button onClick={() => setStep(2)} style={back}>← 뒤로</button>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "-0.02em", marginBottom: 6 }}>어떤 공사를 하시나요?</div>
        <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 20 }}>여러 개 골라도 돼요</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {SPECIALTIES.map(s => {
            const on = form.specialties.includes(s);
            return (
              <button key={s} onClick={() => toggle(s)}
                style={{ padding: "10px 16px", borderRadius: R.full, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${on ? C.brand : C.bgWarm}`, background: on ? C.brandL : C.surface, color: on ? C.brand : C.text2 }}>
                {s}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8 }}>
          한 줄 소개 <span style={{ color: C.text4, fontWeight: 500 }}>(선택)</span>
        </div>
        <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={3}
          placeholder="예: 12년 경력, 아파트 욕실·주방 전문입니다."
          style={{ ...iS, resize: "none", lineHeight: 1.7, marginBottom: 18 }} />

        <button onClick={() => set("agree", !form.agree)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
            padding: "4px 0 18px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: form.agree ? C.brand : C.surface, border: `2px solid ${form.agree ? C.brand : C.bgWarm}`, color: "#fff", fontSize: 13, fontWeight: 900 }}>
            {form.agree ? "✓" : ""}
          </span>
          <span style={{ fontSize: 13.5, color: C.text1 }}>
            파트너 이용약관·개인정보 처리에 동의합니다 <span style={{ color: C.text4 }}>(필수)</span>
          </span>
        </button>

        {error && <div role="alert" style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}
        <button onClick={submit} disabled={!ok3 || saving} style={primary(ok3 && !saving)}>
          {saving ? "가입하는 중…" : "가입 마치기"}
        </button>
      </>}
    </div>
  );
}
