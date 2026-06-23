import { C, R } from "../constants";

// ── 위치 권한 안내 모달 (UX 레이어) ───────────────────────────────────────────
// OS(Android/iOS) 위치 권한 팝업을 바로 띄우지 않고, 공간마켓 브랜드 톤의 안내를
// 먼저 보여준 뒤 "위치 권한 설정하기"를 누르면 기존 GPS 권한 요청 로직을 그대로 실행한다.
//   · 기존 GPS/Permission 로직 무수정 — 본 컴포넌트는 표시 + onConfirm 콜백만 담당.
//   · 기존 바텀시트 모달 패턴(고정 오버레이 + 24px 라운드 시트) 재사용.
//   · role: "company" → 업체용 카피, 그 외 → 고객용 카피.
const COPY = {
  consumer: {
    title: "더 신뢰할 수 있는 프로젝트를 함께 만들어갑니다.",
    desc: "위치 정보는 프로젝트 진행 단계와 현장 기록을 더욱 정확하게 연결하여 신뢰도 높은 프로젝트 관리와 공간보증 서비스를 제공합니다.",
    items: [
      "프로젝트 진행 기록 자동 연결",
      "현장 방문 및 단계 인증",
      "신뢰도 높은 프로젝트 이력 관리",
      "공간보증 서비스 기반 제공",
    ],
  },
  company: {
    title: "신뢰받는 시공 기록을 시작합니다.",
    desc: "현장 방문과 프로젝트 진행 기록을 연결하여 고객에게 더욱 신뢰받는 시공 이력을 만들어갑니다.",
    items: [
      "현장 방문 기록",
      "프로젝트 진행 인증",
      "시공 이력 관리",
      "공간보증 기반 서비스",
    ],
  },
};

// 아이콘 흐름: 📍 위치 → 📷 현장기록 → 🛡 공간보증
const FLOW = [
  { icon: "📍", label: "위치" },
  { icon: "📷", label: "현장기록" },
  { icon: "🛡", label: "공간보증" },
];

export default function LocationPermissionModal({ open, role = "consumer", onConfirm, onClose }) {
  if (!open) return null;
  const copy = role === "company" ? COPY.company : COPY.consumer;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 600 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: C.bg, borderRadius: "24px 24px 0 0",
          padding: "22px 20px 26px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />

        {/* 아이콘 흐름 — 📍 → 📷 → 🛡 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {FLOW.map((f, i) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: C.brandL,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{f.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text3 }}>{f.label}</div>
              </div>
              {i < FLOW.length - 1 && <div style={{ color: C.brand, fontSize: 15, marginBottom: 16 }}>→</div>}
            </div>
          ))}
        </div>

        {/* 제목 */}
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, lineHeight: 1.45, textAlign: "center", marginBottom: 10 }}>
          {copy.title}
        </div>
        {/* 설명 */}
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, textAlign: "center", marginBottom: 18 }}>
          {copy.desc}
        </div>

        {/* 안내 항목 */}
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg,
          padding: "14px 16px", marginBottom: 20 }}>
          {copy.items.map((it) => (
            <div key={it} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
              <span style={{ color: C.brand, fontWeight: 800, fontSize: 14 }}>✔</span>
              <span style={{ fontSize: 13.5, color: C.text1, fontWeight: 600 }}>{it}</span>
            </div>
          ))}
        </div>

        {/* 위치 권한 설정하기 → 기존 GPS 권한 요청 실행 */}
        <button onClick={onConfirm}
          style={{ width: "100%", padding: 14, background: C.brand, color: "#fff", border: "none",
            borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          위치 권한 설정하기
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: 12, background: "none", color: C.text3, border: "none",
            fontWeight: 700, fontSize: 13.5, cursor: "pointer", marginTop: 4 }}>
          다음에 하기
        </button>
      </div>
    </div>
  );
}
