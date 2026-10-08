// Offline operator setup. No HTTP endpoint, automatic launch action or client-supplied role.
import {Pool} from 'pg';
import {PostgresWorldStore,pooledDatabase} from '../src/postgres.ts';
import {reconcile} from '../src/recovery.ts';
const args=process.argv.slice(2),apply=args[0]==='--apply';if(apply)args.shift();
const [first,second,reason]=args;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if(args.length!==3||!uuid.test(first??'')||!uuid.test(second??'')||first.toLowerCase()===second.toLowerCase()||reason.trim().length<10||reason.trim().length>400)throw Error('Usage: node scripts/bootstrap-staff.ts [--apply] <first-auth-uuid> <second-auth-uuid> <10–400 character reason>');
const required=(name:string)=>{const value=process.env[name];if(!value)throw Error(name+' is required');return value;};
const actors=[first.toLowerCase(),second.toLowerCase()],databaseUrl=required('DATABASE_URL');
let url:URL;try{url=new URL(databaseUrl);}catch{throw Error('Use a valid private PostgreSQL connection URL.');}
if(!['postgres:','postgresql:'].includes(url.protocol)||[...url.searchParams.keys()].some(k=>k.toLowerCase().startsWith('ssl')))throw Error('Use a PostgreSQL URL with TLS controlled by the validated server settings.');
const pool=new Pool({connectionString:databaseUrl,max:1,connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT}:{})}});
try{
 // Operator DB access verifies the identities before the game store assumes its restricted role.
 const users=await pool.query("SELECT id FROM auth.users WHERE id=ANY($1::uuid[]) AND COALESCE(is_anonymous,false)=false AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) AND (email_confirmed_at IS NOT NULL OR phone_confirmed_at IS NOT NULL)",[actors]);
 if(users.rows.length!==2)throw Error('Both accounts must exist, be confirmed and be eligible registered Auth users.');
 const store=new PostgresWorldStore(pooledDatabase(pool),required('WORLD_ID')),before=await store.snapshot();reconcile(before);
 if(before.administration)throw Error('Initial staff authority already exists. Use independently approved staff changes.');
 console.log(JSON.stringify({worldId:before.worldId,actors,roles:['super'],scope:'world',reason:reason.trim(),applied:false}));
 if(apply){const result=await store.bootstrapStaff(actors,reason.trim());reconcile(await store.snapshot());console.log(JSON.stringify({applied:true,commandId:result.receipt.commandId,at:result.receipt.at}));}
}catch(error){
 // Connection errors may contain credentials. Output only controlled operator instructions.
 if(error instanceof Error&&/^(Both accounts|Initial staff|WORLD_ID|Use a PostgreSQL|Invalid world|This world)/.test(error.message))console.error(error.message);
 else console.error('Staff setup failed. Check the private database connection, migrations and operator permissions. No credentials are printed.');
 process.exitCode=1;
}finally{await pool.end();}
