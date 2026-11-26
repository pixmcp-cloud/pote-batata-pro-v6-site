// Pure policy for ADM-only Instant Voice Cloning. No provider calls here.
export const MAX_CLONE_BYTES=8*1024*1024;
export function cloneEnabled(config,subscription){
 return config?.cloneApproved===true&&subscription?.can_use_instant_voice_cloning===true;
}
export function validateClone(data){
 if(!data||data.consent!==true)throw Error('Confirme autorização expressa do titular para síntese e uso comercial por clientes do PDV.');
 const name=typeof data.name==='string'?data.name.trim():'',description=typeof data.description==='string'?data.description.trim():'';
 const consentRef=typeof data.consentRef==='string'?data.consentRef.trim():'';
 if(name.length<3||name.length>65||description.length>250||consentRef.length<5||consentRef.length>180)throw Error('Nome, descrição ou referência da autorização inválidos.');
 if(typeof data.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestId))throw Error('Identificador inválido.');
 if(!['audio/mpeg','audio/wav'].includes(data.mime)||typeof data.audio!=='string'||data.audio.length>Math.ceil(MAX_CLONE_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio))throw Error('Envie um MP3 ou WAV de até 8 MB.');
 let bytes;try{bytes=Uint8Array.from(atob(data.audio),ch=>ch.charCodeAt(0));}catch{throw Error('Amostra inválida.');}
 if(bytes.length<1024||bytes.length>MAX_CLONE_BYTES)throw Error('Amostra inválida.');
 const ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));
 const wav=ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';
 const mp3=ascii(0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224);
 if(data.mime==='audio/wav'?!wav:!mp3)throw Error('Formato do arquivo não corresponde ao áudio.');
 return {name,description,consentRef,bytes,mime:data.mime,requestId:data.requestId};
}
export function sharedCloneUsable(record,config){
 return config?.sharedCloneApproved===true&&record?.state==='published'&&record?.requiresVerification===false&&record?.consentConfirmed===true;
}
