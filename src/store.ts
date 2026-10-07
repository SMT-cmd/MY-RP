import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { initialState, execute } from './domain.ts';
import type { State, Command } from './domain.ts';

export class WorldStore {
  #state: State;
  #file: string | null;
  #tail: Promise<unknown> = Promise.resolve();
  private constructor(state: State, file: string | null) { this.#state = state; this.#file = file; }
  static async open(file: string | null = null) {
    let state = initialState();
    if (file) {
      try { state = JSON.parse(await readFile(file, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const record = (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value);
      if (!state || state.version !== 1 || typeof state.worldId !== 'string' || !record(state.commands) || !record(state.balances) || !record(state.citizens) || !record(state.npcSpend) || !Array.isArray(state.journals) || !Array.isArray(state.outbox) || Object.values(state.balances).some(amount => !Number.isSafeInteger(amount))) throw new Error('Unsupported or corrupt development state');
    }
    return new WorldStore(state, file);
  }
  snapshot() { return structuredClone(this.#state); }
  dispatch(actorId: string, command: Command, now: number) {
    const run = this.#tail.then(async () => {
      const result = execute(this.#state, actorId, command, now);
      if (!result.replayed && this.#file) {
        await mkdir(dirname(this.#file), { recursive: true });
        const temporary = `${this.#file}.tmp`;
        await writeFile(temporary, JSON.stringify(result.state), { mode: 0o600, flush: true });
        await rename(temporary, this.#file);
      }
      this.#state = result.state;
      return { receipt: result.receipt, replayed: result.replayed };
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
}
