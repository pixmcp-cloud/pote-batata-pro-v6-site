import fs from "node:fs";
import {serviceAccessToken} from "./src/auth.mjs";
const path=process.env.POTE_QA_KEYFILE;
if(!path)throw Error("POTE_QA_KEYFILE is required");
const key=JSON.parse(fs.readFileSync(path,"utf8"));
if(key.project_id!=="pote-batata-qa-worker"||
 key.client_email!=="pote-batata-worker-qa@pote-batata-qa-worker.iam.gserviceaccount.com")
 throw Error("QA identity mismatch");
const token=await serviceAccessToken({GCP_CLIENT_EMAIL:key.client_email,GCP_PRIVATE_KEY:key.private_key});
const url="https://firestore.googleapis.com/v1/projects/pote-batata-qa-worker/databases/(default)/documents?pageSize=1";
const response=await fetch(url,{headers:{Authorization:"Bearer "+token}});
console.log("QA_FIRESTORE_SERVICE_AUTH_HTTP",response.status);
if(!response.ok)process.exitCode=1;
