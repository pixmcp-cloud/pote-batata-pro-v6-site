// Contratos de licença do Potê Batata Pro — sem dados privados.
export const LICENSE_TERMS = Object.freeze([
  {id:"trial24h",label:"Teste grátis · 24 horas",kind:"trial"},
  {id:"month1",label:"PRO · 1 mês",kind:"pro"},
  {id:"month6",label:"PRO · 6 meses",kind:"pro"},
  {id:"year1",label:"PRO · 1 ano",kind:"pro"},
  {id:"lifetime",label:"PRO · Vitalícia",kind:"lifetime"}
]);
export function epochMillis(value){
  if(value==null)return null;
  if(value instanceof Date)return value.getTime();
  if(typeof value==="number")return value>1e12?value:value*1000;
  if(typeof value==="string"){const n=Date.parse(value);return Number.isFinite(n)?n:null;}
  if(typeof value?.toMillis==="function")return value.toMillis();
  if(typeof value?.seconds==="number")return value.seconds*1000+Math.floor((value.nanoseconds||0)/1e6);
  return null;
}
function plusCalendarMonthsClamped(date,months){
  const y=date.getUTCFullYear(),m=date.getUTCMonth(),day=date.getUTCDate();
  const dest=new Date(Date.UTC(y,m+months,1,date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds(),date.getUTCMilliseconds()));
  const lastDay=new Date(Date.UTC(dest.getUTCFullYear(),dest.getUTCMonth()+1,0)).getUTCDate();
  dest.setUTCDate(Math.min(day,lastDay));
  return dest;
}
export function expiryForTerm(term,now=new Date()){
  const d=new Date(now);if(!Number.isFinite(d.getTime()))throw Error("Data inválida");
  switch(term){
    case "trial24h":return new Date(d.getTime()+24*60*60*1000);
    case "month1":return plusCalendarMonthsClamped(d,1);
    case "month6":return plusCalendarMonthsClamped(d,6);
    case "year1":return plusCalendarMonthsClamped(d,12);
    case "lifetime":return null;
    default:throw Error("Modalidade de licença desconhecida");
  }
}
export function resolveLicense(license,now=Date.now()){
  if(!license || license.kind==="free" || license.status==="revoked")
    return {kind:"free",active:false,label:"FREE",term:"free",expiresAt:null,reason:license?.status==="revoked"?"revoked":"free"};
  if(license.kind==="lifetime"&&license.term==="lifetime"&&license.status==="active")
    return {kind:"lifetime",active:true,label:"VITALÍCIA",term:"lifetime",expiresAt:null};
  if(!["trial","pro"].includes(license.kind) || license.status!=="active")
    return {kind:"free",active:false,label:"FREE",term:"free",expiresAt:null,reason:"invalid"};
  const term=LICENSE_TERMS.find(t=>t.id===license.term);
  if(!term || term.kind!==license.kind)
    return {kind:"free",active:false,label:"FREE",term:"free",expiresAt:null,reason:"invalid"};
  const end=epochMillis(license.expiresAt);
  if(!end || !Number.isFinite(end) || end<=now)
    return {kind:"free",active:false,label:"FREE · vencida",term:"free",expiresAt:end,reason:"expired"};
  return {kind:license.kind,active:true,label:license.kind==="trial"?"TESTE 24H":"PRO",term:license.term,expiresAt:end};
}
export function dateBR(date){
  const ms=epochMillis(date);
  return ms===null?"Sem vencimento":new Date(ms).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
