// Session cookie only: no password, no persistent localStorage credential.
// It is only ever exchanged with the configured provider, never trusted as identity.
export function refreshCookieName(secure:boolean){return secure?'__Secure-myrp-refresh':'myrp-refresh';}
export function readRefreshCookie(header:string|undefined,secure:boolean){
 const name=refreshCookieName(secure),values=(header??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 if(values.length!==1)return null;
 const token=values[0].slice(name.length+1);
 return /^[A-Za-z0-9._~-]{8,4096}$/.test(token)?token:null;
}
export function refreshCookie(token:string|null,secure:boolean){
 if(token!==null&&!/^[A-Za-z0-9._~-]{8,4096}$/.test(token))throw Error('Invalid account session.');
 return `${refreshCookieName(secure)}=${token??''}; Path=/api/auth; HttpOnly; SameSite=Strict${secure?'; Secure':''}${token===null?'; Max-Age=0':''}`;
}
