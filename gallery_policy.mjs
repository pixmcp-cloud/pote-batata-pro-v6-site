// Regras compartilhadas da Galeria temporária Potê Batata Pro.
export const GALLERY_TTL_HOURS=42;
export const GALLERY_TTL_MS=42*60*60*1000;
export const GALLERY_LOCAL_LIMIT=80;
export const GALLERY_MAX_IMAGE_BYTES=3*1024*1024;
export function galleryExpiry(createdAtMs){return Number(createdAtMs)+GALLERY_TTL_MS;}
export function isGalleryExpired(item,now=Date.now()){
 return !item || !Number.isFinite(Number(item.expiresAtMs)) || Number(item.expiresAtMs)<=now;
}
export function galleryTimeRemaining(item,now=Date.now()){
 if(isGalleryExpired(item,now))return "Expirada";
 const secs=Math.ceil((item.expiresAtMs-now)/1000);
 const h=Math.floor(secs/3600),m=Math.floor(secs%3600/60);
 return String(h).padStart(2,"0")+"h "+String(m).padStart(2,"0")+"m";
}
export function galleryFileLabel(name){
 return String(name||"Arte Potê Batata").slice(0,90).replace(/[<>\x00-\x1F]/g,"").trim()||"Arte Potê Batata";
}
