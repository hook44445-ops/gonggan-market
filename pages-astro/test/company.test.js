import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReader,getCompanyByRef,companySitemap,DataUnavailable} from '../src/lib/company.js';
import {coverFor,trustFor,levelFor,jsonLd} from '../src/lib/display.js';
const co={id:'11111111-1111-4111-8111-111111111111',slug:'our-home',name:'우리집 시공',specialties:['아파트 부분'],completed_jobs:0};
const empty={rows:[],count:0};
test('없거나 테스트 업체인 주소는 자식 데이터를 조회하지 않는다',async()=>{
 for(const company of [null,{...co,name:'TEST 업체'}]){
 const calls=[];const result=await getCompanyByRef('our-home',async table=>{calls.push(table);return {rows:company?[company]:[],count:company?1:0};});
 assert.equal(result,null);assert.deepEqual(calls,['companies']);
 }
 assert.equal(await getCompanyByRef('../private',()=>{throw Error('must not query');}),null);
});
test('프로필/slug 칸 없는 uuid도 조회되며 서버 장애는 0건으로 위장하지 않는다',async()=>{
 const selects=[];
 const read=async(table,p)=>{
  if(table!=='companies')return empty;
  selects.push(p.select);
  if(p.select.includes('slug'))throw Object.assign(new Error('missing'),{code:'42703'});
  return {rows:[co],count:1};
 };
 assert.equal((await getCompanyByRef(co.id,read)).company.id,co.id);assert.equal(selects.length,3);
 await assert.rejects(getCompanyByRef(co.id,async()=>{throw new DataUnavailable('offline');}));
});
test('밖 공사 별점은 계약 후기 평균·건수·레벨과 분리한다',async()=>{
 const data=await getCompanyByRef('our-home',async(table,p)=>table==='companies'?{rows:[co],count:1}:table==='reviews'?{rows:[{id:1,rating:2,content:'계약 후기'}],count:1}:table==='external_reviews'?{rows:[{rating:5,content:'밖 공사'}],count:99}:empty);
 assert.equal(data.stats.average,'2.0');assert.equal(data.stats.count,1);assert.equal(data.externalCount,99);assert.equal(levelFor(data.company),1);
});
test('별점 요약은 서버 페이지 제한 뒤의 계약 후기까지 계산한다',async()=>{
 const read=async(table,p)=>table==='companies'?{rows:[co],count:1}:table==='reviews'?{rows:p.offset?[{id:2,rating:5}]:[{id:1,rating:1}],count:2}:empty;
 const data=await getCompanyByRef('our-home',read);assert.equal(data.stats.count,2);assert.equal(data.stats.average,'3.0');
});
test('직접 올린 커버 우선, 확인되지 않은 서류로 엠블럼을 켜지 않는다',()=>{
 assert.match(coverFor(co),/space.webp$/);assert.equal(coverFor({...co,cover_url:'https://example.com/own.jpg'}),'https://example.com/own.jpg');
 assert.match(coverFor({...co,cover_url:'javascript:alert(1)'}),/space.webp$/);
 assert.deepEqual(trustFor({badge:'premium',biz_cert_url:'uploaded',guarantee_grade:'PREMIUM'}).map(t=>t.earned),[false,false,false]);
 assert.equal(trustFor({guarantee_status:'ACTIVE',guarantee_badge_visible:true,guarantee_grade:'PREMIUM'})[2].earned,true);
 assert.ok(!jsonLd({name:'</script><script>alert(1)</script>'}).includes('<'));
});
test('후기 1,205건도 본문은 최신 5개만 읽고 전체 평점과 건수는 보존한다',async()=>{
 const all=Array.from({length:1205},(_,id)=>({id,rating:id<5?1:5,content:'긴 후기 '.repeat(400),image_urls:['https://example.com/photo.webp']}));
 const calls=[];
 const result=await getCompanyByRef('our-home',async(table,p)=>{
  if(table==='companies')return {rows:[co],count:1};
  if(table!=='reviews')return empty;
  calls.push(p);
  const rows=all.slice(Number(p.offset||0),Number(p.offset||0)+Number(p.limit)).map(r=>p.select.includes('content')?r:{id:r.id,rating:r.rating});
  return {rows,count:all.length};
 });
 assert.deepEqual(calls.map(p=>[p.offset||'0',p.limit]),[['0','5'],['5','1000'],['1005','1000']]);
 assert.equal(calls.filter(p=>p.select.includes('content')).length,1);
 assert.ok(calls.slice(1).every(p=>p.select==='id,rating'));
 assert.equal(result.stats.count,1205);assert.equal(result.stats.average,'5.0');
 assert.deepEqual(result.reviews.map(r=>r.id),[0,1,2,3,4]);
 assert.ok(result.reviews.every(r=>r.content&&r.image_urls.length===1));
});
test('남은 후기 페이지를 읽지 못하면 부분 평점을 표시하지 않는다',async()=>{
 await assert.rejects(getCompanyByRef('our-home',async(table,p)=>{
  if(table==='companies')return {rows:[co],count:1};
  if(table!=='reviews')return empty;
  return p.offset?empty:{rows:[{id:1,rating:5}],count:6};
 }),DataUnavailable);
});
test('anon REST는 GET·공개 필드만 요청하고 HTTP 오류를 숨기지 않는다',async()=>{
 let opts,url;
 const read=createReader({url:'https://example.invalid',key:'anon-fixture',fetcher:async(u,o)=>{url=u;opts=o;return {ok:true,json:async()=>[co],headers:new Headers({'content-range':'0-0/1'})};}});
 assert.equal((await read('companies',{id:'eq.'+co.id,select:'id,name'})).count,1);assert.equal(opts.method,undefined);assert.ok(url.includes('select=id%2Cname'));
 await assert.rejects(createReader({url:'https://example.invalid',key:'anon',fetcher:async()=>({ok:false,json:async()=>({code:'42501'})})})('companies'));
});
test('사이트맵은 테스트 업체를 빼고 페이지를 끝까지 읽는다',async()=>{
 const result=await companySitemap(async(table,p)=>({rows:p.offset==='0'?[co,{...co,slug:'test-home',name:'테스트'}]:[{...co,slug:'another'}],count:3}));
 assert.deepEqual(result.map(c=>c.slug),['our-home','another']);
});
test('한글 주소를 지원하고 모든 후기 페이지에 숨김·삭제 제외 조건을 유지한다',async()=>{
 const calls=[];
 await getCompanyByRef('우리집',async(table,p)=>{
  calls.push([table,p]);
  return table==='companies'?{rows:[co],count:1}:table==='reviews'?{rows:[{id:p.offset?2:1,rating:4}],count:2}:empty;
 });
 assert.equal(calls[0][1].slug,'eq.우리집');
 const reviews=calls.filter(([table])=>table==='reviews');assert.equal(reviews.length,2);
 for(const [,p] of reviews){assert.equal(p.status,'eq.published');assert.equal(p.and,'(or(is_hidden.is.null,is_hidden.eq.false),or(is_deleted.is.null,is_deleted.eq.false))');}
});
