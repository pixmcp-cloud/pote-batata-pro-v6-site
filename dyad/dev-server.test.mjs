import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createLabServer} from "./dev-server.mjs";
let dir,server,origin;
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),"pote-dyad-qa-"));
 await mkdir(join(dir,"assets"));
 await writeFile(join(dir,"index.html"),"<html><title>Potê Batata Pro</title><body>LAB</body></html>");
 await writeFile(join(dir,"assets","test.js"),"console.log('readonly');");
 server=createLabServer({root:dir});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 origin="http://127.0.0.1:"+server.address().port;
});
after(async()=>{
 if(server) await new Promise(resolve=>server.close(resolve));
 if(dir) await rm(dir,{recursive:true,force:true});
});
test("loads original HTML with strict offline CSP",async()=>{
 const r=await fetch(origin+"/");
 assert.equal(r.status,200);
 assert.equal(r.headers.get("X-Pote-Lab"),"readonly-offline");
 assert.match(r.headers.get("Content-Security-Policy"),/connect-src 'self'/);
 assert.match(r.headers.get("Content-Security-Policy"),/form-action 'self'/);
 assert.match(r.headers.get("Cache-Control"),/no-store/);
 assert.match(await r.text(),/Potê Batata Pro/);
});
test("supports JS assets with correct MIME",async()=>{
 const r=await fetch(origin+"/assets/test.js");
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-type"),/javascript/);
 assert.match(await r.text(),/readonly/);
});
test("rejects every write HTTP method",async()=>{
 for(const method of ["POST","PUT","PATCH","DELETE"]){
  const r=await fetch(origin+"/",{method,body:"x"});
  assert.equal(r.status,405,method);
  assert.match(r.headers.get("X-Pote-Lab"),/readonly-offline/);
 }
});
test("refuses internal dotfiles and unknown assets",async()=>{
 assert.equal((await fetch(origin+"/.env")).status,403);
 assert.equal((await fetch(origin+"/missing.js")).status,404);
});
test("shows non-sensitive health telemetry",async()=>{
 const r=await fetch(origin+"/__lab/health");
 assert.equal(r.status,200);
 const body=await r.json();
 assert.deepEqual(body,{ok:true,preview:"Potê Batata Pro",readonly:true,firebaseWrites:false});
});
test("HEAD request does not expose body",async()=>{
 const r=await fetch(origin+"/",{method:"HEAD"});
 assert.equal(r.status,200);
 assert.equal((await r.text()).length,0);
});
test("rejects DNS rebinding host headers",async()=>{
 const {request}=await import("node:http");
 const port=Number(new URL(origin).port);
 const status=await new Promise((resolve,reject)=>{
  const req=request({hostname:"127.0.0.1",port,path:"/",headers:{host:"evil.example"}},res=>{
   res.resume();
   resolve(res.statusCode);
  });
  req.on("error",reject);
  req.end();
 });
 assert.equal(status,403);
});
