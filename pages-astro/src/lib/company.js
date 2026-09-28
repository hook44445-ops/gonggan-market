import { isTestCompany, safeImage, reviewStats } from './display.js';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Source: app src/lib/companySlug.js, including Korean slugs.
export const validRef = ref => UUID_RE.test(ref) || (ref.length >= 2 && ref.length <= 20 && /^[가-힣a-z0-9](?:[가-힣a-z0-9-]{0,18}[가-힣a-z0-9])?$/.test(ref));
export class DataUnavailable extends Error {}
export function createReader({url,key,fetcher=fetch}) {
 return async (table, params={}) => {
  if (!url || !key) throw new DataUnavailable('Public data configuration missing');
  let response;
  try {
   response = await fetcher(url.replace(/\/$/,'')+'/rest/v1/'+table+'?'+new URLSearchParams(params), {
    headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'}, signal:AbortSignal.timeout(8000)
   });
  } catch { throw new DataUnavailable('Public data request failed'); }
  if (!response.ok) {
   const body = await response.json().catch(()=>({}));
   const error = new DataUnavailable('Public data unavailable'); error.code = body.code; throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new DataUnavailable('Invalid public data');
  const total = response.headers?.get('content-range')?.split('/')[1];
  return { rows, count:total && total!=='*' ? Number(total) : rows.length };
 };
}
const legacyFields='id,name,region,specialties,completed_jobs,temp,verified,has_insurance,guarantee_status,guarantee_badge_visible,guarantee_grade,license_verified,is_direct,service_regions';
// Never reveal a hidden/deleted review, even when its old status is still published.
const reviewVisibility={status:'eq.published',and:'(or(is_hidden.is.null,is_hidden.eq.false),or(is_deleted.is.null,is_deleted.eq.false))'};
export async function getCompanyByRef(raw, read) {
 const ref=String(raw || '').trim().toLowerCase();
 if (!validRef(ref)) return null;
 const filter=UUID_RE.test(ref) ? {id:'eq.'+ref} : {slug:'eq.'+ref};
 let result;
 for (const select of [legacyFields+',slug,cover_url,logo_url,intro',legacyFields+',slug',legacyFields]) {
  if (!UUID_RE.test(ref) && !select.endsWith('slug') && select === legacyFields) return null;
  try { result=await read('companies',{...filter,select,limit:'1'}); break; }
  catch(error) { if (!['42703','PGRST204'].includes(error.code)) throw error; }
 }
 if (!result) throw new DataUnavailable('Unsupported company schema');
 const company=result.rows[0];
 if (!company || isTestCompany(company)) return null;
 const [works, firstReviews, external] = await Promise.all([
  read('portfolios',{company_id:'eq.'+company.id,select:'id,title,space_type,area,after_photos,before_photos',order:'created_at.desc,id.desc',limit:'12'}),
  read('reviews',{company_id:'eq.'+company.id,...reviewVisibility,select:'id,rating,content,space_type,user_name,image_urls',order:'created_at.desc,id.desc',limit:'1000'}),
  read('external_reviews',{company_id:'eq.'+company.id,is_hidden:'eq.false',select:'id,author_name,rating,work_title,content',order:'created_at.desc,id.desc',limit:'5'}).catch(error=>{
   if (['42P01','PGRST205'].includes(error.code)) return {rows:[],count:0};
   throw error;
  })
 ]);
 const reviews=[...firstReviews.rows];
 while(reviews.length<firstReviews.count) {
  const next=await read('reviews',{company_id:'eq.'+company.id,...reviewVisibility,select:'id,rating',order:'created_at.desc,id.desc',offset:String(reviews.length),limit:'1000'});
  if(!next.rows.length) throw new DataUnavailable('Incomplete review summary');
  reviews.push(...next.rows);
 }
 return { company, works:works.rows.map(w=>({...w,photo:safeImage(w.after_photos?.[0]) || safeImage(w.before_photos?.[0])})), workCount:works.count, reviews:reviews.slice(0,5), stats:reviewStats(reviews), external:external.rows, externalCount:external.count };
}
export async function companySitemap(read) {
 const rows=[]; let offset=0;
 for (;;) {
  const page=await read('companies',{select:'id,name,slug',slug:'not.is.null',order:'id.asc',offset:String(offset),limit:'1000'});
  rows.push(...page.rows.filter(c=>!isTestCompany(c) && validRef(c.slug)));
  offset+=page.rows.length;
  if(offset>=page.count || !page.rows.length) break;
 }
 return rows;
}
