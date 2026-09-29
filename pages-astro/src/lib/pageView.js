// Browser-only adapter for app src/lib/pageViews.js (SQL 156).
export async function recordPageView({companyId,ownerId,url,key,storage,fetcher=fetch,now=Date.now()}) {
 if (!companyId || !url || !key) return false;
 const day=new Date(now+9*3600000).toISOString().slice(0,10);
 const storageKey='gonggan_pv:'+companyId;
 try {
  if(storage.getItem(storageKey)===day)return false;
  let viewer=null;
  try{viewer=JSON.parse(storage.getItem('gonggan_user') || 'null')?.id;}catch{}
  if(ownerId && viewer===ownerId)return false;
  // Without durable storage, skip rather than count every reload.
  storage.setItem(storageKey,day);
 }catch{return false;}
 try {
  const response=await fetcher(url.replace(/\/$/,'')+'/rest/v1/rpc/company_page_view',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({p_company_id:companyId}),signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error('View not recorded');
  return true;
 }catch{
  try{if(storage.getItem(storageKey)===day)storage.removeItem(storageKey);}catch{}
  return false;
 }
}
