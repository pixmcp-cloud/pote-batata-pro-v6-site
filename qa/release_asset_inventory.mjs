/* F21/F35: deterministic inventory of release assets. No third-party packages. */
import {createHash} from "node:crypto";
import {readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const extensions=new Set([".html",".htm",".js",".mjs",".css",".json",".jpg",".jpeg",
 ".png",".webp",".gif",".svg",".ico",".woff",".woff2",".mp3",".ogg",".pdf"]);
const secret=/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars|.*service.?account.*\.json|.*\.pem)$/i;
const posix=p=>p.split(path.sep).join("/");
export async function inventory(directory){
 const root=path.resolve(directory),files=[],sources=[],unsafe=[];
 async function walk(subdir=""){
  for(const ent of await readdir(path.join(root,subdir),{withFileTypes:true})){
   const name=posix(path.join(subdir,ent.name));
   if(ent.isSymbolicLink()){unsafe.push("symlink:"+name);continue}
   if(ent.isDirectory()){await walk(name);continue}
   if(!ent.isFile())continue;
   if(secret.test(name))unsafe.push("secret:"+name);
   const buf=await readFile(path.join(root,name));
   files.push({path:name,bytes:buf.length,sha256:createHash("sha256").update(buf).digest("hex")});
   if(/\.(html?|css|m?js)$/i.test(name))sources.push([name,buf.toString("utf8")]);
  }
 }
 await walk();
 files.sort((a,b)=>a.path.localeCompare(b.path));
 const names=new Set(files.map(f=>f.path)),missing=[],external=new Set(),invalid=[];
 for(const [from,content] of sources){
  const refs=[];
  if(/\.html?$/i.test(from)){
   for(const match of content.matchAll(/<(?:script|link|img|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))refs.push(match[1]);
  }
  if(/\.(html?|css)$/i.test(from)){
   for(const match of content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))refs.push(match[1]);
  }
  if(/\.m?js$/i.test(from)){
   for(const match of content.matchAll(/\b(?:import|export)\s*(?:[^;]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g))refs.push(match[1]);
  }
  for(const raw of refs){
   if(/^(data:|blob:|#|mailto:|tel:)/i.test(raw))continue;
   if(/^https?:\/\//i.test(raw)||raw.startsWith("//")){
    try{external.add(new URL(raw.startsWith("//")?"https:"+raw:raw).host)}catch{}
    continue;
   }
   let target;
   try{target=decodeURIComponent(raw.split(/[?#]/)[0])}catch{
    invalid.push({from,raw});continue;
   }
   if(!target||target.includes("\\")||target.includes("\0")){invalid.push({from,raw});continue}
   if(!extensions.has(path.posix.extname(target).toLowerCase()))continue;
   const resolved=target.startsWith("/")?target.slice(1):
    path.posix.normalize(path.posix.join(path.posix.dirname(from),target));
   if(resolved===".."||resolved.startsWith("../"))invalid.push({from,raw});
   else if(!names.has(resolved))missing.push({from,to:resolved});
  }
 }
 return {schema:1,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),
  files,externalHosts:[...external].sort(),missing,invalid,unsafe,
  ok:!missing.length&&!invalid.length&&!unsafe.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2],out=process.argv.indexOf("--out");
 if(!root){console.error("Usage: node qa/release_asset_inventory.mjs public [--out manifest.json]");process.exitCode=2}
 else try{
  const report=await inventory(root);
  if(out>=0){if(!process.argv[out+1])throw Error("Missing output path");
   await writeFile(process.argv[out+1],JSON.stringify(report,null,2)+"\n")}
  console.log("F21/F35 inventory:",report.ok?"PASS":"FAIL",report.fileCount,"files",
   report.totalBytes,"bytes",report.missing.length,"missing",report.unsafe.length,"unsafe");
  for(const problem of [...report.missing,...report.invalid,...report.unsafe].slice(0,20))
   console.error("ASSET_ERROR",JSON.stringify(problem));
  if(!report.ok)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1}
}
