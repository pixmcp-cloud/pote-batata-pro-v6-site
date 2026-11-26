// Fixed Portuguese demo: no caller-supplied text, no IA COIN debit.
// At most 25 one-time reservations. Ambiguous failures never auto-retry.
export const PREVIEW_PHRASES=Object.freeze([
  "Opa, tudo bem? Que tal escolher a minha voz para sua próxima campanha? Vamos arrasar!",
  "Olá! Que tal dar vida à sua próxima campanha com a minha voz? Vamos nessa!",
  "Oi, tudo certo? Imagine sua próxima oferta com a minha voz. Vai ser incrível!",
  "E aí, tudo bem? Quer dar mais energia à sua divulgação? Conte com a minha voz!",
  "Olá, que tal inovar? Sua próxima campanha pode começar com a minha voz. Bora lá!",
  "Opa! Quer uma locução que chame a atenção? Que tal experimentar a minha voz?",
  "Tudo bem por aí? Vamos transformar suas ideias em uma campanha de impacto!",
  "Oi! Sua próxima promoção merece uma voz marcante. Vamos fazer acontecer?",
  "Que tal surpreender seu público? Experimente a minha voz e dê vida às suas ideias!",
  "Olá! Vamos criar algo especial? Minha voz pode dar aquele toque à sua próxima campanha!",
  "E aí, vamos começar? Escolha a minha voz e faça sua mensagem ganhar destaque!"
]);
export const PREVIEW_MAX_CHARS=Math.max(...PREVIEW_PHRASES.map(p=>p.length));
export function choosePreviewPhrase(random=Math.random){return PREVIEW_PHRASES[Math.min(PREVIEW_PHRASES.length-1,Math.max(0,Math.floor(random()*PREVIEW_PHRASES.length)))];}
export const PREVIEW_MAX=25;
export const PREVIEW_VERSION='pt-v2';
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
