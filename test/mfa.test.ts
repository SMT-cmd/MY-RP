import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseMFA} from '../src/mfa.ts';
import {DomainError} from '../src/domain.ts';
const id='00000000-0000-4000-8000-000000000001',challenge='00000000-0000-4000-8000-000000000002',authorization='Bearer header.payload.signature';
test('MFA gateway exposes only own TOTP metadata, validates factors/codes and sends exact provider challenge fields',async()=>{
 const calls:{url:string;options:RequestInit}[]=[],responses=[{factors:[{id,factor_type:'totp',status:'verified',friendly_name:'My phone',secret:'not-returned'},{id:challenge,factor_type:'phone',status:'verified'}]},{id,totp:{secret:'ABCDEFGHIJKLMNOP',qr_code:'not-served'}},{id:challenge},{access_token:'header.payload.signature',refresh_token:'memory-refresh',expires_in:600}];
 const fetcher:typeof fetch=async(url,options)=>{calls.push({url:String(url),options:options!});return new Response(JSON.stringify(responses.shift()));},mfa=supabaseMFA('https://example.supabase.co','sb_publishable_test',fetcher);
 assert.deepEqual(await mfa('list',{},authorization),{factors:[{id,status:'verified',friendly_name:'My phone'}]});
 assert.deepEqual(await mfa('enroll',{},authorization),{factorId:id,secret:'ABCDEFGHIJKLMNOP'});
 assert.deepEqual(await mfa('challenge',{factorId:id},authorization),{challengeId:challenge});
 await mfa('verify',{factorId:id,challengeId:challenge,code:'123456'},authorization);
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[1].url,'https://example.supabase.co/auth/v1/factors');assert.equal(calls[2].url,'https://example.supabase.co/auth/v1/factors/'+id+'/challenge');
 assert.deepEqual(JSON.parse(String(calls[3].options.body)),{challenge_id:challenge,code:'123456'});assert.equal((calls[3].options.headers as Record<string,string>).Authorization,authorization);assert.equal(calls[3].options.redirect,'error');
 const count=calls.length;for(const payload of [{factorId:'../admin'},{factorId:id,challengeId:challenge,code:'12345'},{factorId:id,challengeId:'../',code:'123456'}])await assert.rejects(mfa('verify',payload,authorization),e=>e instanceof DomainError&&e.status===400);
 await assert.rejects(mfa('list',{},'Bearer invalid'),e=>e instanceof DomainError&&e.status===401);assert.equal(calls.length,count);
});
test('unfinished enrollment can be discarded only for an owned unverified factor; verified factors and raw provider errors stay protected',async()=>{
 let status='verified',deletes=0;const mfa=supabaseMFA('https://example.supabase.co','sb_publishable_test',async(url,options)=>{
  if(options?.method==='GET')return new Response(JSON.stringify({factors:[{id,factor_type:'totp',status}]}));
  deletes++;assert.equal(options?.method,'DELETE');return new Response(null,{status:204});
 });
 await assert.rejects(mfa('discard',{factorId:id},authorization),e=>e instanceof DomainError&&e.status===403);await assert.rejects(mfa('discard',{factorId:challenge},authorization));assert.equal(deletes,0);
 status='unverified';assert.deepEqual(await mfa('discard',{factorId:id},authorization),{discarded:true});assert.equal(deletes,1);
 const limited=supabaseMFA('https://example.supabase.co','sb_publishable_test',async()=>new Response('private upstream trace',{status:429}));await assert.rejects(limited('list',{},authorization),e=>e instanceof DomainError&&e.code==='MFA_RATE_LIMIT'&&!e.message.includes('private'));
});
