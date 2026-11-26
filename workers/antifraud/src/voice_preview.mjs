// Fixed Portuguese demo: no caller-supplied text, no IA COIN debit.
// At most 25 one-time reservations. Ambiguous failures never auto-retry.
export const PREVIEW_TEXT='Olá! Esta é uma demonstração da minha voz. Estou pronta para narrar suas ofertas, campanhas e anúncios comerciais.';
export const PREVIEW_MAX=25;
export const PREVIEW_VERSION='pt-v1';
export const PREVIEW_MAX_BYTES=350000;
export function previewPath(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Voz inválida.');return 'voicePortuguesePreviews/'+PREVIEW_VERSION+'-'+id;}
export function encodePreview(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<3||bytes.length>PREVIEW_MAX_BYTES)throw Error('Amostra de áudio inválida.');
 if(!(bytes[0]===73&&bytes[1]===68&&bytes[2]===51)&&!(bytes[0]===255&&(bytes[1]&224)===224))throw Error('Formato MP3 inválido.');
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}
export function decodePreview(value){
 if(typeof value!=='string'||value.length>Math.ceil(PREVIEW_MAX_BYTES/3)*4)throw Error('Amostra inválida.');
 return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
