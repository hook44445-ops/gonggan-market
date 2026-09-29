import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inviteLoadError,inviteReturnAfterAuth} from './inviteAuth.js';
test('인증 누락·거절만 본인 확인으로 안내하고 장애는 재시도로 구분한다',()=>{
 for(const error of [{code:'INVITE_AUTH_REQUIRED'},{code:'PGRST301'},{code:'PGRST302'},{code:'PGRST303'},{status:401},{message:'LOGIN_REQUIRED'},{message:'JWT expired'}])assert.equal(inviteLoadError(error).needsAuth,true);
 for(const error of [{code:'PGRST202',message:'referral_my_code not found'},{message:'Failed to fetch'},{status:503},null])assert.equal(inviteLoadError(error).needsAuth,false);
 assert.ok(!inviteLoadError({message:'LOGIN_REQUIRED'}).message.includes('로그인이 풀렸어요'));
});
test('초대 복귀는 명시적 재인증 후 유효한 계정 토큰이 있을 때만',()=>{
 assert.equal(inviteReturnAfterAuth(true,{id:'u1'},true),'invite');
 assert.equal(inviteReturnAfterAuth(false,{id:'u1'},true),null);
 assert.equal(inviteReturnAfterAuth(true,{id:'u1'},false),null);
 assert.equal(inviteReturnAfterAuth(true,{id:'u1',isGuest:true},true),null);
 assert.equal(inviteReturnAfterAuth(true,null,true),null);
});
