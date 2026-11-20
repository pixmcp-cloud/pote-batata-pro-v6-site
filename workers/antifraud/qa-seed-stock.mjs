import fs from "node:fs";
import {serviceAccessToken} from "./src/auth.mjs";
import {encodeFields,decodeFields} from "./src/firestore.mjs";
import {recordPath} from "./src/domain.mjs";
const uid=process.env.POTE_QA_UID,keyfile=process.env.POTE_QA_KEYFILE;
if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(uid||"")||!keyfile)throw Error("QA UID and local key file required");
const key=JSON.parse(fs.readFileSync(keyfile,"utf8"));
if(key.project_id!=="pote-batata-qa-worker"||key.client_email!=="pote-batata-worker-qa@pote-batata-qa-worker.iam.gserviceaccount.com")throw Error("Wrong service identity");
const token=await serviceAccessToken({GCP_CLIENT_EMAIL:key.client_email,GCP_PRIVATE_KEY:key.private_key});
const base="https://firestore.googleapis.com/v1/projects/pote-batata-qa-worker/databases/(default)/documents/";
const root="users/"+uid,stock=recordPath(uid,"qa","ingredients","potato");
async function get(path){const r=await fetch(base+path,{headers:{Authorization:"Bearer "+token}});if(r.status===404)return null;if(!r.ok)throw Error("read "+path+" HTTP "+r.status);return decodeFields((await r.json()).fields)}
async function put(path,data){if(await get(path))throw Error("Fixture already exists: "+path+"; refusing overwrite");const r=await fetch(base+path,{method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({fields:encodeFields(data),name:"projects/pote-batata-qa-worker/databases/(default)/documents/"+path})});if(!r.ok)throw Error("seed "+path+" HTTP "+r.status);console.log("Created synthetic QA document:",path.split("/").slice(-2).join("/"))}
const paths=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",stock];
if(process.env.POTE_QA_REPAIR==="1") {
 const old=recordPath(uid,"qa","potato");
 const wrong=await get(old);
 if(!wrong?.record||wrong.record.item?.name!=="Batata QA"||wrong.record.item?.stock!==100||await get(stock))throw Error("Repair preconditions failed");
 const r=await fetch(base+old,{method:"DELETE",headers:{Authorization:"Bearer "+token}});if(!r.ok)throw Error("Delete wrong QA fixture failed HTTP "+r.status);
 await put(stock,wrong);console.log("QA_FIXTURE_PATH_REPAIRED");process.exit(0);
}
for(const p of paths)if(await get(p))throw Error("QA fixture conflict at "+p+"; no changes made");
await put(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
await put(root+"/appState/v2",{schemaVersion:2});
await put(root+"/appState/v2InventoryGuard",{revision:1});
await put(root+"/appState/v2Pulse",{eventId:"seed"});
await put(stock,{record:{id:"potato",group:"ingredients",universe:"qa",item:{name:"Batata QA",stock:100,measureUnit:"g",averageUnitCost:0.01,averageCostKnown:true}}});
console.log("QA_SYNTHETIC_STOCK_READY=100g");
