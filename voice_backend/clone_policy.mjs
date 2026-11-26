// Pure policy for ADM-only Instant Voice Cloning. No provider calls here.
export const MAX_CLONE_BYTES=8*1024*1024;
const formats=Object.freeze({'audio/mpeg':'mp3','audio/wav':'wav','audio/mp4':'m4a','audio/aac':'aac','audio/ogg':'ogg'});
export function cloneEnabled(config,subscription){
 return config?.cloneApproved===true&&subscription?.can_use_instant_voice_cloning===true;
}
export function validateClone(data){
 if(!data||data.consent!==true)throw Error('Confirme autorização expressa do titular para síntese e uso comercial por clientes do PDV.');
 const name=typeof data.name==='string'?data.name.trim():'',description=typeof data.description==='string'?data.description.trim():'';
 const consentRef=typeof data.consentRef==='string'?data.consentRef.trim():'';
 if(name.length<3||name.length>65||description.length>250||consentRef.length<5||consentRef.length>180)throw Error('Nome, descrição ou referência da autorização inválidos.');
 if(typeof data.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestId))throw Error('Identificador inválido.');
 if(!Object.hasOwn(formats,data.mime)||typeof data.audio!=='string'||data.audio.length>Math.ceil(MAX_CLONE_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio))throw Error('Envie MP3, WAV, M4A, AAC ou OGG de até 8 MB.');
 let bytes;try{bytes=Uint8Array.from(atob(data.audio),ch=>ch.charCodeAt(0));}catch{throw Error('Amostra inválida.');}
 if(bytes.length<1024||bytes.length>MAX_CLONE_BYTES)throw Error('Amostra inválida.');
 const ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));
 const wav=ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';
 const adts=bytes[0]===255&&(bytes[1]&246)===240;
 const mp3=ascii(0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224&&(bytes[1]&6)!==0);
 const m4a=ascii(4,8)==='ftyp'&&['M4A ','M4B ','isom','mp42','mp41','iso2'].includes(ascii(8,12));
 const aac=adts||ascii(0,4)==='ADIF';
 const ogg=ascii(0,4)==='OggS'&&(ascii(28,36)==='OpusHead'||ascii(28,35)==='\x01vorbis'||ascii(28,33)==='\x7fFLAC'||ascii(28,36)==='Speex   ');
 const valid={'audio/mpeg':mp3,'audio/wav':wav,'audio/mp4':m4a,'audio/aac':aac,'audio/ogg':ogg};
 if(!valid[data.mime])throw Error('Formato do arquivo não corresponde ao áudio.');
 return {name,description,consentRef,bytes,mime:data.mime,filename:'sample.'+formats[data.mime],requestId:data.requestId};
}
export function sharedCloneUsable(record,config){
 return config?.sharedCloneApproved===true&&record?.state==='published'&&record?.requiresVerification===false&&record?.consentConfirmed===true;
}
