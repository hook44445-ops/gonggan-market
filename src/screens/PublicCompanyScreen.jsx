import { useEffect, useState } from "react";
import { getCompanyByRef } from "../lib/supabase";
import { normalizeCompany } from "../components/MainApp";
import { isTestCompany } from "../lib/testCompany";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import PortfolioScreenBeta from "./PortfolioScreenBeta";
import { getCurrentUserId, getSessionToken } from "../lib/session";
import { rememberPendingReview } from "../lib/externalReview";
import InviteWelcome from "../components/InviteWelcome";
import { rememberPreferredCompany } from "../lib/preferredCompany";

// ════════════════════════════════════════════════════════════════════════════
// /p/업체ID — 업체 공개 페이지(대표 09-28 「1등 다운로드 앱」)
//   업체가 블로그·인스타·명함에 거는 주소. 로그인 없이 시공 사례·후기·신뢰 엠블럼을 본다.
//   고객 화면의 업체 상세(PortfolioScreenBeta)를 그대로 쓰고, 버튼만 «공간마켓에서 무료 견적 받기» 하나.
//   ?ref= 는 App 이 기기에 보관한다(초대 146·148) — 업체가 데려온 가입도 초대로 잡힌다.
//   테스트 업체·없는 업체는 «찾을 수 없어요».
// ════════════════════════════════════════════════════════════════════════════

export default function PublicCompanyScreen({ companyRef }) {
  const [state, setState] = useState({ loading: true, company: null });

  useEffect(() => {
    let alive = true;
    getCompanyByRef(companyRef).then(({ data }) => {
      if (!alive) return;
      const ok = data && !isTestCompany(data);
      setState({ loading: false, company: ok ? { ...normalizeCompany(data), slug: data.slug ?? null } : null });
    }).catch(() => alive && setState({ loading: false, company: null }));
    return () => { alive = false; };
  }, [companyRef]);

  const c = state.company;
  useDocumentMeta({
    title: c ? `${c.name} — ${c.region || "우리 동네"} 인테리어·집수리 | 공간마켓` : "업체 — 공간마켓",
    description: c
      ? `${c.name}의 시공 사례와 후기를 확인하고 공간마켓에서 무료로 견적을 받아 보세요.${c.region ? ` ${c.region} 인테리어·집수리.` : ""}`
      : "공간마켓 — 인테리어·집수리 견적 비교",
    path: `/p/${c?.slug || c?.id || companyRef}`,
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
  // 공간마켓 밖 공사 후기(151) — 로그인(토큰)돼 있으면 바로 쓰기, 아니면 기억해 두고 로그인으로(로그인 뒤 App 이 되돌린다).
  const loggedIn = (() => { const uid = getCurrentUserId(); return !!(uid && getSessionToken(uid)); })();
  // ?write=1(후기 부탁 링크) — 로그인돼 있을 때만 바로 연다. 아니면 페이지를 먼저 보여 주고 버튼으로 로그인.
  const writeOpen = loggedIn && (() => { try { return new URLSearchParams(window.location.search).get("write") === "1"; } catch { return false; } })();
  const onWriteExternal = (open) => {
    if (loggedIn) { open(); return; }
    rememberPendingReview(c.slug || c.id);
    window.location.href = "/";
  };
  // 견적 받기 — 이 업체를 기억해 두고 앱으로. 요청을 올리면 이 업체에 먼저 알린다(lib/preferredCompany).
  const onRequest = () => {
    rememberPreferredCompany({ id: c.id, name: c.name, ownerId: c.ownerId });
    window.location.href = "/";
  };
  return (
    <>
      {!loggedIn && <InviteWelcome style={{ margin: "12px 16px 0", borderRadius: 14 }} />}
      <PortfolioScreenBeta company={c} publicView onBack={toHome} onRequest={onRequest} onWriteExternal={onWriteExternal} writeOpen={writeOpen} />
    </>
  );
}
