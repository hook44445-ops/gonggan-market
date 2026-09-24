// 휴대폰 본인인증(포트원 V2 · PASS/통신사 실명 확인).
//
// 왜: 문자 인증은 「그 번호를 가진 사람」만 확인한다. 본인인증은 번호 소유 + 실명을 한 번에 확인한다.
//     업체 가입·로그인은 문자 대신 이 길을 타서, 단계는 늘지 않고 신원 확인이 더해진다
//     (대표: 「숨길 게 아니라 진짜 본인인증 되게 · 업체는 본인인증이 빠르게」).
//
// 켜지는 조건 — 환경변수 두 개가 있으면 켜진다(없으면 지금처럼 문자 인증으로 동작):
//   VITE_PORTONE_STORE_ID                 포트원 상점 아이디
//   VITE_PORTONE_IDENTITY_CHANNEL_KEY     본인인증 채널 키(KG이니시스 통합인증 · 다날 등)
//   서버에는 PORTONE_API_SECRET(api/verify-otp.js) — 결과를 서버가 포트원에 다시 물어 확인한다.
//
// 흐름: startIdentityVerification → (인증창) → completeIdentityVerification → 서버 확인 결과
//       { verified, via: "identity", user, phone, name }
// 모바일은 인증창이 페이지를 떠났다가 redirectUrl 로 돌아온다. 그때는 App 이 주소의 결과를
// stashIdentityReturn 으로 챙겨 두고, 목적(purpose)이 맞는 화면이 takeIdentityReturn 으로 꺼낸다.

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_IDENTITY_CHANNEL_KEY;
const SDK_URL = "https://cdn.portone.io/v2/browser-sdk.js";

export const IDENTITY_READY = !!(STORE_ID && CHANNEL_KEY);

const PURPOSE_KEY = "gm_identity_purpose";
const RETURN_KEY = "gm_identity_return";

let sdkPromise = null;
function loadSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PortOne) return Promise.resolve(window.PortOne);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => (window.PortOne ? resolve(window.PortOne) : reject(new Error("sdk")));
      s.onerror = () => { sdkPromise = null; reject(new Error("sdk")); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

const newId = () =>
  `iv-${(typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

// purpose: "login_company"(업체 가입·로그인) | "mypage"(로그인한 뒤 인증)
// 반환: 인증 건 아이디 — 모바일에서 페이지가 떠나면(리다이렉트) null.
export async function startIdentityVerification({ purpose = "login_company" } = {}) {
  if (!IDENTITY_READY) throw new Error("본인인증이 아직 준비되지 않았어요");
  const PortOne = await loadSdk();
  const identityVerificationId = newId();
  const back = purpose === "login_company" ? "/?login=company&iv_return=1" : "/?iv_return=1";
  try { sessionStorage.setItem(PURPOSE_KEY, purpose); } catch { /* 없어도 PC 는 동작 */ }
  const r = await PortOne.requestIdentityVerification({
    storeId: STORE_ID,
    identityVerificationId,
    channelKey: CHANNEL_KEY,
    redirectUrl: `${window.location.origin}${back}`,
  });
  if (!r) return null;                                   // 리다이렉트로 떠남(모바일)
  if (r.code) throw new Error(r.message || "본인인증을 마치지 못했어요");
  return r.identityVerificationId ?? identityVerificationId;
}

// 서버가 포트원에 다시 물어 확인한다. userId 는 마이페이지 인증(그 사용자의 번호와 같아야 함).
export async function completeIdentityVerification(identityVerificationId, userId = null) {
  const res = await fetch("/api/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityVerificationId, ...(userId ? { userId } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "본인인증을 확인하지 못했어요");
  return data;
}

// App 초기화에서 한 번 — 주소에 실려 온 결과를 챙겨 두고 true 를 돌려준다.
export function stashIdentityReturn(params) {
  const id = params.get("identityVerificationId");
  if (!id) return false;
  let purpose = null;
  try { purpose = sessionStorage.getItem(PURPOSE_KEY); sessionStorage.removeItem(PURPOSE_KEY); } catch { /* noop */ }
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({
      id, purpose, code: params.get("code"), message: params.get("message"),
    }));
  } catch { /* noop */ }
  return true;
}

// 목적이 맞는 화면이 꺼낸다(한 번만). 실패로 돌아왔으면 { error } 를 준다.
export function takeIdentityReturn(purpose) {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v.purpose && v.purpose !== purpose) return null;
    sessionStorage.removeItem(RETURN_KEY);
    if (v.code) return { error: v.message || "본인인증을 마치지 못했어요" };
    return { id: v.id };
  } catch { return null; }
}
