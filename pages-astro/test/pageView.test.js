import test from 'node:test';
import assert from 'node:assert/strict';
import {recordPageView} from '../src/lib/pageView.js';
const setup=()=>{
 const values=new Map();const calls=[];
 return {values,calls,options:{companyId:'company',ownerId:'owner',url:'https://example.invalid/',key:'anon-test',now:Date.parse('2026-09-29T14:59:00Z'),storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetcher:async(...args)=>{calls.push(args);return {ok:true};}}};
};
test('anon RPC counts once per Korean day and sends only the company ID',async()=>{
 const {values,calls,options}=setup();
 assert.equal(await recordPageView(options),true);
 assert.equal(await recordPageView(options),false);
 assert.equal(values.get('gonggan_pv:company'),'2026-09-29');
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'https://example.invalid/rest/v1/rpc/company_page_view');
 assert.equal(calls[0][1].method,'POST');
 assert.deepEqual(JSON.parse(calls[0][1].body),{p_company_id:'company'});
 assert.equal(calls[0][1].headers.apikey,'anon-test');
 assert.equal(await recordPageView({...options,now:Date.parse('2026-09-29T15:00:00Z')}),true);
 assert.equal(values.get('gonggan_pv:company'),'2026-09-30');
});
test('owner is excluded; malformed or absent app session remains anonymous',async()=>{
 const {values,calls,options}=setup();
 values.set('gonggan_user',JSON.stringify({id:'owner'}));
 assert.equal(await recordPageView(options),false);assert.equal(calls.length,0);
 values.set('gonggan_user','broken');
 assert.equal(await recordPageView(options),true);
});
test('failed request can retry; denied storage cannot repeatedly inflate counts',async()=>{
 const {values,options}=setup();
 assert.equal(await recordPageView({...options,fetcher:async()=>({ok:false})}),false);
 assert.equal(values.has('gonggan_pv:company'),false);
 assert.equal(await recordPageView({...options,fetcher:async()=>{throw Error('offline');}}),false);
 assert.equal(await recordPageView(options),true);
 assert.equal(await recordPageView({...options,storage:{getItem(){throw Error('denied');}},fetcher(){throw Error('must not request');}}),false);
});
test('pending request suppresses duplicate invocation',async()=>{
 const {options}=setup();let finish;
 const first=recordPageView({...options,fetcher:()=>new Promise(resolve=>{finish=resolve;})});
 assert.equal(await recordPageView(options),false);
 finish({ok:true});assert.equal(await first,true);
});
