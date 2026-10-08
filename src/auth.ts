import { DomainError } from './domain.ts';

export type Identity = { actorId: string; sessionId: string; assurance: 'aal1' | 'aal2'; stepUpAt?:number };
export type Authenticate = (authorization: string | undefined) => Promise<Identity>;

// Identity comes from Auth's verified user response. JWT decoding alone never authenticates.
export function supabaseAuthenticator(projectUrl: string, publishableKey: string, fetcher: typeof fetch = fetch): Authenticate {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use the HTTPS Supabase project origin.');
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('A Supabase publishable key is required.');
  return async authorization => {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
    if (!token || token.length > 8192) throw new DomainError('AUTH_REQUIRED', 'Sign in to continue.', 401);
    let response: Response;
    try { response = await fetcher(new URL('/auth/v1/user', url), { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), redirect: 'error' }); }
    catch { throw new DomainError('AUTH_UNAVAILABLE', 'Account verification is unavailable. Try again shortly.', 503); }
    if (response.status === 401 || response.status === 403) throw new DomainError('AUTH_REQUIRED', 'Sign in again to continue.', 401);
    if (!response.ok) throw new DomainError('AUTH_UNAVAILABLE', 'Account verification is unavailable. Try again shortly.', 503);
    let user: Record<string, unknown>, claims: Record<string, unknown>;
    try { user = await response.json(); claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new DomainError('AUTH_REQUIRED', 'The account could not be verified.', 401); }
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (typeof user.id !== 'string' || !uuid.test(user.id) || user.is_anonymous === true || user.deleted_at || (typeof user.banned_until === 'string' && Date.parse(user.banned_until) > Date.now())) throw new DomainError('ACCOUNT_INELIGIBLE', 'An eligible registered account is required.', 403);
    if (claims.sub !== user.id || typeof claims.session_id !== 'string' || !uuid.test(claims.session_id) || !Number.isFinite(claims.exp) || (claims.exp as number) * 1000 <= Date.now()) throw new DomainError('AUTH_REQUIRED', 'Sign in again to continue.', 401);
    // Role fields and editable user_metadata are deliberately not authorization sources.
    const times=Array.isArray(claims.amr)?claims.amr.filter(a=>a&&typeof a==='object'&&a.method==='totp'&&Number.isSafeInteger(a.timestamp)&&a.timestamp>=0&&a.timestamp*1000<=Date.now()).map(a=>a.timestamp*1000):[];
    return { actorId: user.id, sessionId: claims.session_id, assurance: claims.aal === 'aal2' ? 'aal2' : 'aal1',...(claims.aal==='aal2'&&times.length?{stepUpAt:Math.max(...times)}:{}) };
  };
}
