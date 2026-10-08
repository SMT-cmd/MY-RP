import {mkdir,mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function temporaryFolder(prefix:string){const base=fileURLToPath(new URL('../.test-data/',import.meta.url));await mkdir(base,{recursive:true});return mkdtemp(base+prefix);}
