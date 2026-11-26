// B02.9 — share the existing V5 counter for one business universe.
// No independent online counter can override this high-water mark.
// Cross-universe/global uniqueness requires migration of every legacy writer.
const fail=code=>{throw Object.assign(Error(code),{code})};
const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=9999999;
function branch(meta,universe){
 const d=meta?.state?.data;
 if(!d||typeof universe!=="string"||!universe||!["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria","default"].includes(universe))fail("sequence_not_ready");
 const b=d.businessType===universe?d:d.businessUniverses?.[universe];
 if(!b||!valid(b.orderSequenceLast??0))fail("sequence_not_ready");
 return b;
}
export function v5SequenceBaseline(meta,universe,onlineLast){
 const b=branch(meta,universe);if(!valid(onlineLast))fail("sequence_not_ready");
 const n=Math.max(b.orderSequenceLast??0,onlineLast);
 if(n>=9999999)fail("sequence_exhausted");
 return n;
}
export function advanceV5Sequence(meta,universe,onlineLast,next){
 if(next!==v5SequenceBaseline(meta,universe,onlineLast)+1)fail("sequence_conflict");
 const copy=JSON.parse(JSON.stringify(meta));branch(copy,universe).orderSequenceLast=next;
 return copy;
}
