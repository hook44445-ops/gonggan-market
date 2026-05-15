import { useState } from "react";
import { C, R, S } from "../constants";
import { BADGES } from "../constants/badges";

const MOCK_COMPANIES = [
  {
    id:1, name:"홍익시공", badge:"premium", temp:97, phone:"010-1234-5678",
    submittedAt:"2026.05.12", status:"pending",
    docs:[
      { label:"사업자등록증",    submitted:true  },
      { label:"시공보험 가입증", submitted:true  },
      { label:"통장 사본",       submitted:true  },
      { label:"대표자 신분증",   submitted:true  },
    ],
    deposit:1000, rejectNote:"",
  },
  {
    id:4, name:"서울리모델링", badge:"standard", temp:88, phone:"010-9876-5432",
    submittedAt:"2026.05.11", status:"pending",
    docs:[
      { label:"사업자등록증",    submitted:true  },
      { label:"시공보험 가입증", submitted:false },
      { label:"통장 사본",       submitted:true  },
      { label:"대표자 신분증",   submitted:true  },
    ],
    deposit:600, rejectNote:"",
  },
  {
    id:5, name:"강남인테리어", badge:"basic", temp:72, phone:"010-5555-7777",
    submittedAt:"2026.05.10", status:"approved",
    docs:[
      { label:"사업자등록증",    submitted:true },
      { label:"시공보험 가입증", submitted:true },
      { label:"통장 사본",       submitted:true },
      { label:"대표자 신분증",   submitted:true },
    ],
    deposit:300, rejectNote:"",
  },
  {
    id:6, name:"마포인테리어", badge:"standard", temp:81, phone:"010-3333-2222",
    submittedAt:"2026.05.09", status:"rejected",
    docs:[
      { label:"사업자등록증",    submitted:true  },
      { label:"시공보험 가입증", submitted:true  },
      { label:"통장 사본",       submitted:false },
      { label:"대표자 신분증",   submitted:false },
    ],
    deposit:600, rejectNote:"통장 사본, 신분증 누락으로 반려 처리되었습니다. 서류 보완 후 재신청해주세요.",
  },
];

const STATUS = {
  pending:  { label:"대기중", color:C.gold,  bg:"#FBF5E8" },
  approved: { label:"승인",   color:C.green, bg:C.greenL  },
  rejected: { label:"반려",   color:C.red,   bg:"#FFF0F0" },
};

