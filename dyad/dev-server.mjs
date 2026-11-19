import { createServer } from "node:http";
import { stat, readFile, realpath } from "node:fs/promises";
import { resolve, join, extname, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Local readonly visual preview. The commercial Firebase database is never queried.
const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const mime = {
 ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
 ".json":"application/json; charset=utf-8",".svg":"image/svg+xml",
 ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
 ".webp":"image/webp",".ico":"image/x-icon",
 ".webmanifest":"application/manifest+json; charset=utf-8",
 ".woff":"font/woff",".woff2":"font/woff2",
};
const policy = [
 "default-src 'self' data: blob:",
 "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com",
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data: https://fonts.gstatic.com",
 "connect-src 'self'",
 "form-action 'self'",
 "frame-src 'none'",
 "worker-src 'none'",
 "object-src 'none'",
 "base-uri 'self'",
].join("; ");
function addHeaders(response, extra = {}) {
 response.setHeader("X-Pote-Lab", "readonly-offline");
 response.setHeader("Cache-Control", "no-store, max-age=0");
 response.setHeader("Content-Security-Policy", policy);
 response.setHeader("X-Content-Type-Options", "nosniff");
 response.setHeader("Referrer-Policy", "no-referrer");
 response.setHeader("Permissions-Policy", "geolocation=(), payment=(), camera=(), microphone=()");
 for(const [key,value] of Object.entries(extra)) response.setHeader(key,value);
}
function fail(response,status,message,method="GET"){
 const body=JSON.stringify({error:message,status,mode:"dyad-readonly"});
 addHeaders(response,{"Content-Type":"application/json; charset=utf-8"});
 response.writeHead(status);
 response.end(method==="HEAD"?"":body);
}
export function createLabServer({root=publicRoot}={}){
 const base=resolve(root);
 return createServer(async(request,response)=>{
  const method=request.method||"GET";
  if(method!=="GET"&&method!=="HEAD") return fail(response,405,"Only GET/HEAD allowed",method);
  const host=String(request.headers.host||"").split(":")[0].toLowerCase();
  if(!["localhost","127.0.0.1"].includes(host)) return fail(response,403,"Only loopback hostnames allowed",method);
  let pathname;
  try{
   pathname=decodeURIComponent(new URL(request.url||"/","http://127.0.0.1").pathname);
   if(pathname.includes("\\")||pathname.includes("\0")) throw Error("Invalid path");
  }catch{return fail(response,400,"Invalid URL",method);}
  if(pathname==="/__lab/health"){
   const body=JSON.stringify({ok:true,preview:"Potê Batata Pro",readonly:true,firebaseWrites:false});
   addHeaders(response,{"Content-Type":"application/json; charset=utf-8"});
   response.writeHead(200);
   return response.end(method==="HEAD"?"":body);
  }
  const parts=pathname.split("/").filter(Boolean);
  if(parts.some(part=>part==="."||part===".."||part.startsWith(".")))
   return fail(response,403,"Path not allowed",method);
  const relative=pathname.endsWith("/")?pathname+"index.html":pathname;
  let target=resolve(base,"."+relative);
  if(target!==base&&!target.startsWith(base+sep))
   return fail(response,403,"Path outside build",method);
  let info;
  try{info=await stat(target);}catch{
   if(!extname(target)&&!pathname.startsWith("/__")){
    target=join(base,"index.html");
    try{info=await stat(target);}catch{return fail(response,404,"Build missing: run python build_hosting.py",method);}
   }else return fail(response,404,"File not found",method);
  }
  if(!info.isFile())return fail(response,404,"Not a file",method);
  let data;
  try{
   const actual=await realpath(target);
   if(!actual.startsWith(base+sep))return fail(response,403,"Symlink escape denied",method);
   data=await readFile(actual);
  }catch{return fail(response,404,"Unreadable file",method);}
  addHeaders(response,{
   "Content-Type":mime[extname(target).toLowerCase()]||"application/octet-stream",
   "Content-Length":data.length,
  });
  response.writeHead(200);
  return response.end(method==="HEAD"?"":data);
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||"5173");
 if(!Number.isInteger(port)||port<=0||port>65535)throw Error("Invalid PORT");
 createLabServer().listen(port,"127.0.0.1",()=>{
  console.log("POTÊ DYAD LAB READONLY http://127.0.0.1:"+port+"/");
  console.log("Firebase external connection blocked by CSP; no real sales or stock writes.");
 });
}
