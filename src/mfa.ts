import {DomainError} from './domain.ts';
export type MFAAction='list'|'enroll'|'challenge'|'verify'|'discard';
export type MFAGateway=(action:MFAAction,body:Record<string,unknown>,authorization:string|undefined)=>Promise<Record<string,unknown>>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function supabaseMFA(projectUrl:string,publishableKey:string,fetcher:typeof fetch=fetch):MFAGateway{
 const origin=new URL(projectUrl);if(origin.protocol!=='https:'||origin.origin!==projectUrl||origin.username||origin.password||!publishableKey.startsWith('sb_publishable_'))throw Error('Use the Supabase project origin and publishable key.');
 return async(action,body,authorization)=>{
  if(!['list','enroll','challenge','verify','discard'].includes(action))throw new DomainError('MFA_ACTION','Choose a supported authenticator action.',400);
  if(!authorization?.match(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/))throw new DomainError('AUTH_REQUIRED','Sign in to manage your authenticator.',401);
  let path='/auth/v1/',method='POST',payload:Record<string,unknown>={};
  if(action==='list'){path+='user';method='GET';}
  else if(action==='enroll'){path+='factors';payload={factor_type:'totp',friendly_name:'MY-RP staff'};}
  else{
   if(typeof body.factorId!=='string'||!uuid.test(body.factorId))throw new DomainError('MFA_FACTOR','Choose your authenticator factor.',400);
   if(action==='discard'){
    const factors=await supabaseMFA(projectUrl,publishableKey,fetcher)('list',{},authorization);
    if(!(factors.factors as {id:string;status:string}[]).some(f=>f.id===body.factorId&&f.status==='unverified'))throw new DomainError('MFA_FACTOR','Only your unfinished setup factor can be discarded.',403);
    path+='factors/'+body.factorId;method='DELETE';
   }else path+='factors/'+body.factorId+'/'+action;
   if(action==='verify'){if(typeof body.challengeId!=='string'||!uuid.test(body.challengeId)||typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new DomainError('MFA_CODE','Enter the current six-digit authenticator code.',400);payload={challenge_id:body.challengeId,code:body.code};}
  }
  let response:Response;try{response=await fetcher(new URL(path,origin),{method,headers:{apikey:publishableKey,Authorization:authorization,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(payload)}),redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new DomainError('AUTH_UNAVAILABLE','Authenticator verification is unavailable. Try again shortly.',503);}
  if(response.status===429)throw new DomainError('MFA_RATE_LIMIT','Wait before another authenticator attempt.',429);
  if(response.status===401)throw new DomainError('AUTH_REQUIRED','Sign in again before verifying your authenticator.',401);
  if(!response.ok)throw new DomainError('MFA_REJECTED','Authenticator verification failed. Check your factor and current code.',400);
  if(action==='discard')return{discarded:true};
  let data:Record<string,any>;try{data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{throw new DomainError('AUTH_UNAVAILABLE','The authenticator response was invalid.',503);}
  if(action==='list')return{factors:(Array.isArray(data.factors)?data.factors:[]).filter(f=>f&&typeof f==='object'&&f.factor_type==='totp'&&uuid.test(f.id)&&['verified','unverified'].includes(f.status)).map(f=>({id:f.id,status:f.status,friendly_name:typeof f.friendly_name==='string'?f.friendly_name.slice(0,80):'Authenticator'}))};
  if(action==='enroll'){if(typeof data.id!=='string'||!uuid.test(data.id)||!data.totp||typeof data.totp.secret!=='string'||!/^[A-Z2-7]{16,128}$/.test(data.totp.secret))throw new DomainError('AUTH_UNAVAILABLE','The authenticator setup response was invalid.',503);return{factorId:data.id,secret:data.totp.secret};}
  if(action==='challenge'){if(typeof data.id!=='string'||!uuid.test(data.id))throw new DomainError('AUTH_UNAVAILABLE','The authenticator challenge was invalid.',503);return{challengeId:data.id};}
  if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||!Number.isSafeInteger(data.expires_in)||data.expires_in<=0)throw new DomainError('AUTH_UNAVAILABLE','The authenticator session was invalid.',503);
  return{access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in};
 };
}
