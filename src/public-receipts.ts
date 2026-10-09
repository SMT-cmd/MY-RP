import type {State,Receipt} from './domain.ts';
import {publicHomeVisitReceipt} from './home-visits.ts';
import {publicRelationshipReceipt} from './relationships.ts';
export const publicCitizenReceipt=(s:State,r:Receipt)=>publicRelationshipReceipt(s,publicHomeVisitReceipt(s,r));
