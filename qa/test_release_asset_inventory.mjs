import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {inventory} from "./release_asset_inventory.mjs";

test("F21 manifest records hashes, references and external hosts",async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pote-assets-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,"assets"));
 await writeFile(path.join(root,"index.html"),
  '<link href="assets/style.css" rel="stylesheet"><script src="assets/app.js"></script>'+
  '<script src="https://www.gstatic.com/firebasejs/x.js"></script>');
 await writeFile(path.join(root,"assets/style.css"),'body{background:url("./logo.svg")}');
 await writeFile(path.join(root,"assets/logo.svg"),'<svg/>');
 await writeFile(path.join(root,"assets/app.js"),'import "./module.mjs";');
 await writeFile(path.join(root,"assets/module.mjs"),'export const done=true;');
 const good=await inventory(root);
 assert.equal(good.ok,true);
 assert.equal(good.fileCount,5);
 assert(good.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));
 assert.deepEqual(good.externalHosts,["www.gstatic.com"]);
 await writeFile(path.join(root,"assets/app.js"),
  'import "./module.mjs"; import "./not-found.mjs";');
 const broken=await inventory(root);
 assert.equal(broken.ok,false);
 assert(broken.missing.some(x=>x.to==="assets/not-found.mjs"));
 await writeFile(path.join(root,".env"),"DO_NOT_PUBLISH=1");
 assert((await inventory(root)).unsafe.some(x=>x==="secret:.env"));
});

test("F21 manifest rejects traversal URLs instead of scanning outside release",async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pote-paths-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,"sub"));
 await writeFile(path.join(root,"sub/index.html"),
  '<script src="../../other.js"></script>');
 const result=await inventory(root);
 assert.equal(result.ok,false);
 assert.equal(result.invalid.length,1);
});
