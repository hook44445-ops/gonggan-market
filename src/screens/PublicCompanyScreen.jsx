import { useEffect, useState } from "react";
import { getCompany } from "../lib/supabase";
import { normalizeCompany } from "../components/MainApp";
import { isTestCompany } from "../lib/testCompany";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import PortfolioScreenBeta from "./PortfolioScreenBeta";

// ════════════════════════════════════════════════════════════════════════════
// /p/업체ID — 업체 공개 페이지(대표 09-28 「1등 다운로드 앱」)
//   업체가 블로그·인스타·명함에 거는 주소. 로그인 없이 시공 사례·후기·신뢰 엠블럼을 본다.
//   고객 화면의 업체 상세(PortfolioScreenBeta)를 그대로 쓰고, 버튼만 «공간마켓에서 무료 견적 받기» 하나.
//   ?ref= 는 App 이 기기에 보관한다(초대 146·148) — 업체가 데려온 가입도 초대로 잡힌다.
//   테스트 업체·없는 업체는 «찾을 수 없어요».
// ════════════════════════════════════════════════════════════════════════════

export default function PublicCompanyScreen({ companyId }) {
  const [state, setState] = useState({ loading: true, company: null });

  useEffect(() => {
    let alive = true;
    getCompany(companyId).then(({ data }) => {
      if (!alive) return;
      const ok = data && !isTestCompany(data);
      setState({ loading: false, company: ok ? normalizeCompany(data) : null });
    }).catch(() => alive && setState({ loading: false, company: null }));
    return () => { alive = false; };
  }, [companyId]);

  const c = state.company;
  useDocumentMeta({
    title: c ? `${c.name} — ${c.region || "우리 동네"} 인테리어·집수리 | 공간마켓` : "업체 — 공간마켓",
    description: c
      ? `${c.name}의 시공 사례와 후기를 확인하고 공간마켓에서 무료로 견적을 받아 보세요.${c.region ? ` ${c.region} 인테리어·집수리.` : ""}`
      : "공간마켓 — 인테리어·집수리 견적 비교",
    path: `/p/${companyId}`,
  });

  const toHome = () => { window.location.href = "/"; };

  if (state.loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#7A8A7E", fontSize: 14 }}>불러오는 중…</div>;
  }
  if (!c) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center",
        fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1F2A24" }}>업체를 찾을 수 없어요</div>
          <div style={{ fontSize: 13, color: "#7A8A7E", marginTop: 8 }}>주소가 바뀌었거나 활동을 쉬고 있는 업체예요.</div>
          <a href="/" style={{ display: "inline-block", marginTop: 18, padding: "12px 20px", borderRadius: 12, background: "#2E5F4B",
            color: "#fff", fontWeight: 800, textDecoration: "none" }}>공간마켓에서 다른 업체 보기</a>
        </div>
      </div>
    );
  }
  return <PortfolioScreenBeta company={c} publicView onBack={toHome} onRequest={toHome} />;
}
