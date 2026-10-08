import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { execute, initialState, DomainError } from './domain.ts';
import type { State, Command } from './domain.ts';
import {claimClient,renewClient,releaseClient,revokeClient,assertClientLease} from './sessions.ts';
import type {ClientFence,DispatchContext} from './sessions.ts';
import {isAdminCommand} from './admin.ts';

export interface Sql {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database {
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
}

export function pooledDatabase(pool: Pool): Database {
  return { async transaction(work) {
    const client: PoolClient = await pool.connect();
    try { await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout = '10s'"); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } };
}

export class PostgresWorldStore {
  #database: Database;
  #world: string;
  #requireConnection:boolean;
  constructor(database: Database, world: string,options:{requireConnection?:boolean}={}) {
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(world)) throw new Error('Invalid world identifier');
    this.#database = database; this.#world = world;this.#requireConnection=options.requireConnection??false;
  }
  async #scope(sql: Sql, actorId = '') {
    await sql.query('SET LOCAL ROLE simulator_server');
    await sql.query("SELECT set_config('simulator.world_id', $1, true), set_config('simulator.actor_id', $2, true)", [this.#world, actorId]);
  }
  async revokeSession(actorId:string,sessionId:string){
    await this.#database.transaction(async sql=>{await this.#scope(sql,actorId);const row=await sql.query<{state:State}>("SELECT state FROM simulator.worlds WHERE id=$1 FOR UPDATE",[this.#world]);await sql.query('INSERT INTO simulator.revoked_sessions(world_id,session_id,reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[this.#world,sessionId,'Account signed out']);if(row.rows[0]){const previous=row.rows[0].state,next=structuredClone(previous);revokeClient(next,actorId,sessionId,Date.now());await this.#saveClients(sql,previous,next);}});
  }
  async #saveClients(sql:Sql,previous:State,next:State){for(const [actor,l] of Object.entries(next.sessions?.leases??{})){if(JSON.stringify(l)===JSON.stringify(previous.sessions?.leases[actor]))continue;await sql.query('INSERT INTO simulator.client_sessions(world_id,actor_id,data,epoch) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT(world_id,actor_id) DO UPDATE SET data=EXCLUDED.data,epoch=EXCLUDED.epoch',[this.#world,actor,JSON.stringify(l),l.epoch]);}await sql.query('UPDATE simulator.worlds SET state=$2::jsonb WHERE id=$1',[this.#world,JSON.stringify(next)]);}
  async #clients<T>(actor:string,sessionId:string,edit:(s:State)=>T){return this.#database.transaction(async sql=>{await this.#scope(sql,actor);await this.#session(sql,sessionId);const row=await sql.query<{state:State}>('SELECT state FROM simulator.worlds WHERE id=$1 FOR UPDATE',[this.#world]);if(!row.rows[0])throw new DomainError('WORLD_UNAVAILABLE','This world is unavailable.',503);const previous=row.rows[0].state,next=structuredClone(previous),result=edit(next);await this.#saveClients(sql,previous,next);return result;});}
  claimClient(actor:string,sessionId:string,clientId:unknown,takeover:unknown,now=Date.now()){return this.#clients(actor,sessionId,s=>claimClient(s,actor,sessionId,clientId,takeover,now));}
  renewClient(actor:string,sessionId:string,fence:ClientFence,now=Date.now()){return this.#clients(actor,sessionId,s=>renewClient(s,actor,sessionId,fence,now));}
  releaseClient(actor:string,sessionId:string,fence:ClientFence,now=Date.now()){return this.#clients(actor,sessionId,s=>releaseClient(s,actor,sessionId,fence,now));}
  async liveState(sessionIds:string[]=[]){return this.#database.transaction(async sql=>{
    await this.#scope(sql);const row=await sql.query<{state:State}>('SELECT state FROM simulator.worlds WHERE id=$1',[this.#world]);
    if(!row.rows[0])throw new DomainError('WORLD_UNAVAILABLE','This world is unavailable.',503);
    const state=row.rows[0].state,ids=[...new Set([...sessionIds,...Object.values(state.sessions?.leases??{}).filter(l=>l.status==='active').map(l=>l.sessionId)])];
    const revoked=await sql.query<{session_id:string}>('SELECT session_id FROM simulator.revoked_sessions WHERE world_id=$1 AND session_id=ANY($2::text[])',[this.#world,ids]),revokedIds=new Set(revoked.rows.map(r=>r.session_id));
    // Emergency revocation also hides a peer whose HTTP/socket is not currently connected.
    for(const lease of Object.values(state.sessions?.leases??{}))if(revokedIds.has(lease.sessionId))lease.status='released';
    return{state,revokedSessionIds:[...revokedIds]};
  });}
  async createWorld() {
    return this.#database.transaction(async sql => {
      await this.#scope(sql);
      const state = { ...initialState(), worldId: this.#world };
      await sql.query('INSERT INTO simulator.worlds(id, state) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING', [this.#world, JSON.stringify(state)]);
    });
  }
  async #session(sql: Sql, sessionId?: string) {
    if (!sessionId) return;
    const revoked = await sql.query('SELECT 1 FROM simulator.revoked_sessions WHERE world_id = $1 AND session_id = $2', [this.#world, sessionId]);
    if (revoked.rows.length) throw new DomainError('SESSION_REVOKED', 'Sign in again to continue.', 401);
  }
  async snapshot(actorId = '', sessionId?: string) {
    return this.#database.transaction(async sql => {
      await this.#scope(sql, actorId);
      await this.#session(sql, sessionId);
      const result = await sql.query<{ state: State }>('SELECT state FROM simulator.worlds WHERE id = $1', [this.#world]);
      if (!result.rows[0]) throw new DomainError('WORLD_UNAVAILABLE', 'This world is unavailable.', 503);
      return result.rows[0].state;
    });
  }
  bootstrapStaff(actors:string[],reason:string,now=Date.now()){return this.dispatch('bootstrap-operator',{id:'bootstrap_staff_001',type:'BootstrapStaff',payload:{actors,reason}},now,undefined,{administration:{bootstrap:true}});}
  async dispatch(actorId: string, command: Command, now?: number, sessionId?: string,context?:DispatchContext) {
    if(context?.administration?.session&&context.administration.session.sessionId!==sessionId)throw new DomainError('SESSION_MISMATCH','Staff verification must use the authenticated session.',401);
    return this.#database.transaction(async sql => {
      await this.#scope(sql, actorId);
      await this.#session(sql, sessionId);
      // One world lock protects all cross-aggregate invariants in this first adapter.
      // This is a correctness baseline; capacity must pass before splitting aggregate locks.
      const row = await sql.query<{ state: State; revision: number; now: string }>("SELECT state, revision, floor(extract(epoch FROM clock_timestamp()) * 1000)::text AS now FROM simulator.worlds WHERE id = $1 FOR UPDATE", [this.#world]);
      if (!row.rows[0]) throw new DomainError('WORLD_UNAVAILABLE', 'This world is unavailable.', 503);
      const original = row.rows[0].state, time = now ?? Number(row.rows[0].now);
      const result = execute(original, actorId, command, time,context?.administration);
      if (result.replayed) return { receipt: result.receipt, replayed: true, revision: row.rows[0].revision };
      if(!isAdminCommand(command.type)&&(this.#requireConnection||context?.requireConnection))assertClientLease(original,actorId,sessionId,context?.clientLease,time);
      if (command.expectedVersion !== undefined && (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion !== row.rows[0].revision)) throw new DomainError('STALE_VERSION', 'This record changed. Refresh and review the action again.', 409);
      const revision = row.rows[0].revision + 1;
      if (!Number.isSafeInteger(revision)) throw new Error('Revision overflow');
      for (const [actor, citizen] of Object.entries(result.state.citizens)) {
        if (JSON.stringify(citizen) === JSON.stringify(original.citizens[actor])) continue;
        await sql.query('INSERT INTO simulator.citizens(world_id, actor_id, citizen_id, data, version) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT(world_id, actor_id) DO UPDATE SET data=EXCLUDED.data, version=EXCLUDED.version', [this.#world, actor, citizen.id, JSON.stringify(citizen), revision]);
      }
      for (const [account, balance] of Object.entries(result.state.balances)) {
        if (original.balances[account] === balance) continue;
        await sql.query('INSERT INTO simulator.accounts(world_id, id, balance) VALUES ($1,$2,$3) ON CONFLICT(world_id,id) DO UPDATE SET balance=EXCLUDED.balance', [this.#world, account, balance]);
      }
      for(const [id,h] of Object.entries(result.state.life?.households??{})){
        if(JSON.stringify(h)===JSON.stringify(original.life?.households[id]))continue;
        await sql.query('INSERT INTO simulator.households(world_id,id,kind,data,version) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT(world_id,id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=clock_timestamp()',[this.#world,id,h.kind,JSON.stringify(h),h.version]);
      }
      for(const [id,i] of Object.entries(result.state.life?.invitations??{})){
        if(JSON.stringify(i)===JSON.stringify(original.life?.invitations[id]))continue;
        await sql.query('INSERT INTO simulator.household_invitations(world_id,id,household_id,recipient,data) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT(world_id,id) DO UPDATE SET data=EXCLUDED.data',[this.#world,id,i.householdId,i.recipient,JSON.stringify(i)]);
      }
      for (const journal of result.state.journals.slice(original.journals.length)) {
        await sql.query('INSERT INTO simulator.journals(world_id,id,occurred_at,reason) VALUES ($1,$2,$3,$4)', [this.#world, journal.id, new Date(journal.at), journal.reason]);
        for (const [index, entry] of journal.entries.entries()) await sql.query('INSERT INTO simulator.journal_lines(world_id,journal_id,line,id,amount) VALUES ($1,$2,$3,$4,$5)', [this.#world, journal.id, index, entry.account, entry.amount]);
      }
      for (const [id,shift] of Object.entries(result.state.life?.work?.shifts??{})) {
        if (JSON.stringify(shift)===JSON.stringify(original.life?.work?.shifts[id])) continue;
        await sql.query('INSERT INTO simulator.work_shifts(world_id,id,actor_id,status,data,version) VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(world_id,id) DO UPDATE SET status=EXCLUDED.status,data=EXCLUDED.data,version=EXCLUDED.version',[this.#world,id,shift.actorId,shift.status,JSON.stringify(shift),shift.version]);
      }
      for(const [id,grant] of Object.entries(result.state.administration?.grants??{})){
        if(JSON.stringify(grant)===JSON.stringify(original.administration?.grants[id]))continue;
        await sql.query('INSERT INTO simulator.staff_grants(world_id,id,actor_id,data,version) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(world_id,id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version',[this.#world,id,grant.actor,JSON.stringify(grant),grant.version]);
      }
      for(const [id,proposal] of Object.entries(result.state.administration?.proposals??{})){
        if(JSON.stringify(proposal)===JSON.stringify(original.administration?.proposals[id]))continue;
        await sql.query('INSERT INTO simulator.staff_proposals(world_id,id,data,version) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(world_id,id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version',[this.#world,id,JSON.stringify(proposal),proposal.version]);
      }
      for(const record of result.state.administration?.audit.slice(original.administration?.audit.length??0)??[]){
        await sql.query('INSERT INTO simulator.staff_audit(world_id,sequence,actor_id,command_id,data) VALUES($1,$2,$3,$4,$5::jsonb)',[this.#world,record.sequence,record.actor,record.commandKey.slice(record.actor.length+1),JSON.stringify(record)]);
      }
      const records=(state:State)=>({
        'social.relationship':state.relationships?.records??{},'furnishing.home':state.furnishing?.homes??{},'furnishing.item':state.furnishing?.items??{},'furnishing.parking':state.furnishing?.parking??{},'furnishing.visit':state.furnishing?.visits??{},
        'world.position':state.world?.positions??{}, 'world.trip':state.world?.trips??{},
        'education.foundation':state.education?.foundation??{}, 'education.enrolment':state.education?.enrolments??{},
        'education.scholarship':state.education?.scholarships??{}, 'education.licence':state.education?.licences??{}
        ,'commerce.company':state.commerce?.companies??{},'commerce.batch':state.commerce?.batches??{},'governance.action':state.governance?.actions??{},
        'commerce.listing':state.commerce?.listings??{},'commerce.quote':state.commerce?.quotes??{},
        'commerce.order':state.commerce?.orders??{},'commerce.production':state.commerce?.production??{},
        'commerce.review':state.commerce?.reviews??{},'commerce.role-invitation':state.commerce?.invites??{}
        ,'employment.vacancy':state.employment?.vacancies??{},'employment.application':state.employment?.applications??{},
        'employment.contract':state.employment?.contracts??{},'employment.shift':state.employment?.shifts??{},
        'education.school':state.education?.schools??{},'education.mentorship':state.education?.mentorships??{},'education.practice-session':state.education?.practiceSessions??{},
        'insurance.provider':state.insurance?.providers??{},'insurance.policy':state.insurance?.policies??{},'insurance.claim':state.insurance?.claims??{},
        'incident.record':state.incidents?.records??{},
        'healthcare.hospital':state.healthcare?.hospitals??{},'healthcare.case':state.healthcare?.cases??{},
        'mobility.vehicle':state.mobility?.vehicles??{},'mobility.invitation':state.mobility?.invites??{},'mobility.sale':state.mobility?.sales??{},'mobility.repair':state.mobility?.repairs??{},
        'property.asset':state.property?.assets??{},'property.sale':state.property?.sales??{},'property.purchase':state.property?.purchases??{},'property.rental':state.property?.rentals??{},'property.tenancy':state.property?.tenancies??{},'property.build':state.property?.builds??{},'property.inspection':state.property?.inspections??{},
        'finance.institution':state.finance?.institutions??{},'finance.savings':state.finance?.savings??{},'finance.loan':state.finance?.loans??{}
      });
      const before=records(original);
      for(const [domain,items] of Object.entries(records(result.state))) for(const [id,data] of Object.entries(items)){
        if(JSON.stringify(data)===JSON.stringify((before[domain as keyof typeof before] as Record<string,unknown>)[id]))continue;
        await sql.query('INSERT INTO simulator.domain_records(world_id,domain,id,data,version) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT(world_id,domain,id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=clock_timestamp()',[this.#world,domain,id,JSON.stringify(data),revision]);
      }
      for(const [id,quantity] of Object.entries(result.state.commerce?.stock?.balances??{})){
        if(original.commerce?.stock?.balances[id]===quantity)continue;const split=id.indexOf(':'),goods=id.slice(0,split),account=id.slice(split+1);
        await sql.query('INSERT INTO simulator.stock_accounts(world_id,goods,id,quantity) VALUES ($1,$2,$3,$4) ON CONFLICT(world_id,goods,id) DO UPDATE SET quantity=EXCLUDED.quantity',[this.#world,goods,account,quantity]);
      }
      for(const j of result.state.commerce?.stock?.journals.slice(original.commerce?.stock?.journals.length??0)??[]){
        await sql.query('INSERT INTO simulator.stock_journals(world_id,id,goods,occurred_at,reason,entries) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',[this.#world,j.id,j.goods,new Date(j.at),j.reason,JSON.stringify(j.entries)]);
      }
      const key = `${actorId}:${command.id}`, stored = result.state.commands[key];
      await sql.query('INSERT INTO simulator.commands(world_id,actor_id,id,fingerprint,receipt,revision) VALUES ($1,$2,$3,$4,$5::jsonb,$6)', [this.#world, actorId, command.id, stored.fingerprint, JSON.stringify(result.receipt), revision]);
      for (const event of result.state.outbox.slice(original.outbox.length)) await sql.query('INSERT INTO simulator.outbox(world_id,id,actor_id,type,occurred_at,payload,aggregate_version) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)', [this.#world, event.id, event.actorId, event.type, new Date(event.at), JSON.stringify(event.payload), revision]);
      await sql.query('UPDATE simulator.worlds SET state=$2::jsonb, revision=$3, updated_at=clock_timestamp() WHERE id=$1', [this.#world, JSON.stringify(result.state), revision]);
      return { receipt: result.receipt, replayed: false, revision };
    });
  }
  async events(after: number, limit = 100) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new DomainError('INVALID_CURSOR', 'Use a valid event cursor.', 400);
    return this.#database.transaction(async sql => { await this.#scope(sql); return (await sql.query('SELECT sequence, id, type, aggregate_version FROM simulator.outbox WHERE world_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3', [this.#world, after, limit])).rows; });
  }
}
