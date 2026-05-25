import { useState, useRef } from "react";
import { C, R, S, REVIEW_TAGS } from "../constants";
import { Stars } from "./common";
import { calcTempDelta } from "../utils/calculations";
import { uploadFile } from "../lib/supabase";

const MAX_PHOTOS = 5;

export default function ReviewModal({
  onClose, onSubmit,
  contractStatus, hasActiveDispute,
  companyId, customerId,
}) {
  if (hasActiveDispute) {
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}>
        <div style={{ background:"#FFF0F0", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"32px 24px 48px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:17, fontWeight:800, color:"#D63030", marginBottom:8 }}>분쟁 진행 중</div>
          <div style={{ fontSize:13, color:"#7A8A7E", lineHeight:1.7, marginBottom:24 }}>분쟁이 진행 중인 계약에는 후기를 작성할 수 없습니다.<br />분쟁 해결 후 작성 가능합니다.</div>
          <button onClick={onClose} style={{ padding:"14px 40px", background:"#D63030", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:15, cursor:"pointer" }}>확인</button>
        </div>
      </div>
    );
  }
  if (contractStatus && !["COMPLETED","SETTLED"].includes(contractStatus)) {
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}>
        <div style={{ background:"#F8F5F0", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"32px 24px 48px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:17, fontWeight:800, color:"#1F2A24", marginBottom:8 }}>아직 후기를 남길 수 없어요</div>
          <div style={{ fontSize:13, color:"#7A8A7E", lineHeight:1.7, marginBottom:24 }}>공사가 완료되고 정산이 끝난 후 후기를 작성할 수 있습니다.</div>
          <button onClick={onClose} style={{ padding:"14px 40px", background:"#2E5F4B", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:15, cursor:"pointer" }}>확인</button>
        </div>
      </div>
    );
  }

  const [step,      setStep]      = useState(1);
  const [rating,    setRating]    = useState(0);
  const [hover,     setHover]     = useState(0);
  const [content,   setContent]   = useState("");
  const [tags,      setTags]      = useState([]);
  const [photos,    setPhotos]    = useState([]); // { id, file, preview }
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(false);
  const [imageUrls, setImageUrls] = useState([]);
  const fileInputRef = useRef(null);

  const LABELS = ["","별로예요","아쉬워요","보통이에요","좋았어요","최고예요!"];
  const toggle  = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const delta     = calcTempDelta(rating, photos.length > 0);
  const deltaStr  = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaColor = delta > 0 ? C.brand : delta < 0 ? C.red : C.text3;

  const addPhotos = (files) => {
    const slots = MAX_PHOTOS - photos.length;
    if (slots <= 0) return;
    const items = Array.from(files).slice(0, slots).map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...items]);
  };

  const removePhoto = (id) => setPhotos(prev => prev.filter(p => p.id !== id));

  const canSubmit = content.length >= 20 && photos.length > 0 && !uploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    setUploadErr(false);
    try {
      const urls = await Promise.all(
        photos.map(({ file }) =>
          uploadFile(
            "photos",
            `reviews/${companyId ?? "unknown"}/${customerId ?? "unknown"}/${Date.now()}_${file.name}`,
            file
          )
        )
      );
      setImageUrls(urls);
      onSubmit({ rating, content, tags, imageUrls: urls });
      setStep(3);
    } catch {
      setUploadErr(true);
    }
    setUploading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />

        {/* ── STEP 1: Star rating ── */}
        {step === 1 && (<>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>⭐</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>시공은 어떠셨나요?</div>
            <div style={{ fontSize:13, color:C.text3 }}>솔직한 후기가 다른 분들께 큰 도움이 됩니다</div>
          </div>

          {/* Coupon incentive */}
          <div style={{ background:"#FFF8EC", borderRadius:R.lg, padding:`${S.md}px ${S.lg}px`,
            marginBottom:S.xl, border:"1px solid #F5D97A",
            display:"flex", alignItems:"flex-start", gap:S.sm }}>
            <div style={{ fontSize:22, flexShrink:0 }}>☕</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"#8A5C00", marginBottom:3 }}>
                포토리뷰 작성 시 커피쿠폰 지급
              </div>
              <div style={{ fontSize:11, color:"#A06B00", lineHeight:1.6 }}>
                공사 완료 후 포토리뷰를 남겨주시면 커피쿠폰을 드립니다.<br/>
                별점과 관계없이 현장 사진이 포함된 실제 거래 후기에 한해 지급됩니다.
              </div>
            </div>
          </div>

          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:12 }}>
              {[1,2,3,4,5].map(s => (
                <span key={s} onClick={() => setRating(s)}
                  onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                  style={{ fontSize:46, cursor:"pointer",
                    color:s<=(hover||rating)?C.gold:"#E8E4DC",
                    transition:"all 0.1s",
                    transform:s<=(hover||rating)?"scale(1.15)":"scale(1)",
                    display:"inline-block" }}>★</span>
              ))}
            </div>
            {(hover||rating) > 0 && <div style={{ fontWeight:800, fontSize:15, color:C.gold }}>{LABELS[hover||rating]}</div>}
          </div>
          <button onClick={() => rating > 0 && setStep(2)}
            style={{ width:"100%", padding:S.xl, background:rating>0?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:rating>0?"pointer":"not-allowed" }}>다음</button>
        </>)}

        {/* ── STEP 2: Detail + photos ── */}
        {step === 2 && (<>
          <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.xl }}>
            <button onClick={() => setStep(1)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.text3 }}>←</button>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>상세 후기 작성</div>
              <Stars rating={rating} size={13} />
            </div>
          </div>

          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>어떤 점이 좋았나요?</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {REVIEW_TAGS.map(t => (
              <button key={t} onClick={() => toggle(t)}
                style={{ padding:"8px 14px", borderRadius:R.full, fontSize:13, fontWeight:600,
                  border:`1.5px solid ${tags.includes(t)?C.brand:C.bgWarm}`,
                  background:tags.includes(t)?C.brandL:C.surface,
                  color:tags.includes(t)?C.brand:C.text2, cursor:"pointer" }}>
                {tags.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>

          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>후기 내용</div>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="시공 과정, 결과물, 업체 태도 등 솔직한 후기를 남겨주세요." rows={4}
            style={{ width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
              borderRadius:R.lg, fontSize:14, outline:"none", resize:"none",
              boxSizing:"border-box", lineHeight:1.7, fontFamily:"inherit", color:C.text1,
              background:C.surface }} />
          <div style={{ textAlign:"right", fontSize:12, color:content.length<20?C.red:C.text4, marginBottom:S.lg }}>
            {content.length}자 {content.length < 20 ? "(최소 20자)" : ""}
          </div>

          {/* Photo upload — required */}
          <div style={{ marginBottom:S.lg }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.sm }}>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.text1 }}>
                  📷 현장 사진 <span style={{ color:C.red }}>*</span>
                </div>
                <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>
                  사진 1장 이상 필수 · 최대 {MAX_PHOTOS}장 · 커피쿠폰 지급 조건
                </div>
              </div>
              <span style={{ fontSize:11, color: photos.length > 0 ? C.brand : C.text4, fontWeight:700 }}>
                {photos.length}/{MAX_PHOTOS}
              </span>
            </div>

            {photos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:S.sm }}>
                {photos.map(({ id, preview }) => (
                  <div key={id} style={{ position:"relative", width:76, height:76 }}>
                    <img src={preview} alt=""
                      style={{ width:"100%", height:"100%", objectFit:"cover",
                        borderRadius:R.md, border:`1px solid ${C.bgWarm}` }} />
                    <button onClick={() => removePhoto(id)}
                      style={{ position:"absolute", top:-7, right:-7, width:20, height:20,
                        background:"rgba(28,23,18,0.8)", color:"#fff", border:"none",
                        borderRadius:"50%", fontSize:13, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontWeight:900, lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple
                  style={{ display:"none" }}
                  onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} />
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ width:"100%", padding:"11px",
                    background: photos.length === 0 ? "#FFF8EC" : C.surface2,
                    color: photos.length === 0 ? "#8A5C00" : C.text2,
                    border: `1.5px dashed ${photos.length === 0 ? "#F5D97A" : C.bgWarm}`,
                    borderRadius:R.md, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  {photos.length === 0 ? "☕ + 현장 사진 추가 (쿠폰 지급 조건)" : "+ 사진 추가"}
                </button>
              </>
            )}
          </div>

          {/* Temp preview */}
          {rating > 0 && (
            <div style={{ background:delta >= 0 ? C.brandL : "#FFF0F0",
              borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`,
              border:`1px solid ${delta >= 0 ? C.brandM : "#FFCCCC"}`,
              marginBottom:S.lg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, color:C.text2, fontWeight:600 }}>🌡 공간온도 변화</span>
              <span style={{ fontSize:15, fontWeight:900, color:deltaColor }}>{deltaStr}°</span>
            </div>
          )}

          {uploadErr && (
            <div style={{ fontSize:12, color:C.red, textAlign:"center", marginBottom:S.md }}>
              사진 업로드 중 오류가 발생했습니다. 다시 시도해주세요.
            </div>
          )}

          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ width:"100%", padding:S.xl,
              background: canSubmit ? C.brand : "#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {uploading ? "사진 업로드 중..." : photos.length === 0 ? "사진을 추가해주세요" : "후기 등록하기"}
          </button>
        </>)}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:8 }}>포토리뷰 등록 완료!</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl, lineHeight:1.7 }}>소중한 후기 감사합니다.</div>

            {imageUrls.length > 0 && (
              <div style={{ background:"#FFF8EC", borderRadius:R.lg, padding:S.xl,
                marginBottom:S.xl, border:"1px solid #F5D97A" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>☕</div>
                <div style={{ fontSize:15, fontWeight:800, color:"#8A5C00", marginBottom:6 }}>
                  커피쿠폰 지급 대상입니다!
                </div>
                <div style={{ fontSize:12, color:"#A06B00", lineHeight:1.6 }}>
                  담당자 확인 후 등록하신 연락처로<br/>커피쿠폰을 발송해 드립니다.
                </div>
              </div>
            )}

            <div style={{ background:delta >= 0 ? C.brandL : "#FFF0F0",
              borderRadius:R.lg, padding:S.lg, marginBottom:S.xxl, display:"inline-block",
              border:`1px solid ${delta >= 0 ? C.brandM : "#FFCCCC"}` }}>
              <div style={{ fontSize:14, fontWeight:800, color:deltaColor }}>
                🌡 공간온도 {deltaStr}° {delta > 0 ? "상승!" : delta < 0 ? "하락" : "(변동 없음)"}
              </div>
            </div>
            <br/>
            <button onClick={onClose}
              style={{ padding:"14px 40px", background:C.brand, color:"#fff", border:"none",
                borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}
