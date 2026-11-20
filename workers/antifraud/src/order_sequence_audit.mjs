/* F02 migration preflight only. No Firestore/network/writes.
 * Caller must supply a complete, independently collected order listing.
 * Unsafe legacy counters are never silently corrected in production.
 */
const natural=n=>Number.isSafeInteger(n)&&n>=0;
export function auditOrderSequence({universe,v2State,orderRecords,control=null,listingComplete=false}={}){
 if(typeof universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(universe))
  throw Error("invalid_universe");
 if(listingComplete!==true||!Array.isArray(orderRecords))
  throw Error("incomplete_order_listing");
 const current=v2State?.data;
 const branch=current?.businessType===universe?current:current?.businessUniverses?.[universe];
 if(!branch||typeof branch!=="object")return Object.freeze({status:"blocked",reason:"universe_missing"});
 const metadataLast=branch.orderSequenceLast??0;
 if(!natural(metadataLast))
  return Object.freeze({status:"blocked",reason:"invalid_metadata_counter"});
 let highest=0,numbered=0,unnumbered=0,duplicate=0,invalid=0;
 const seenNumbers=new Set(),seenIDs=new Set();
 for(const wrapped of orderRecords){
  const record=wrapped?.record??wrapped;
  if(record?.group!=="orders"||record?.universe!==universe)continue;
  if(typeof record.id!=="string"||!record.id||seenIDs.has(record.id)){
   invalid++;continue;
  }
  seenIDs.add(record.id);
  const n=record.item?.orderNumber;
  if(n==null){unnumbered++;continue}
  if(!natural(n)||n===0){invalid++;continue}
  if(seenNumbers.has(n)){duplicate++;continue}
  seenNumbers.add(n);highest=Math.max(highest,n);numbered++;
 }
 if(invalid||duplicate)return Object.freeze({
  status:"blocked",reason:invalid?"invalid_or_repeated_order_ids":"duplicate_public_numbers",
  totals:{numbered,unnumbered,invalid,duplicate},metadataLast,highest
 });
 const proposedLast=Math.max(metadataLast,highest);
 if(control!==null){
  if(control?.version!==1||control?.universe!==universe||!natural(control.last)||
     control.last<proposedLast)
   return Object.freeze({status:"blocked",reason:"sequence_control_inconsistent",
    metadataLast,highest});
  return Object.freeze({status:"ready",action:"already_initialized",
   last:control.last,metadataLast,highest,numbered,unnumbered});
 }
 if(unnumbered>0||highest>metadataLast)
  return Object.freeze({status:"manual_review",
   reason:unnumbered?"historical_unnumbered_orders":"metadata_behind_orders",
   proposedLast,metadataLast,highest,numbered,unnumbered});
 return Object.freeze({status:"ready",action:"initialize_after_authorization",
  proposedLast,metadataLast,highest,numbered,unnumbered});
}
