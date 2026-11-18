import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=file=>readFileSync(file,"utf8");
for(const file of ["firestore.rules","firestore.hardened.rules"]){
 const src=text(file);
 assert(src.includes("request.auth.token.potebatataAdmin == true"),
  "Server must require an Auth custom claim, not only Google email: "+file);
 assert(src.includes("request.auth.token.email == 'pixmcp@gmail.com'"),
  "Existing authorized admin account must remain pinned by email: "+file);
 assert(src.includes("request.auth.token.email_verified == true"),
  "Only Google verified accounts may access admin");
}
for(const file of ["firebase_integration.js","admin_console.js",
 "admin_permissions.js","admin_broadcast.js"]){
 assert(text(file).includes("potebatataAdmin === true")||
  text(file).includes("potebatataAdmin!==true"),
 "Client's admin UI must check verified custom claim: "+file);
}
const beta=text("make_beta.py");
for(const file of ["firebase_integration.js","admin_console.js",
 "admin_permissions.js","admin_broadcast.js"]){
 assert(beta.includes(file+"?v="+(file==="firebase_integration.js"?"f10-verified-migration-20261118":file==="admin_console.js"?"franchise-report-20261118":"f24-admin-claim-20261118")),
  "Client must request fresh admin auth module: "+file);
}
console.log("PASS F24: server + all admin screens require signed custom claim and verified Google identity.");
