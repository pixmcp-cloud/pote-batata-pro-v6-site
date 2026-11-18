import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
import {FirestoreError} from "../src/firestore.mjs";
const token="q".repeat(40);
const env={ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"true",
 FIREBASE_PROJECT_ID:"demo-asaas-qa",ASAAS_WEBHOOK_ENABLED:"true",
 ASAAS_MODE:"sandbox",ASAAS_WEBHOOK_TOKEN:token};
const event=(id="evt_sandbox_0001",value=39.9)=>({id,event:"PAYMENT_RECEIVED",
 payment:{id:"pay_sandbox1",subscription:"sub_sandbox1",value}});
class DB{
 constructor(){this.docs=new Map();this.seq=0}
 transaction(){
  const db=this;
  return {
   async get(path){return db.docs.has(path)?structuredClone(db.docs.get(path)):null},
   async commit(writes){
    for(const w of writes){
     if(w.precondition.exists===false&&db.docs.has(w.path))
      throw new FirestoreError(409,"ALREADY_EXISTS");
    }
    for(const w of writes)db.docs.set(w.path,{data:structuredClone(w.data),updateTime:"v"+(++db.seq)});
   },
   async rollback(){}
  };
 }
}
const request=(payload=event(),headers={},route="/v1/asaas/webhook")=>
 new Request("https://example.test"+route,{method:"POST",
 headers:{"content-type":"application/json","asaas-access-token":token,...headers},
 body:JSON.stringify(payload)});
const app=db=>createWorkerApp({repository:()=>db,clock:()=>new Date("2026-11-18T20:00:00Z")});
test("Asaas inbox persists once; replay is idempotent and does not grant PRO",async()=>{
 const db=new DB(),worker=app(db);
 const first=await worker.fetch(request(),env);
 assert.equal(first.status,200);
 assert.equal((await first.json()).alreadyReceived,false);
 const again=await worker.fetch(request(),env);
 assert.equal(again.status,200);
 assert.equal((await again.json()).alreadyReceived,true);
 assert.equal(db.docs.size,1);
 const stored=[...db.docs.values()][0].data;
 assert.equal(stored.disposition,"pending_server_verification");
 assert.equal(stored.licenseGranted,false);
 assert.equal(stored.bankReconciled,false);
 assert.equal(stored.amountCents,3990);
 assert.equal(Object.keys(stored).some(k=>k==="license"),false);
});
test("Asaas webhook is disabled without explicit gates",async()=>{
 const db=new DB(),worker=app(db);
 for(const change of [{ASAAS_WEBHOOK_ENABLED:"false"},{ASAAS_MODE:"off"},
  {ENABLE_WRITES:"false"},{PRODUCTION_CUTOVER_APPROVED:"false"}]){
  assert.equal((await worker.fetch(request(),{...env,...change})).status,423);
 }
 assert.equal(db.docs.size,0);
});
test("Asaas webhook rejects wrong token and malformed payload without writes",async()=>{
 const db=new DB(),worker=app(db);
 assert.equal((await worker.fetch(request(event(),{"asaas-access-token":"invalid"}),env)).status,401);
 assert.equal((await worker.fetch(request({id:"bad"}),env)).status,400);
 assert.equal((await worker.fetch(request(event(),{"content-type":"text/plain"}),env)).status,415);
 assert.equal(db.docs.size,0);
});
test("Asaas event collision is rejected without overwriting ledger",async()=>{
 const db=new DB(),worker=app(db);
 assert.equal((await worker.fetch(request(),env)).status,200);
 assert.equal((await worker.fetch(request(event("evt_sandbox_0001",49.9)),env)).status,409);
 assert.equal(db.docs.size,1);
 assert.equal([...db.docs.values()][0].data.amountCents,3990);
});
test("Asaas unknown event is stored as ignored, never grants license",async()=>{
 const db=new DB(),worker=app(db);
 assert.equal((await worker.fetch(request({id:"evt_sandbox_0002",event:"PAYMENT_FAKE"}),env)).status,200);
 const record=[...db.docs.values()][0].data;
 assert.equal(record.disposition,"ignored");
 assert.equal(record.licenseGranted,false);
});
