import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseAuthenticator } from '../src/auth.ts';
import { DomainError } from '../src/domain.ts';
const actorId = '00000000-0000-4000-8000-000000000001', sessionId = '00000000-0000-4000-8000-000000000002';
const token = (claims: Record<string, unknown> = {}) => ['header', Buffer.from(JSON.stringify({ sub: actorId, session_id: sessionId, exp: Math.floor(Date.now()/1000)+600, aal: 'aal1', ...claims })).toString('base64url'), 'signature'].join('.');
const fake = (data: unknown, status=200): typeof fetch => async () => new Response(JSON.stringify(data), { status });
const code = (name: string) => (e: unknown) => e instanceof DomainError && e.code === name;
test('identity uses verified Auth response and ignores editable role metadata', async () => {
  const auth = supabaseAuthenticator('https://example.supabase.co', 'sb_publishable_test', fake({ id: actorId, user_metadata: { role: 'super_admin' } }));
  assert.deepEqual(await auth('Bearer '+token()), { actorId, sessionId, assurance:'aal1' });
  await assert.rejects(auth('Bearer '+token({ sub: sessionId })), code('AUTH_REQUIRED'));
});
test('unverified tokens, anonymous users, expired sessions and upstream failures fail closed', async () => {
  const make = (data: unknown, status=200) => supabaseAuthenticator('https://example.supabase.co', 'sb_publishable_test', fake(data,status));
  await assert.rejects(make({})('Bearer '+token()), code('ACCOUNT_INELIGIBLE'));
  await assert.rejects(make({ id:actorId,is_anonymous:true })('Bearer '+token()), code('ACCOUNT_INELIGIBLE'));
  await assert.rejects(make({ id:actorId },401)('Bearer '+token()), code('AUTH_REQUIRED'));
  await assert.rejects(make({ id:actorId },503)('Bearer '+token()), code('AUTH_UNAVAILABLE'));
  await assert.rejects(make({ id:actorId })('Bearer '+token({ exp:1 })), code('AUTH_REQUIRED'));
  await assert.rejects(make({ id:actorId })('Bearer forged'), code('AUTH_REQUIRED'));
  assert.throws(()=>supabaseAuthenticator('http://example.supabase.co','sb_publishable_test'));
  assert.throws(()=>supabaseAuthenticator('https://example.supabase.co','sb_secret_invalid'));
});
test('staff step-up age comes only from verified aal2 TOTP authentication claims',async()=>{
 const auth=supabaseAuthenticator('https://example.supabase.co','sb_publishable_test',fake({id:actorId,user_metadata:{aal:'aal2',stepUpAt:Date.now()}})),now=Math.floor(Date.now()/1000);
 assert.equal((await auth('Bearer '+token({aal:'aal2',amr:[{method:'password',timestamp:now}]}))).stepUpAt,undefined);
 assert.equal((await auth('Bearer '+token({aal:'aal1',amr:[{method:'totp',timestamp:now}]}))).stepUpAt,undefined);
 assert.equal((await auth('Bearer '+token({aal:'aal2',amr:[{method:'totp',timestamp:now+60}]}))).stepUpAt,undefined);
 assert.equal((await auth('Bearer '+token({aal:'aal2',amr:[{method:'totp',timestamp:now-1000},{method:'totp',timestamp:now-10}]}))).stepUpAt,(now-10)*1000);
});
