// Read-only verification of one live synthetic F05 adjustment in isolated Firebase QA.
// No user identity tokens or private keys are logged; requires a local QA JSON key path.
import assert from "node:assert/strict";
import fs from "node:fs";
import {serviceAccessToken} from "./src/auth.mjs";
import {decodeFields} from "./src/firestore.mjs";
import {recordPath} from "./src/domain.mjs";
const project="pote-batata-qa-worker";
const uid="5wiBJ9bnI3VWozBC7vP8wcOZlOV2";
const operationId="f05-qa-live-20261120-stock00001";
const keyFile=process.env.POTE_QA_KEYFILE;
assert(keyFile,"Set POTE_QA_KEYFILE to local QA service-account JSON");
const key=JSON.parse(fs.readFileSync(keyFile,"utf8"));
assert.equal(key.project_id,project,"Wrong project");
assert.equal(key.client_email,"pote-batata-worker-qa@pote-batata-qa-worker.iam.gserviceaccount.com","Wrong service account");
const access=await serviceAccessToken({GCP_CLIENT_EMAIL:key.client_email,GCP_PRIVATE_KEY:key.private_key});
const base="https://firestore.googleapis.com/v1/projects/"+project+"/databases/(default)/documents/";
async function read(path){
 const r=await fetch(base+path,{headers:{Authorization:"Bearer "+access}});
 if(!r.ok)throw Error("QA READ failed HTTP "+r.status+" for "+path.split("/").slice(-2).join("/"));
 return decodeFields((await r.json()).fields);
}
const root="users/"+uid;
const item=await read(recordPath(uid,"qa","ingredients","potato"));
const loss=await read(recordPath(uid,"qa","losses","cf-loss-"+operationId));
const movement=await read(recordPath(uid,"qa","stockMovements","cf-adjust-"+operationId));
const event=await read(root+"/workerEvents/"+operationId);
const guard=await read(root+"/appState/v2InventoryGuard");
const pulse=await read(root+"/appState/v2Pulse");
assert.equal(item.record.item.stock,93,"Unexpected balance");
assert.equal(loss.record.item.quantityBase,7,"Unexpected loss quantity");
assert.equal(loss.record.item.previousStock,100,"Unexpected prior balance");
assert.equal(loss.record.item.afterStock,93,"Unexpected final balance");
assert.equal(movement.record.item.quantity,-7,"Unexpected movement quantity");
assert.equal(movement.record.item.afterStock,93,"Unexpected movement balance");
assert.equal(event.resultingStock,93,"Unexpected journal result");
assert.equal(event.operationId,operationId,"Unexpected journal ID");
assert.equal(guard.revision,2,"Unexpected inventory revision");
assert.equal(pulse.eventId,"cf-"+operationId,"Unexpected V2 pulse event");
console.log(JSON.stringify({status:"PASS",project,stockBefore:100,loss:7,stockAfter:93,lossDocument:true,movementDocument:true,idempotencyJournal:true,guardRevision:guard.revision,pulseMatched:true}));
