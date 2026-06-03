import { useState, useRef } from "react";
import { C, R, S } from "../constants";
import {
  createSiteVisit,
  gpsCheckin,
  completeSiteVisit,
  createNotification,
  uploadFile,
} from "../lib/supabase";

function Backdrop({ onClose, children }) {
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}
      onClick={onClose}
    >
      <div
        style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
        {children}
      </div>
    </div>
  );
}

export default function SiteVisitModal({ job, companyId, userId, onClose, onChange, onGoEstimate }) {
  const sv = job.siteVisit;
  const status = sv?.status ?? null;

  const initialStep = !sv ? "schedule" :
    status === "scheduled" ? "checkin" :
    status === "checked_in" ? "field_estimate" :
    status === "completed" ? "estimate_done" :
    "estimate_done";

  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);

  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("10:00");

  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const [fieldAmount, setFieldAmount] = useState("");
  const [fieldNote, setFieldNote] = useState("");

  const notifyCustomer = (type, title, message, relatedId) => {
    if (!job.request?.user_id) return;
    createNotification({
      userId: job.request.user_id,
      type,
      title,
      message,
      relatedId: relatedId ?? job.bid.id,
      relatedType: "bid",
      priority: "NORMAL",
    });
  };

  const handleSchedule = async () => {
    if (!schedDate) { alert("날짜를 선택해주세요"); return; }
    setSaving(true);
    const scheduledAt = new Date(`${schedDate}T${schedTime}:00`).toISOString();
    const { data, error } = await createSiteVisit({
      bid_id: job.bid.id,
      request_id: job.bid.request_id,
      company_id: companyId,
      status: "scheduled",
      scheduled_at: scheduledAt,
    });
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    notifyCustomer("SITE_VISIT_SCHEDULED", "실측 일정이 등록되었습니다", `${schedDate} ${schedTime}에 실측 방문 예정입니다`, data.id);
    const updated = { ...job, siteVisit: data };
    onChange(updated);
    setStep("checkin");
  };

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photos.length);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      try {
        const path = `site_visits/${job.bid.id}/${Date.now()}_${file.name}`;
        const url = await uploadFile("documents", path, file);
        urls.push(url);
      } catch (_) {
        // ignore individual upload failures
      }
    }
    setPhotos(prev => [...prev, ...urls].slice(0, 3));
    setUploading(false);
  };

  const handleCheckin = async () => {
    setSaving(true);
    const doCheckin = async (lat, lng) => {
      const { data, error } = await gpsCheckin(job.siteVisit.id, { lat, lng, photos });
      setSaving(false);
      if (error) { alert("저장 실패: " + error.message); return; }
      notifyCustomer("GPS_CHECKIN", "업체가 GPS 체크인했습니다", "실측 담당자가 현장에 도착했습니다", data.id);
      const updated = { ...job, siteVisit: data };
      onChange(updated);
      setStep("field_estimate");
    };
    navigator.geolocation.getCurrentPosition(
      pos => doCheckin(pos.coords.latitude, pos.coords.longitude),
      () => doCheckin(37.5665, 126.9780)
    );
  };

  const handleFieldEstimate = async () => {
    setSaving(true);
    const { data, error } = await completeSiteVisit(job.siteVisit.id, {
      fieldAmount: fieldAmount ? Number(fieldAmount) : null,
      fieldNote,
    });
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    notifyCustomer("FIELD_ESTIMATE", "현장견적이 입력되었습니다", "실측이 완료되어 현장 견적이 등록되었습니다", data.id);
    const updated = { ...job, siteVisit: data };
    onChange(updated);
    setStep("estimate_done");
  };

  if (step === "schedule") {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.lg }}>📅 실측 일정 잡기</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
          {job.request?.space_type ?? ""} {job.request?.size ?? ""} · {job.request?.area ?? ""}
        </div>
        <div style={{ marginBottom:S.lg }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>방문 날짜</div>
          <input
            type="date"
            value={schedDate}
            onChange={e => setSchedDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:15, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
          />
        </div>
        <div style={{ marginBottom:S.xxl }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>방문 시간</div>
          <input
            type="time"
            value={schedTime}
            onChange={e => setSchedTime(e.target.value)}
            style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:15, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
          />
        </div>
        <div style={{ display:"flex", gap:S.sm }}>
          <button onClick={onClose} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>취소</button>
          <button onClick={handleSchedule} disabled={saving} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", opacity:saving?0.7:1 }}>
            {saving ? "저장중..." : "일정 등록하기"}
          </button>
        </div>
      </Backdrop>
    );
  }

  if (step === "checkin") {
    const svData = job.siteVisit;
    return (
      <Backdrop onClose={onClose}>
        <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.sm }}>📍 GPS 체크인</div>
        {svData?.scheduled_at && (
          <div style={{ fontSize:13, color:C.brand, marginBottom:S.xl, fontWeight:700 }}>
            예정: {new Date(svData.scheduled_at).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"numeric", minute:"2-digit" })}
          </div>
        )}
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, fontSize:13, color:C.brand }}>
          현장 도착 후 GPS 체크인을 눌러주세요. 현재 위치가 자동으로 기록됩니다.
        </div>
        <div style={{ marginBottom:S.xl }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>현장 사진 (최대 3장)</div>
          <div style={{ display:"flex", gap:S.sm, flexWrap:"wrap" }}>
            {photos.map((url, i) => (
              <div key={i} style={{ width:80, height:80, borderRadius:R.md, overflow:"hidden", border:`1px solid ${C.bgWarm}` }}>
                <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
            ))}
            {photos.length < 3 && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ width:80, height:80, borderRadius:R.md, border:`2px dashed ${C.bgWarm}`, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, cursor:"pointer", color:C.text3 }}>
                {uploading ? "..." : "+"}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handlePhotoSelect} />
        </div>
        <div style={{ display:"flex", gap:S.sm }}>
          <button onClick={onClose} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>닫기</button>
          <button onClick={handleCheckin} disabled={saving} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", opacity:saving?0.7:1 }}>
            {saving ? "위치 확인중..." : "📍 GPS 체크인"}
          </button>
        </div>
      </Backdrop>
    );
  }

  if (step === "field_estimate") {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.lg }}>📝 현장견적 입력</div>
        <div style={{ marginBottom:S.lg }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>현장 견적 금액 (만원, 선택)</div>
          <input
            type="number"
            value={fieldAmount}
            onChange={e => setFieldAmount(e.target.value)}
            placeholder="예) 450"
            style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:15, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
          />
        </div>
        <div style={{ marginBottom:S.xxl }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>현장 메모</div>
          <textarea
            value={fieldNote}
            onChange={e => setFieldNote(e.target.value)}
            placeholder="현장 상태, 특이사항 등 메모"
            rows={4}
            style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }}
          />
        </div>
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, fontSize:12, color:C.brand }}>
          실측 완료 후 72시간(3일) 내에 플랫폼 견적서를 제출해야 합니다.
        </div>
        <div style={{ display:"flex", gap:S.sm }}>
          <button onClick={onClose} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>닫기</button>
          <button onClick={handleFieldEstimate} disabled={saving} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", opacity:saving?0.7:1 }}>
            {saving ? "저장중..." : "실측 완료"}
          </button>
        </div>
      </Backdrop>
    );
  }

  const svDone = job.siteVisit;
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.lg }}>
        {status === "estimate_submitted" ? "✅ 견적서 제출 완료" : "실측 완료"}
      </div>
      {svDone?.field_estimate_amount && (
        <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.lg }}>
          <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>현장 견적 금액</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{Number(svDone.field_estimate_amount).toLocaleString()}만원</div>
        </div>
      )}
      {svDone?.field_estimate_note && (
        <div style={{ background:C.bg, borderRadius:R.lg, padding:S.lg, marginBottom:S.lg }}>
          <div style={{ fontSize:13, color:C.text3, marginBottom:4 }}>현장 메모</div>
          <div style={{ fontSize:13, color:C.text1 }}>{svDone.field_estimate_note}</div>
        </div>
      )}
      {status !== "estimate_submitted" && (
        <button
          onClick={() => onGoEstimate({ ...job })}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44`, marginBottom:S.sm }}>
          📋 플랫폼 견적서 작성하기
        </button>
      )}
      <button onClick={onClose} style={{ width:"100%", padding:S.lg, background:"none", border:"none", color:C.text3, fontWeight:700, fontSize:14, cursor:"pointer" }}>닫기</button>
    </Backdrop>
  );
}
