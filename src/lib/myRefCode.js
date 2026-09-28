// 내 초대 코드 — 공유 버튼이 링크에 붙인다(lib/referral withRefCode). 한 번 받으면 기기에 기억해 서버를 다시 부르지 않는다.
// 코드는 바뀌지 않는다(146 referral_my_code 는 한 번 만든 코드를 그대로 돌려준다).
import { getMyReferral } from "./supabase";
import { normalizeRefCode } from "./referral";

const key = (userId) => `gonggan_my_ref_code:${userId}`;

export async function myRefCode(userId) {
  if (!userId) return null;
  try {
    const saved = normalizeRefCode(localStorage.getItem(key(userId)));
    if (saved) return saved;
  } catch { /* noop */ }
  try {
    const { data, error } = await getMyReferral();
    const code = error ? null : normalizeRefCode(data?.code);
    if (code) { try { localStorage.setItem(key(userId), code); } catch { /* noop */ } }
    return code;
  } catch { return null; }
}
