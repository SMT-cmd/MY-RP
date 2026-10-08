import type {State} from './domain.ts';
export type StockJournal={id:string;goods:string;at:number;reason:string;entries:{account:string;quantity:number}[]};
export type StockState={balances:Record<string,number>;journals:StockJournal[]};
export function stockPost(state:State,journal:StockJournal){
 journal={...journal,entries:journal.entries.filter(e=>e.quantity!==0)};if(!journal.entries.length)return;
 if(!state.commerce)throw new Error('Inventory subsystem not initialised');const stock=state.commerce.stock??={balances:{},journals:[]};
 if(stock.journals.some(j=>j.id===journal.id)||journal.entries.length<2||journal.entries.some(e=>!Number.isSafeInteger(e.quantity))||journal.entries.reduce((n,e)=>n+BigInt(e.quantity),0n)!==0n)throw new Error('Invalid stock journal');
 const next={...stock.balances};for(const entry of journal.entries){const id=journal.goods+':'+entry.account,value=(next[id]??0)+entry.quantity;if(!Number.isSafeInteger(value)||(!entry.account.startsWith('system:')&&value<0))throw new Error('Invalid inventory quantity');next[id]=value;}
 stock.balances=next;stock.journals.push(journal);
}
export function reconcileStock(state:State){
 const m=state.commerce;if(!m?.stock){if(m&&Object.keys(m.batches).length)throw new Error('Inventory journals are missing');return;}
 const totals=new Map<string,number>(),ids=new Set<string>();for(const j of m.stock.journals){if(ids.has(j.id)||j.entries.length<2||j.entries.reduce((n,e)=>n+BigInt(e.quantity),0n)!==0n)throw new Error('Stock journal mismatch');ids.add(j.id);for(const e of j.entries){if(!Number.isSafeInteger(e.quantity))throw new Error('Stock amount mismatch');const key=j.goods+':'+e.account;totals.set(key,(totals.get(key)??0)+e.quantity);}}
 for(const key of new Set([...totals.keys(),...Object.keys(m.stock.balances)]))if(!Number.isSafeInteger(m.stock.balances[key])||m.stock.balances[key]!==totals.get(key)||(!key.slice(key.indexOf(':')+1).startsWith('system:')&&m.stock.balances[key]<0))throw new Error('Stock balance mismatch');
 for(const b of Object.values(m.batches))if(!Number.isSafeInteger(b.quantity)||b.quantity<0||b.quantity!==(m.stock.balances[b.goods+':batch:'+b.id]??0))throw new Error('Batch reconciliation mismatch');
 for(const l of Object.values(m.listings)){const goods=m.batches[l.batch]?.goods;if(!goods||l.remaining!==(m.stock.balances[goods+':listing:'+l.id]??0))throw new Error('Listing reconciliation mismatch');}
 for(const o of Object.values(m.orders)){const expected=['accepted','cancelled','refunded'].includes(o.status)?0:o.quantity;if(expected!==(m.stock.balances[o.goods+':order:'+o.id]??0))throw new Error('Order custody reconciliation mismatch');}
 for(const c of Object.values(m.companies))if(Object.values(c.shares).some(x=>!Number.isSafeInteger(x)||x<1)||Object.values(c.shares).reduce((n,x)=>n+x,0)!==(c.issuedShares??100000))throw new Error('Company cap table does not reconcile');
}
