import { useState } from "react";
import { C, R, S, REVIEW_TAGS } from "../constants";
import { Stars } from "./common";

export default function ReviewModal({ onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const LABELS = ["","별로예요","아쉬워요","보통이에요","좋았어요","최고예요!"];
  const toggle = t => setTags(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />

        {step===1 && <>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>⭐</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>시공은 어떠셨나요?</div>
            <div style={{ fontSize:13, color:C.text3 }}>솔직한 후기가 다른 분들께 큰 도움이 됩니다</div>
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
          <button onClick={() => rating>0&&setStep(2)}
            style={{ width:"100%", padding:S.xl, background:rating>0?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:rating>0?"pointer":"not-allowed" }}>다음</button>
        </>}

        {step===2 && <>
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
                {tags.includes(t)?"✓ ":""}{t}
              </button>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>후기 내용</div>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="시공 과정, 결과물, 업체 태도 등 솔직한 후기를 남겨주세요." rows={5}
            style={{ width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
              borderRadius:R.lg, fontSize:14, outline:"none", resize:"none",
              boxSizing:"border-box", lineHeight:1.7, fontFamily:"inherit", color:C.text1,
              background:C.surface }} />
          <div style={{ textAlign:"right", fontSize:12, color:content.length<20?C.red:C.text4, marginBottom:S.lg }}>
            {content.length}자 {content.length<20?"(최소 20자)":""}
          </div>

          {/* Photo reward CTA */}
          <div onClick={() => setHasPhoto(p => !p)}
            style={{ background:hasPhoto?C.greenL:C.surface2, borderRadius:R.lg, padding:S.md,
              marginBottom:S.md, border:`1.5px solid ${hasPhoto?C.green:C.bgWarm}`,
              display:"flex", alignItems:"center", gap:S.md, cursor:"pointer" }}>
            <div style={{ width:40, height:40, borderRadius:R.md, flexShrink:0,
              background:hasPhoto?C.green:"#E8E0D4",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
              {hasPhoto ? "✓" : "📷"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:hasPhoto?C.green:C.text1 }}>
                {hasPhoto ? "사진 첨부 완료!" : "사진 첨부하기"}
              </div>
              <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>
                사진 리뷰 작성 시 ☕ 스타벅스 쿠폰 증정
              </div>
            </div>
            {hasPhoto && <span style={{ fontSize:20 }}>🎁</span>}
          </div>

          <button onClick={() => content.length>=20&&setStep(3)}
            style={{ width:"100%", padding:S.xl, background:content.length>=20?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:content.length>=20?"pointer":"not-allowed" }}>후기 등록하기</button>
        </>}

        {step===3 && (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:8 }}>후기 등록 완료!</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:20, lineHeight:1.7 }}>소중한 후기 감사합니다.</div>
            <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.md, display:"inline-block" }}>
              <div style={{ fontSize:13, color:C.brand, fontWeight:700 }}>🌡 공간온도 +0.3° 상승!</div>
            </div>
            {hasPhoto && (
              <div style={{ background:"#FFF8E7", borderRadius:R.lg, padding:S.lg,
                marginBottom:S.md, border:"1.5px solid #F5C842" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>☕</div>
                <div style={{ fontSize:14, fontWeight:800, color:"#8B6914", marginBottom:4 }}>
                  리뷰 작성 완료!
                </div>
                <div style={{ fontSize:13, color:"#6B5010", lineHeight:1.6 }}>
                  카카오톡으로 스타벅스 쿠폰을<br/>보내드립니다 🎁
                </div>
              </div>
            )}
            <button onClick={() => { onSubmit({ rating, content, tags, hasPhoto }); onClose(); }}
              style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}
