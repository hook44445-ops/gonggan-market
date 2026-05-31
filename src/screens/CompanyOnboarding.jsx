import { useState, useRef } from "react";
import { C, R, S, CITY_DISTRICTS, SPECIALTIES } from "../constants";
import { BADGES } from "../constants/badges";
import { Divider } from "../components/common";
import { upsertUserByPhone, upsertCompany, uploadFile, upsertCompanyDocument } from "../lib/supabase";
import RegionSelectSheet from "../components/RegionSelectSheet";
import { getPrimaryRegion, regionKey } from "../constants/regions";

export default function CompanyOnboarding({ phone, onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:"", bizName:"", bizNumber:"", bizVerified:false,
    mainRegion:"", subRegions:[],     // legacy fields — kept for fallback compat
    serviceRegions:[],                // 신규: RegionEntry[] 최대 2곳
    specialties:[], portfolioDesc:"",
    hasBizDoc:false, hasInsurance:false,
    bizDocFile:null, insuranceFile:null,
    bizDocUrl: null, insuranceUrl: null,
    badge:"standard",
    pledgeChecklist:{}, escrowChecklist:{},
    agreeTerms:false, agreeEscrow:false, agreeAs:false, agreeDeposit:false,
  });
  const [submitted, setSubmitted] = useState(null);
  const [uploadingBiz, setUploadingBiz] = useState(false);
  const [uploadingIns, setUploadingIns] = useState(false);
  const [mainCity, setMainCity] = useState("");    // 레거시 — step 2 UI 잔류
  const [subCity, setSubCity] = useState("서울");  // 레거시 — step 2 UI 잔류
  const [regionSheetOpen, setRegionSheetOpen] = useState(false);
  const bizDocRef = useRef(null);
  const insDocRef = useRef(null);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleArr = (k,v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x=>x!==v) : [...f[k],v]
  }));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  const STEPS = ["기본정보","활동지역","전문분야","서류제출","계약동의"];

  const PLEDGE_ITEMS = [
    { key:"no_fraud", label:"부정 경쟁 및 뒷거래 금지 서약" },
    { key:"privacy",  label:"고객 개인정보 보호 서약" },
    { key:"as_duty",  label:"하자보수 AS 의무 이행 동의" },
    { key:"quality",  label:"품질 관리 및 안전 수칙 준수 동의" },
    { key:"policy",   label:"공간마켓 운영 정책 준수 동의" },
  ];
  const ESCROW_ITEMS = [
    { key:"phase_structure", label:"에스크로 단계별 정산 구조 이해 (계약 10% → 착공 20% → 중간점검 40% → 완료 30%)" },
    { key:"phase_delay",     label:"단계 미완료 시 정산 지연 동의" },
    { key:"dispute",         label:"분쟁 발생 시 공간마켓 중재 동의" },
    { key:"final_approval",  label:"고객 최종 승인 후 정산 동의" },
  ];
  const pledgeAllChecked = PLEDGE_ITEMS.every(i => form.pledgeChecklist[i.key]);
  const escrowAllChecked = ESCROW_ITEMS.every(i => form.escrowChecklist[i.key]);
  const BADGE_INFO = {
    basic:      { ...BADGES.basic,      range:"~500만원",   dep20:100,  dep30:150 },
    standard:   { ...BADGES.standard,   range:"~1,000만원", dep20:200,  dep30:300 },
    premium:    { ...BADGES.premium,    range:"~2,000만원", dep20:400,  dep30:600 },
    enterprise: { ...BADGES.enterprise, range:"~5,000만원", dep20:1000, dep30:1500 },
    signature:  { ...BADGES.signature,  range:"~1억원",     dep20:2000, dep30:3000 },
  };
  const badge = BADGE_INFO[form.badge] || BADGE_INFO.standard;
  const depositAmt = form.hasInsurance ? badge.dep20 : badge.dep30;

  if(submitted === "payment") return (
    <div style={{ width:"100%", maxWidth:390 }}>
      <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>보증금 결제</div>
      <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
        공간보증 배지 활성화를 위한 보증금을 납부해주세요
      </div>
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
        <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.lg }}>
          <div style={{ width:52, height:52, borderRadius:R.lg, background:badge.bg,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
            {badge.icon}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:badge.color }}>{badge.label} 배지</div>
            <div style={{ fontSize:12, color:C.text3 }}>공사 규모 {badge.range}</div>
          </div>
        </div>
        <Divider />
        <div style={{ marginTop:S.md }}>
          {[
            ["보증금 비율", form.hasInsurance?"20% (보험 할인)":"30%"],
            ["납부 금액", `${depositAmt.toLocaleString()}만원`],
            ["환급 조건", "탈퇴 시 30일 내 전액 환급"],
            ["먹튀 발생 시", "고객 즉시 배상 후 법적 대응"],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between",
              padding:`${S.sm}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>결제 수단</div>
        {[["💳","신용/체크카드"],["📱","카카오페이"],["🏦","계좌이체"]].map(([icon,label]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:S.md,
            padding:`${S.md}px 0`, borderBottom:`1px solid ${C.bgWarm}`, cursor:"pointer" }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:14, fontWeight:600, color:C.text1 }}>{label}</span>
            <span style={{ marginLeft:"auto", color:C.text4 }}>›</span>
          </div>
        ))}
      </div>
      <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.md,
        marginBottom:S.xl, fontSize:12, color:C.navy, lineHeight:1.7,
        display:"flex", gap:S.sm }}>
        <span>🛡</span>
        <span>보증금은 공간마켓 신탁 계좌에 안전하게 보관되며 업무에 사용되지 않습니다</span>
      </div>
      <button onClick={() => setSubmitted("done")}
        style={{ width:"100%", padding:S.xxl, background:C.brand, color:"#fff",
          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
          boxShadow:`0 6px 20px ${C.brand}44` }}>
        💳 {depositAmt.toLocaleString()}만원 보증금 납부하기
      </button>
    </div>
  );

  if(submitted === "done") return (
    <div style={{ width:"100%", maxWidth:390, textAlign:"center", padding:"40px 0" }}>
      <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:900, color:C.text1, marginBottom:8 }}>신청 완료!</div>
      <div style={{ fontSize:14, color:C.text3, lineHeight:1.8, marginBottom:S.xxl }}>
        보증금 납부 완료.<br/>서류 검토 후 1~2일 내<br/>🛡 공간마켓 인증 배지가 부여됩니다
      </div>
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}`, textAlign:"left" }}>
        {[["배지 등급", `${badge.icon} ${badge.label}`],
          ["공사 규모", badge.range],
          ["보증금 납부", `${depositAmt.toLocaleString()}만원 ✅`],
          ["보험 가입", form.hasInsurance?"✅ 가입":"미가입"],
          ["심사 기간","1~2일"]].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between",
            padding:`${S.sm}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
            <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl,
        marginBottom:S.xxl, border:`1px solid ${C.trustM}` }}>
        <div style={{ fontSize:13, color:C.navy, fontWeight:700, lineHeight:1.8 }}>
          승인 후 받는 혜택<br/>
          ✅ {badge.icon} {badge.label} 배지 부여<br/>
          ✅ 에스크로 안전 정산 적용<br/>
          ✅ 상단 노출 우선순위<br/>
          ✅ 착공 확인 즉시 선금 30% 지급
        </div>
      </div>
      <button onClick={async () => {
          // 신규 serviceRegions → primary 를 region text 로 미러링, 없으면 legacy mainRegion 유지
          const primarySR = getPrimaryRegion(form.serviceRegions);
          const mainRegionText = primarySR
            ? regionKey(primarySR.city, primarySR.district)
            : (form.mainRegion || "서울 마포구");
          const profile = { name: form.name, role: "company", region: mainRegionText, phone };
          const { data: userRow } = await upsertUserByPhone(profile);
          const { data: companyRow } = await upsertCompany({
            owner_id: userRow?.id ?? null,
            name: form.bizName,
            phone,
            region: mainRegionText,
            service_regions: form.serviceRegions.length ? form.serviceRegions : [],
            default_service_region_id: primarySR ? (primarySR.id ?? regionKey(primarySR.city, primarySR.district)) : null,
            specialties: form.specialties,
            badge: form.badge,
            has_insurance: form.hasInsurance,
            deposit_amount: depositAmt,
            biz_cert_url: form.bizDocUrl,
            insurance_url: form.insuranceUrl,
            is_early_partner: true,
            early_partner_joined_at: new Date().toISOString(),
            early_partner_benefit_until: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString(); })(),
            fee_rate: 0.04,
            doc_status: "pending",
          });
          if (companyRow?.id && userRow?.id) {
            const uid = userRow.id;
            const cid = companyRow.id;
            await Promise.all([
              upsertCompanyDocument({ company_id:cid, user_id:uid, document_type:"business_license", file_url:form.bizDocUrl||null, file_name:form.bizDocFile||null, review_status:form.bizDocUrl?"submitted":"draft" }),
              upsertCompanyDocument({ company_id:cid, user_id:uid, document_type:"insurance_certificate", file_url:form.insuranceUrl||null, file_name:form.insuranceFile||null, review_status:form.insuranceUrl?"submitted":"draft" }),
              upsertCompanyDocument({ company_id:cid, user_id:uid, document_type:"operation_pledge", checklist:form.pledgeChecklist, review_status:PLEDGE_ITEMS.every(i=>form.pledgeChecklist[i.key])?"submitted":"draft" }),
              upsertCompanyDocument({ company_id:cid, user_id:uid, document_type:"escrow_agreement", checklist:form.escrowChecklist, review_status:ESCROW_ITEMS.every(i=>form.escrowChecklist[i.key])?"submitted":"draft" }),
            ]).catch(() => {});
          }
          onDone({ ...(userRow || profile), badge: form.badge, has_insurance: form.hasInsurance });
        }}
        style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
          boxShadow:`0 6px 20px ${C.brand}44` }}>
        공간마켓 시작하기 🚀
      </button>
    </div>
  );

  return (
    <div style={{ width:"100%", maxWidth:390 }}>
      <div style={{ display:"flex", gap:4, marginBottom:S.xxl }}>
        {STEPS.map((s,i) => (
          <div key={s} style={{ flex:1 }}>
            <div style={{ height:4, borderRadius:R.full,
              background: step>i+1?C.green : step===i+1?C.brand : C.bgWarm,
              transition:"background 0.3s" }} />
            <div style={{ fontSize:9, color:step===i+1?C.brand:C.text4,
              fontWeight:step===i+1?800:500, marginTop:3, textAlign:"center" }}>{s}</div>
          </div>
        ))}
      </div>

      {step===1 && <>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>업체 기본 정보</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>대표자 정보를 입력해주세요</div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>대표자명</div>
        <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="홍길동" style={iS} />
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>업체명</div>
        <input value={form.bizName} onChange={e=>set("bizName",e.target.value)} placeholder="예: 홍익시공" style={iS} />
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>사업자등록번호</div>
        <div style={{ display:"flex", gap:8, marginBottom:S.xl }}>
          <input value={form.bizNumber}
            onChange={e => { const n=e.target.value.replace(/\D/g,""); const f=n.length<=3?n:n.length<=5?`${n.slice(0,3)}-${n.slice(3)}`:`${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5,10)}`; set("bizNumber",f); set("bizVerified",false); }}
            placeholder="000-00-00000" maxLength={12} style={{ ...iS, flex:1, marginBottom:0 }} />
          <button onClick={() => { if(form.bizNumber.replace(/-/g,"").length===10) set("bizVerified",true); }}
            style={{ padding:"14px", borderRadius:R.md, border:"none",
              background:form.bizVerified?C.greenL:C.brand,
              color:form.bizVerified?C.green:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            {form.bizVerified?"✓ 인증":"사업자 확인"}
          </button>
        </div>
        <button onClick={() => form.name&&form.bizName&&form.bizVerified&&setStep(2)}
          style={{ width:"100%", padding:S.xl,
            background:form.name&&form.bizName&&form.bizVerified?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {step===2 && <>
        <button onClick={() => { setStep(1); set("serviceRegions",[]); setRegionSheetOpen(false); }}
          style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>영업 지역 설정</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>서비스 가능한 지역을 선택해주세요 (최대 2곳)</div>

        {/* 선택된 영업지역 칩 */}
        {form.serviceRegions.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.lg }}>
            {form.serviceRegions.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6,
                background:i===0?C.brandL:C.surface,
                border:`1.5px solid ${i===0?C.brand:C.bgWarm}`, borderRadius:R.full, padding:"8px 14px" }}>
                <span style={{ fontSize:14, fontWeight:700, color:i===0?C.brand:C.text1 }}>
                  {i===0?"📍 ":""}
                  {r.district || r.city}
                  {i===0?" (기본)":""}
                </span>
                <button onClick={() => set("serviceRegions", form.serviceRegions.filter((_,j)=>j!==i))}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.text3, padding:0, lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* 지역 추가 / 수정 버튼 */}
        <button onClick={() => setRegionSheetOpen(true)}
          style={{ width:"100%", padding:"16px", marginBottom:S.xl,
            background:C.surface,
            border:`1.5px dashed ${form.serviceRegions.length < 2 ? C.brandM : C.bgWarm}`,
            borderRadius:R.lg, color:form.serviceRegions.length < 2 ? C.brand : C.text3,
            fontSize:14, fontWeight:700, cursor:"pointer" }}>
          {form.serviceRegions.length === 0 && "+ 영업지역 선택"}
          {form.serviceRegions.length === 1 && "+ 영업지역 추가 (1/2)"}
          {form.serviceRegions.length >= 2 && "✏️ 영업지역 수정"}
        </button>

        {/* 지역 선택 바텀시트 */}
        <RegionSelectSheet
          open={regionSheetOpen}
          onClose={() => setRegionSheetOpen(false)}
          selectedRegions={form.serviceRegions}
          maxCount={2}
          title="영업지역 설정"
          subtitle="영업하실 지역을 최대 2곳까지 설정할 수 있어요"
          onSave={(entries) => { set("serviceRegions", entries); setRegionSheetOpen(false); }}
        />

        <button onClick={() => form.serviceRegions.length > 0 && setStep(3)}
          style={{ width:"100%", padding:S.xl,
            background:form.serviceRegions.length > 0 ? C.brand : "#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {step===3 && <>
        <button onClick={() => setStep(2)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>전문 분야</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>주력 시공 분야를 선택해주세요 (복수 선택)</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => toggleArr("specialties",s)}
              style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                border:`1.5px solid ${form.specialties.includes(s)?C.brand:C.bgWarm}`,
                background:form.specialties.includes(s)?C.brandL:C.surface,
                color:form.specialties.includes(s)?C.brand:C.text2, cursor:"pointer" }}>{s}</button>
          ))}
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>업체 소개 (선택)</div>
        <textarea value={form.portfolioDesc} onChange={e=>set("portfolioDesc",e.target.value)}
          placeholder="예: 12년 경력, 아파트 전체 리모델링 전문. 에스크로 정산 156건 완료."
          rows={4} style={{ ...iS, resize:"none", lineHeight:1.7, marginBottom:S.xl }} />
        <button onClick={() => form.specialties.length>0&&setStep(4)}
          style={{ width:"100%", padding:S.xl, background:form.specialties.length>0?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {step===4 && <>
        <button onClick={() => setStep(3)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>서류 제출</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>인증 심사에 필요한 서류를 업로드해주세요</div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.md, border:`1.5px solid ${form.hasBizDoc?C.green:C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom: form.hasBizDoc?0:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg,
              background:form.hasBizDoc?C.greenL:C.surface2,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📋</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>사업자등록증</div>
              <div style={{ fontSize:12, color:form.hasBizDoc?C.green:C.text3 }}>
                {uploadingBiz ? "업로드 중..." : form.bizDocFile ? `✅ ${form.bizDocFile}` : "필수 · PDF 또는 이미지"}
              </div>
            </div>
            {form.hasBizDoc && <span style={{ fontSize:18, color:C.green }}>✓</span>}
          </div>
          {!form.hasBizDoc && (
            <button onClick={() => bizDocRef.current?.click()} disabled={uploadingBiz}
              style={{ width:"100%", padding:"12px", background:uploadingBiz?C.surface2:C.brandL,
                color:uploadingBiz?C.text4:C.brand, border:`1.5px dashed ${C.brandM}`,
                borderRadius:R.md, fontWeight:700, fontSize:13, cursor:uploadingBiz?"not-allowed":"pointer" }}>
              {uploadingBiz ? "⏳ 업로드 중..." : "📂 파일 선택하기"}
            </button>
          )}
          <input ref={bizDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploadingBiz(true);
              try {
                const path = `biz-doc/${Date.now()}_${file.name.replace(/\s/g,"_")}`;
                const url = await uploadFile("documents", path, file).catch(() => URL.createObjectURL(file));
                set("bizDocFile", file.name);
                set("bizDocUrl", url);
                set("hasBizDoc", true);
              } catch {
                set("bizDocFile", file.name);
                set("hasBizDoc", true);
              } finally {
                setUploadingBiz(false);
                e.target.value = "";
              }
            }} />
        </div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.md, border:`1.5px solid ${form.hasInsurance?C.green:C.bgWarm}` }}>
          <div style={{ display:"flex", gap:S.md, alignItems:"center", marginBottom:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg,
              background:form.hasInsurance?C.greenL:C.surface2,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔒</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>시공보험 증서</div>
              <div style={{ fontSize:12, color:form.hasInsurance?C.green:C.text3 }}>
                {uploadingIns ? "업로드 중..." : form.insuranceFile ? `✅ ${form.insuranceFile}` : "선택 · 보증금 할인 혜택"}
              </div>
            </div>
            {form.hasInsurance && <span style={{ fontSize:18, color:C.green }}>✓</span>}
          </div>
          {!form.hasInsurance && (
            <div style={{ marginBottom:S.md }}>
              <button onClick={() => insDocRef.current?.click()} disabled={uploadingIns}
                style={{ width:"100%", padding:"12px", background:uploadingIns?C.surface2:C.brandL,
                  color:uploadingIns?C.text4:C.brand, border:`1.5px dashed ${C.brandM}`,
                  borderRadius:R.md, fontWeight:700, fontSize:13, cursor:uploadingIns?"not-allowed":"pointer" }}>
                {uploadingIns ? "⏳ 업로드 중..." : "📂 파일 선택하기"}
              </button>
              <input ref={insDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingIns(true);
                  try {
                    const path = `insurance/${Date.now()}_${file.name.replace(/\s/g,"_")}`;
                    const url = await uploadFile("documents", path, file).catch(() => URL.createObjectURL(file));
                    set("insuranceFile", file.name);
                    set("insuranceUrl", url);
                    set("hasInsurance", true);
                  } catch {
                    set("insuranceFile", file.name);
                    set("hasInsurance", true);
                  } finally {
                    setUploadingIns(false);
                    e.target.value = "";
                  }
                }} />
            </div>
          )}
          <div style={{ background:form.hasInsurance?C.greenL:C.brandL, borderRadius:R.lg,
            padding:S.md, border:`1px solid ${form.hasInsurance?C.green+"44":C.brandM}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:C.text3 }}>보험 미가입 시 보증금</span>
              <span style={{ fontSize:12, fontWeight:700,
                color:form.hasInsurance?C.text4:C.red,
                textDecoration:form.hasInsurance?"line-through":"none" }}>공사금액의 30%</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.text3 }}>보험 가입 시 보증금</span>
              <span style={{ fontSize:12, fontWeight:800,
                color:form.hasInsurance?C.green:C.text3 }}>공사금액의 20% ✓</span>
            </div>
          </div>
        </div>

        <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.lg,
          border:`1px solid ${C.trustM}`, marginBottom:S.xl, fontSize:13, color:C.navy, lineHeight:1.7 }}>
          🛡 제출 서류는 인증 목적으로만 사용되며<br/>공간마켓 보안 서버에 안전하게 보관됩니다
        </div>

        <button onClick={() => form.hasBizDoc&&setStep(5)}
          style={{ width:"100%", padding:S.xl, background:form.hasBizDoc?C.brand:"#E8E4DC",
            color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>
          다음 →
        </button>
      </>}

      {step===5 && <>
        <button onClick={() => setStep(4)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:20, fontWeight:600 }}>← 뒤로</button>
        <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>공간보증 배지 선택</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
          수주할 공사 규모에 맞게 선택해주세요
        </div>

        {Object.entries(BADGE_INFO).map(([key, b]) => {
          const dep = form.hasInsurance ? b.dep20 : b.dep30;
          const selected = form.badge === key;
          return (
            <div key={key} onClick={() => set("badge", key)}
              style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm,
                border:`1.5px solid ${selected?b.color:C.bgWarm}`, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:S.md, alignItems:"center" }}>
                  <div style={{ width:40, height:40, borderRadius:R.lg,
                    background:selected?b.bg:C.surface2,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{b.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:selected?b.color:C.text1 }}>{b.label}</div>
                    <div style={{ fontSize:12, color:C.text3 }}>공사 규모 {b.range}</div>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:15, fontWeight:900, color:selected?b.color:C.text1 }}>
                    {dep.toLocaleString()}만원
                  </div>
                  <div style={{ fontSize:10, color:C.text3 }}>
                    보증금 {form.hasInsurance?"20%":"30%"}
                  </div>
                </div>
              </div>
              {selected && form.hasInsurance && (
                <div style={{ marginTop:S.sm, background:C.greenL, borderRadius:R.sm,
                  padding:"4px 10px", fontSize:11, color:C.green, fontWeight:700 }}>
                  🔒 보험 가입 할인 적용 · {(b.dep30-b.dep20).toLocaleString()}만원 절감
                </div>
              )}
            </div>
          );
        })}

        <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
          marginBottom:S.xl, marginTop:S.md }}>
          <div style={{ fontSize:12, color:C.text3, lineHeight:1.8 }}>
            • 배지 없이도 2,000만원 이하 직거래 가능<br/>
            • 보증금은 탈퇴 시 30일 내 환급<br/>
            • 먹튀 발생 시 보증금으로 고객 즉시 배상
          </div>
        </div>

        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.sm }}>📝 운영 서약서</div>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.md, border:`1.5px solid ${pledgeAllChecked?C.brand:C.bgWarm}` }}>
          {PLEDGE_ITEMS.map((item,i) => (
            <div key={item.key} onClick={() => set("pledgeChecklist",{...form.pledgeChecklist,[item.key]:!form.pledgeChecklist[item.key]})}
              style={{ display:"flex", gap:S.md, alignItems:"flex-start", padding:`${S.sm}px 0`,
                borderBottom:i<PLEDGE_ITEMS.length-1?`1px solid ${C.bg}`:"none", cursor:"pointer" }}>
              <div style={{ width:20,height:20,borderRadius:4,flexShrink:0,marginTop:1,
                background:form.pledgeChecklist[item.key]?C.brand:C.surface,
                border:`2px solid ${form.pledgeChecklist[item.key]?C.brand:C.bgWarm}`,
                display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:900 }}>
                {form.pledgeChecklist[item.key]?"✓":""}
              </div>
              <span style={{ fontSize:12,color:C.text1,lineHeight:1.7 }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.sm }}>🛡 에스크로 동의서</div>
        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.xl, border:`1.5px solid ${escrowAllChecked?C.brand:C.bgWarm}` }}>
          {ESCROW_ITEMS.map((item,i) => (
            <div key={item.key} onClick={() => set("escrowChecklist",{...form.escrowChecklist,[item.key]:!form.escrowChecklist[item.key]})}
              style={{ display:"flex", gap:S.md, alignItems:"flex-start", padding:`${S.sm}px 0`,
                borderBottom:i<ESCROW_ITEMS.length-1?`1px solid ${C.bg}`:"none", cursor:"pointer" }}>
              <div style={{ width:20,height:20,borderRadius:4,flexShrink:0,marginTop:1,
                background:form.escrowChecklist[item.key]?C.brand:C.surface,
                border:`2px solid ${form.escrowChecklist[item.key]?C.brand:C.bgWarm}`,
                display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:900 }}>
                {form.escrowChecklist[item.key]?"✓":""}
              </div>
              <span style={{ fontSize:12,color:C.text1,lineHeight:1.7 }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>계약 동의</div>
        {[
          { key:"agreeTerms",  title:"이용약관 동의", sub:"업체 파트너 이용약관 (필수)" },
          { key:"agreeEscrow", title:"에스크로 정산 동의", sub:"단계별 안전 정산 방식 동의 (필수)" },
          { key:"agreeAs",     title:"하자보수 AS 의무 동의", sub:"완료 후 1년간 무상 AS 제공 (필수)" },
          { key:"agreeDeposit",title:"보증금 납부 동의", sub:"선택 배지 보증금 납부 및 환급 조건 동의 (필수)" },
        ].map(item => (
          <div key={item.key} onClick={() => set(item.key, !form[item.key])}
            style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm,
              border:`1.5px solid ${form[item.key]?C.brand:C.bgWarm}`, cursor:"pointer",
              display:"flex", gap:S.md, alignItems:"flex-start" }}>
            <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, marginTop:1,
              background:form[item.key]?C.brand:C.surface,
              border:`2px solid ${form[item.key]?C.brand:C.bgWarm}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontSize:14, fontWeight:900 }}>
              {form[item.key]?"✓":""}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{item.title}</div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{item.sub}</div>
            </div>
          </div>
        ))}

        {(() => {
          const canSubmit = form.agreeTerms&&form.agreeEscrow&&form.agreeAs&&form.agreeDeposit&&pledgeAllChecked&&escrowAllChecked;
          return (
            <button
              onClick={() => { if(canSubmit) setSubmitted("payment"); }}
              style={{ width:"100%", padding:S.xl, marginTop:S.md,
                background:canSubmit?C.brand:"#E8E4DC",
                color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer",
                boxShadow:canSubmit?`0 6px 20px ${C.brand}44`:"none" }}>
              🚀 업체 파트너 신청 완료
            </button>
          );
        })()}
      </>}
    </div>
  );
}
