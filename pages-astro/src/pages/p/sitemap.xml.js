import {createReader,companySitemap} from '../../lib/company.js';
import {xml} from '../../lib/display.js';
export const prerender=false;
export async function GET(){
 const site=(import.meta.env.SITE_URL || process.env.SITE_URL || 'https://gongganmarket.com').replace(/\/$/,'');
 const read=createReader({url:import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL,key:import.meta.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY});
 try{
  const rows=await companySitemap(read);
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows.map(c=>'<url><loc>'+xml(site+'/p/'+encodeURIComponent(c.slug))+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=600, stale-while-revalidate=86400'}});
 }catch{return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});}
}