export default function AdminScreen({ onBack }) {
  const [companies, setCompanies] = useState(MOCK_COMPANIES);
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [confirm, setConfirm] = useState(null);

  const stats = {
    pending:  companies.filter(c => c.status === "pending").length,
    approved: companies.filter(c => c.status === "approved").length,
    rejected: companies.filter(c => c.status === "rejected").length,
  };

  const filtered = tab === "all" ? companies : companies.filter(c => c.status === tab);

  const handleApprove = (company) => {
    setCompanies(prev => prev.map(c =>
      c.id === company.id ? { ...c, status:"approved", rejectNote:"" } : c
    ));
    setSelected(null);
    setConfirm(null);
  };

  const handleReject = (company, note) => {
    setCompanies(prev => prev.map(c =>
      c.id === company.id ? { ...c, status:"rejected", rejectNote:note } : c
    ));
    setSelected(null);
    setRejectMode(false);
    setRejectNote("");
    setConfirm(null);
  };

  const openDetail = (company) => {
    setSelected(company);
    setRejectMode(false);
    setRejectNote("");
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* Header */}
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack}
          style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>관리자 · 업체 심사</div>
          <div style={{ fontSize:11, color:C.text4 }}>서류 검토 및 승인/반려 처리</div>
        </div>
        {stats.pending > 0 && (
          <div style={{ marginLeft:"auto", background:C.red, color:"#fff",
            borderRadius:R.full, padding:"3px 10px", fontSize:12, fontWeight:700 }}>
            대기 {stats.pending}건
          </div>
        )}
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 90px` }}>

        {/* Stats row */}
        <div style={{ display:"flex", gap:S.sm, marginBottom:S.xl }}>
          {[
            ["대기중", stats.pending,  C.gold ],
            ["승인",   stats.approved, C.green],
            ["반려",   stats.rejected, C.red  ],
          ].map(([label, count, color]) => (
            <div key={label} style={{ flex:1, background:C.surface, borderRadius:R.lg,
              padding:`${S.lg}px ${S.sm}px`, textAlign:"center", border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:24, fontWeight:900, color }}>{count}</div>
              <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:C.bg, borderRadius:R.lg, padding:3, marginBottom:S.xl }}>
          {[["pending","대기중"],["approved","승인"],["rejected","반려"],["all","전체"]].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex:1, padding:"8px 4px", border:"none", borderRadius:R.md, cursor:"pointer",
                background:tab===v ? C.surface : "transparent",
                color:tab===v ? C.text1 : C.text3,
                fontWeight:tab===v ? 800 : 500, fontSize:12,
                boxShadow:tab===v ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Company list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:14, color:C.text3 }}>해당 항목이 없습니다</div>
          </div>
        ) : filtered.map(company => {
          const bm = BADGES[company.badge] || BADGES.basic;
          const sm = STATUS[company.status];
          const allOk = company.docs.every(d => d.submitted);
          return (
            <div key={company.id} onClick={() => openDetail(company)}
              style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, marginBottom:S.sm,
                border:`1.5px solid ${company.status === "pending" ? C.bgWarm : sm.color + "44"}`,
                cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:5 }}>{company.name}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <span style={{ background:bm.bg, color:bm.color, borderRadius:R.full,
                      padding:"2px 8px", fontSize:11, fontWeight:700 }}>{bm.icon} {bm.label}</span>
                    <span style={{ background:C.surface2, color:C.text3, borderRadius:R.full,
                      padding:"2px 8px", fontSize:11 }}>보증금 {company.deposit}만원</span>
                  </div>
                </div>
                <span style={{ background:sm.bg, color:sm.color, borderRadius:R.full,
                  padding:"3px 10px", fontSize:12, fontWeight:700, flexShrink:0 }}>{sm.label}</span>
              </div>
              <div style={{ display:"flex", gap:S.sm, alignItems:"center" }}>
                {!allOk && (
                  <span style={{ fontSize:11, color:C.red, background:"#FFF0F0",
                    borderRadius:R.sm, padding:"2px 6px", fontWeight:700 }}>⚠ 서류 미완</span>
                )}
                <span style={{ fontSize:11, color:C.text4 }}>제출 {company.submittedAt}</span>
                <span style={{ marginLeft:"auto", fontSize:11, color:C.brand, fontWeight:700 }}>상세 보기 →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail bottom sheet */}
      {selected && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
            display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setRejectMode(false); } }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%",
            maxWidth:480, padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />

            {/* Company header */}
            {(() => {
              const bm = BADGES[selected.badge] || BADGES.basic;
              return (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.xl }}>
                  <div>
                    <div style={{ fontSize:19, fontWeight:900, color:C.text1, marginBottom:6 }}>{selected.name}</div>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      <span style={{ background:bm.bg, color:bm.color, borderRadius:R.full,
                        padding:"3px 10px", fontSize:12, fontWeight:700 }}>{bm.icon} {bm.label}</span>
                      <span style={{ background:C.surface2, color:C.text3, borderRadius:R.full,
                        padding:"3px 10px", fontSize:12 }}>온도 {selected.temp}°</span>
                    </div>
                    <div style={{ fontSize:12, color:C.text4 }}>📞 {selected.phone}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:C.navy }}>{selected.deposit}만원</div>
                    <div style={{ fontSize:11, color:C.text4 }}>납부 보증금</div>
                    <div style={{ fontSize:11, color:bm.color, fontWeight:700, marginTop:2 }}>최대 {bm.maxJob} 수주</div>
                  </div>
                </div>
              );
            })()}

            {/* Documents checklist */}
            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>📄 제출 서류</div>
              {selected.docs.map((doc, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:`${S.sm}px 0`,
                  borderBottom: i < selected.docs.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
                  <span style={{ fontSize:13, color:C.text2 }}>{doc.label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:doc.submitted ? C.green : C.red }}>
                    {doc.submitted ? "✓ 제출" : "✗ 미제출"}
                  </span>
                </div>
              ))}
            </div>

            {/* Submission info */}
            <div style={{ display:"flex", justifyContent:"space-between",
              padding:`${S.sm}px 0`, marginBottom:S.xl,
              borderTop:`1px solid ${C.bgWarm}`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:12, color:C.text3 }}>신청일</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.text1 }}>{selected.submittedAt}</span>
            </div>

            {/* Actions for pending */}
            {selected.status === "pending" && (
              !rejectMode ? (
                <div style={{ display:"flex", gap:S.sm }}>
                  <button onClick={() => setRejectMode(true)}
                    style={{ flex:1, padding:"13px", background:"#FFF0F0", color:C.red,
                      border:`1px solid ${C.red}33`, borderRadius:R.lg,
                      fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    ✗ 반려
                  </button>
                  <button onClick={() => setConfirm({ type:"approve", company:selected })}
                    style={{ flex:2, padding:"13px", background:C.green, color:"#fff",
                      border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14,
                      cursor:"pointer", boxShadow:`0 4px 14px ${C.green}44` }}>
                    ✓ 승인하기
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text1, marginBottom:S.sm }}>반려 사유 입력</div>
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="반려 사유를 입력하세요 (업체에게 전달됩니다)"
                    style={{ width:"100%", padding:S.lg, borderRadius:R.lg, border:`1px solid ${C.bgWarm}`,
                      background:C.surface2, fontSize:13, color:C.text1, resize:"none", height:90,
                      boxSizing:"border-box", marginBottom:S.md, outline:"none", fontFamily:"inherit",
                      lineHeight:1.6 }}
                  />
                  <div style={{ display:"flex", gap:S.sm }}>
                    <button onClick={() => { setRejectMode(false); setRejectNote(""); }}
                      style={{ flex:1, padding:"13px", background:C.bg, color:C.text2,
                        border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                      취소
                    </button>
                    <button
                      onClick={() => rejectNote.trim() && setConfirm({ type:"reject", company:selected, note:rejectNote })}
                      style={{ flex:2, padding:"13px",
                        background:rejectNote.trim() ? C.red : C.bgWarm,
                        color:rejectNote.trim() ? "#fff" : C.text4,
                        border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14,
                        cursor:rejectNote.trim() ? "pointer" : "not-allowed" }}>
                      반려 처리하기
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Status display for non-pending */}
            {selected.status !== "pending" && (
              <div style={{ background:selected.status === "approved" ? C.greenL : "#FFF0F0",
                borderRadius:R.lg, padding:S.lg, display:"flex", alignItems:"flex-start", gap:S.sm,
                border:`1px solid ${selected.status === "approved" ? C.green + "33" : C.red + "33"}` }}>
                <span style={{ fontSize:22, flexShrink:0 }}>
                  {selected.status === "approved" ? "✅" : "❌"}
                </span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700,
                    color:selected.status === "approved" ? C.green : C.red }}>
                    {selected.status === "approved" ? "승인 완료" : "반려됨"}
                  </div>
                  {selected.rejectNote && (
                    <div style={{ fontSize:12, color:C.text3, marginTop:4, lineHeight:1.6 }}>
                      {selected.rejectNote}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:300, padding:`0 ${S.xl}px` }}>
          <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xxl, width:"100%", maxWidth:320 }}>
            <div style={{ textAlign:"center", marginBottom:S.xl }}>
              <div style={{ fontSize:48, marginBottom:12 }}>
                {confirm.type === "approve" ? "✅" : "❌"}
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:8 }}>
                {confirm.type === "approve" ? "승인하시겠어요?" : "반려하시겠어요?"}
              </div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>
                <b style={{ color:C.text1 }}>{confirm.company.name}</b> 업체를<br/>
                {confirm.type === "approve"
                  ? "승인 처리합니다. 업체에게 알림이 전달됩니다."
                  : "반려 처리합니다. 사유가 업체에 전달됩니다."}
              </div>
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setConfirm(null)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                취소
              </button>
              <button
                onClick={() => confirm.type === "approve"
                  ? handleApprove(confirm.company)
                  : handleReject(confirm.company, confirm.note)}
                style={{ flex:2, padding:S.xl,
                  background:confirm.type === "approve" ? C.green : C.red,
                  color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
                  cursor:"pointer", boxShadow:`0 4px 16px ${confirm.type === "approve" ? C.green : C.red}44` }}>
                {confirm.type === "approve" ? "승인하기" : "반려하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
