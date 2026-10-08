import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { initialState, execute, DomainError } from './domain.ts';
import type { State, Command } from './domain.ts';
import { reconcile } from './recovery.ts';
import {claimClient,renewClient,releaseClient,revokeClient,assertClientLease} from './sessions.ts';
import type {ClientFence,DispatchContext} from './sessions.ts';
import {isAdminCommand} from './admin.ts';

export class WorldStore {
  #state: State;
  #file: string | null;
  #tail: Promise<unknown> = Promise.resolve();
  #requireConnection:boolean;
  private constructor(state: State, file: string | null,requireConnection:boolean) { this.#state = state; this.#file = file;this.#requireConnection=requireConnection; }
  static async open(file: string | null = null,options:{requireConnection?:boolean}={}) {
    let state = initialState();
    if (file) {
      try { state = JSON.parse(await readFile(file, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const record = (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value);
      if (!state || state.version !== 1 || typeof state.worldId !== 'string' || !record(state.commands) || !record(state.balances) || !record(state.citizens) || !record(state.npcSpend) || !Array.isArray(state.journals) || !Array.isArray(state.outbox) || Object.values(state.balances).some(amount => !Number.isSafeInteger(amount))) throw new Error('Unsupported or corrupt development state');
      reconcile(state);
    }
    return new WorldStore(state, file,options.requireConnection??false);
  }
  snapshot(actorId?:string,sessionId?:string) { this.#session(sessionId);return structuredClone(this.#state); }
  #session(sessionId?:string){if(sessionId&&this.#state.sessions?.revoked[sessionId])throw new DomainError('SESSION_REVOKED','Sign in again to continue.',401);}
  async #save(state:State){if(this.#file){await mkdir(dirname(this.#file),{recursive:true});const temporary=this.#file+'.tmp';await writeFile(temporary,JSON.stringify(state),{mode:0o600,flush:true});await rename(temporary,this.#file);}this.#state=state;}
  #clients<T>(actor:string,sessionId:string,edit:(s:State)=>T){const run=this.#tail.then(async()=>{this.#session(sessionId);const next=structuredClone(this.#state),result=edit(next);await this.#save(next);return result;});this.#tail=run.catch(()=>undefined);return run;}
  claimClient(actor:string,sessionId:string,clientId:unknown,takeover:unknown,now=Date.now()){return this.#clients(actor,sessionId,s=>claimClient(s,actor,sessionId,clientId,takeover,now));}
  renewClient(actor:string,sessionId:string,fence:ClientFence,now=Date.now()){return this.#clients(actor,sessionId,s=>renewClient(s,actor,sessionId,fence,now));}
  releaseClient(actor:string,sessionId:string,fence:ClientFence,now=Date.now()){return this.#clients(actor,sessionId,s=>releaseClient(s,actor,sessionId,fence,now));}
  revokeSession(actor:string,sessionId:string){const run=this.#tail.then(async()=>{const next=structuredClone(this.#state);revokeClient(next,actor,sessionId,Date.now());await this.#save(next);});this.#tail=run.catch(()=>undefined);return run;}
  async liveState(sessionIds:string[]=[]){return{state:this.snapshot(),revokedSessionIds:sessionIds.filter(id=>this.#state.sessions?.revoked[id])};}
  bootstrapStaff(actors:string[],reason:string,now=Date.now()){return this.dispatch('bootstrap-operator',{id:'bootstrap_staff_001',type:'BootstrapStaff',payload:{actors,reason}},now,undefined,{administration:{bootstrap:true}});}
  dispatch(actorId: string, command: Command, now: number=Date.now(),sessionId?:string,context?:DispatchContext) {
    const run = this.#tail.then(async () => {
      this.#session(sessionId);
      if(context?.administration?.session&&context.administration.session.sessionId!==sessionId)throw new DomainError('SESSION_MISMATCH','Staff verification must use the authenticated session.',401);
      const result = execute(this.#state, actorId, command, now,context?.administration);
      if(!result.replayed&&!isAdminCommand(command.type)&&(this.#requireConnection||context?.requireConnection))assertClientLease(this.#state,actorId,sessionId,context?.clientLease,now);
      if(!result.replayed)await this.#save(result.state);
      return { receipt: result.receipt, replayed: result.replayed };
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
}
