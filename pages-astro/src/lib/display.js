// Rules copied from app src/lib/companyCover.js, testCompany.js,
// components/TrustEmblems.jsx, constants/{guarantee,growth}.js. App is authority.
const keys = new Map([
 ['욕실','bath'],['방수/누수','bath'],['줄눈/탄성코트','bath'],['주방','kitchen'],
 ['인테리어 필름','film'],['몰딩/도어','film'],['바닥/도배','finish'],['페인트','finish'],['타일','finish'],
 ...['아파트 전체/부분','아파트 전체','아파트 부분','원룸','원룸/오피스텔','카페/식당','오피스','상가'].map(x=>[x,'space'])
]);
export const isTestCompany = c => /테스트|(^|[^a-z])test([^a-z]|$)/i.test(String(c?.name ?? ''));
export const coverKeyFor = list => keys.get(Array.isArray(list) ? String(list[0] ?? '').trim() : '') ?? 'repair';
export function safeImage(value) {
 if (typeof value !== 'string') return null;
 if (value.startsWith('/images/') && !value.includes('..')) return value;
 try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
export const coverFor = c => safeImage(c?.cover_url || c?.cover) || '/p/images/company-cover/' + coverKeyFor(c?.specialties) + '.webp';
export const depositVisible = c => c?.guarantee_badge_visible === true && c?.guarantee_status === 'ACTIVE' && !!c?.guarantee_grade;
export function levelFor(c) {
 const xp = Math.max(0, Number(c.completed_jobs) || 0) * 280 + (depositVisible(c) ? 30 : 0);
 return [0,900,2100,3600,5700,8400,11700,15900,21000,27000].filter(n=>xp>=n).length;
}
export function trustFor(c) {
 const grade = String(c.guarantee_grade || '').toLowerCase();
 return [
  { label:'사업자', file:'biz', earned:c.verified === true, detail:'사업자등록 확인' },
  { label:'시공보험', file:'insurance', earned:c.has_insurance === true, detail:'시공보험 가입 확인' },
  { label:'보증금', file:depositVisible(c) && ['basic','standard','premium','master','signature'].includes(grade) ? 'deposit-'+grade : 'deposit', earned:depositVisible(c), detail:'공간보증 보증금 예치 확인' },
  ...(c.license_verified === true ? [{label:'실내건축',file:'license',earned:true,detail:'실내건축공사업 등록 확인'}] : [])
 ];
}
export function reviewStats(reviews) {
 const rated = reviews.filter(r => Number.isFinite(Number(r.rating)) && Number(r.rating)>=1 && Number(r.rating)<=5);
 return { count:reviews.length, ratedCount:rated.length, average:rated.length ? (rated.reduce((n,r)=>n+Number(r.rating),0)/rated.length).toFixed(1) : null };
}
export const stars = rating => '★'.repeat(Math.max(0,Math.min(5,Math.round(Number(rating)||0))));
export const jsonLd = value => JSON.stringify(value).replace(/</g,'\\u003c');
export const xml = value => String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
// Source: src/utils/siteSeo.js BIZ_ROWS, 2026-09-29.
export const BIZ_ROWS = [['상호','공간사이'],['대표자','김태웅'],['사업자등록번호','270-53-00885'],['통신판매업신고번호','2026-성남중원-0463'],['주소','경기도 성남시 중원구 성남대로1151번길 5, 2층 202호'],['고객센터','070-7954-2740'],['이메일','biz@gonggansai.com']];
