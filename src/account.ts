import { DomainError } from './domain.ts';
export type AccountAction = 'login'|'signup'|'refresh'|'logout';
export type AccountGateway = (action: AccountAction, body: Record<string,unknown>, authorization?:string)=>Promise<Record<string,unknown>>;
// Credentials are forwarded only to this configured project. Provider responses are
// reduced to session fields; editable metadata never grants game permissions.
export function supabaseAccounts(projectUrl:string,publishableKey:string,fetcher:typeof fetch=fetch):AccountGateway {
 const origin=new URL(projectUrl);
 if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash||!publishableKey.startsWith('sb_publishable_'))throw new Error('Use the Supabase HTTPS project origin and publishable key.');
 return async(action,body,authorization)=>{
  let path='/auth/v1/',payload:Record<string,unknown>={};
  if(action==='login'||action==='signup'){
   if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.password!=='string'||body.password.length<8||body.password.length>256)throw new DomainError('ACCOUNT_INPUT','Enter your email and a password of 8–256 characters.',400);
   payload={email:body.email,password:body.password};path+=action==='signup'?'signup':'token?grant_type=password';
  }else if(action==='refresh'){
   if(typeof body.refresh_token!=='string'||body.refresh_token.length<8||body.refresh_token.length>4096)throw new DomainError('AUTH_REQUIRED','Sign in again to continue.',401);
   payload={refresh_token:body.refresh_token};path+='token?grant_type=refresh_token';
  }else{
   if(!authorization?.match(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/))throw new DomainError('AUTH_REQUIRED','Sign in to continue.',401);
   path+='logout?scope=local';
  }
  let response:Response;
  try{response=await fetcher(new URL(path,origin),{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json',...(action==='logout'?{Authorization:authorization!}:{})},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new DomainError('AUTH_UNAVAILABLE','Account service is unavailable. Try again shortly.',503);}
  if(response.status===429)throw new DomainError('ACCOUNT_RATE_LIMIT','Too many account attempts. Wait before trying again.',429);
  if(!response.ok)throw new DomainError(action==='signup'?'ACCOUNT_SIGNUP_FAILED':'AUTH_REQUIRED',action==='signup'?'Registration could not be completed. Check your details or try signing in.':'Sign-in failed. Check your credentials and email confirmation.',action==='signup'?400:401);
  if(action==='logout')return {signedOut:true};
  let data:Record<string,unknown>;try{data=await response.json();}catch{throw new DomainError('AUTH_UNAVAILABLE','Account service returned an invalid response.',503);}
  if(action==='signup'&&!data.access_token)return {confirmationRequired:true,message:'Check your email to confirm your account, then sign in.'};
  if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||typeof data.expires_in!=='number')throw new DomainError('AUTH_UNAVAILABLE','Account service returned an invalid session.',503);
  return {access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in};
 };
}
