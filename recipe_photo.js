/* Square (1:1) recipe photo upload — no paid storage bucket required.
 * Images are downsampled and persisted in the recipe's V2 data record. */
(function(){
 "use strict";
 const MAX_SOURCE_BYTES=12*1024*1024,MAX_DATA_URL_CHARS=110000;
 const types=new Set(["image/png","image/jpeg","image/webp","image/avif"]);
 const byId=id=>document.getElementById(id);
 const sourceDefault="./assets/generic/business-neutral.svg";
 function sync(){
  const output=byId("builderImagePreview");
  if(!output)return;
  const custom=byId("builderPhotoData")?.value||"";
  const preset=byId("builderImageUrl")?.value||"";
  if(custom&&/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(custom)&&custom.length<=MAX_DATA_URL_CHARS){
   output.src=custom;return;
  }
  const existing=output.getAttribute("src")||"";
  if(preset)output.src=preset;
  else if(!existing||existing.startsWith("data:"))output.src=sourceDefault;
 }
 async function handle(input){
  const file=input?.files?.[0],status=byId("builderImageStatus");
  if(!file)return;
  if(!types.has(file.type)||!file.size||file.size>MAX_SOURCE_BYTES){
   if(status)status.textContent="Escolha PNG, JPG, WebP ou AVIF de até 12 MB.";
   input.value="";return;
  }
  let url="";
  try{
   if(status)status.textContent="Preparando foto quadrada...";
   url=URL.createObjectURL(file);
   const photo=new Image();photo.src=url;await photo.decode();
   if(!photo.naturalWidth||!photo.naturalHeight)throw Error("Imagem inválida.");
   const canvas=document.createElement("canvas");
   const context=canvas.getContext("2d");
   if(!context)throw Error("O navegador não conseguiu processar a imagem.");
   const side=Math.min(photo.naturalWidth,photo.naturalHeight);
   const sx=Math.round((photo.naturalWidth-side)/2),sy=Math.round((photo.naturalHeight-side)/2);
   let result="";
   for(const size of [480,420,360,320]){
    canvas.width=canvas.height=size;
    context.clearRect(0,0,size,size);
    context.drawImage(photo,sx,sy,side,side,0,0,size,size);
    for(const quality of [.78,.66,.54,.42]){
     let value=canvas.toDataURL("image/webp",quality);
     if(!value.startsWith("data:image/webp"))value=canvas.toDataURL("image/jpeg",quality);
     if(value.length<=MAX_DATA_URL_CHARS){result=value;break}
    }
    if(result)break;
   }
   if(!result)throw Error("Foto muito detalhada; escolha uma imagem mais leve.");
   const hidden=byId("builderPhotoData"),preview=byId("builderImagePreview");
   if(!hidden||!preview||window.POTE_ROUTE_BRIDGE?.current?.().tab!=="builder")throw Error("Abra a receita novamente para selecionar a foto.");
   hidden.value=result;preview.src=result;
   hidden.dispatchEvent(new Event("input",{bubbles:true}));
   window.POTE_EXIT?.captureNow?.();
   if(status)status.textContent="Imagem 1:1 pronta. Clique em Salvar receita para confirmar.";
  }catch(e){
   if(status)status.textContent="Não foi possível processar esta imagem: "+String(e.message||e);
  }finally{if(url)URL.revokeObjectURL(url);input.value=""}
 }
 document.addEventListener("change",event=>{
  if(event.target?.id!=="builderImageUrl")return;
  const custom=byId("builderPhotoData");
  if(custom)custom.value="";
  const preview=byId("builderImagePreview");
  if(preview)preview.src=byId("builderImageUrl")?.value||sourceDefault;
  window.POTE_EXIT?.captureNow?.();
 },true);
 window.POTE_RECIPE_PHOTO={handle,sync};
})();
