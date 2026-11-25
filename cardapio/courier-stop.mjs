// Local-only stationary detector; GPS loss is not evidence of stopping.
export const STOP_MS=180000, MAX_GAP_MS=90000, MAX_ACCURACY=25;
export function distanceMeters(a,b){
 const rad=Math.PI/180,x=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(x)));
}
export function observeStop(state,point,now){
 const reset={state:null,alert:false,stationary:false};
 if(!point||!Number.isSafeInteger(now)||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180||
  !Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>MAX_ACCURACY)return reset;
 if(Number.isFinite(point.speed)&&point.speed>=1.5)return reset;
 if(!state||now<=state.lastAt||now-state.lastAt>MAX_GAP_MS||distanceMeters(state.anchor,point)>30)
  return {state:{anchor:{lat:point.lat,lon:point.lon},since:now,lastAt:now,notified:false},alert:false,stationary:false};
 const stationary=now-state.since>=STOP_MS,alert=stationary&&!state.notified;
 return {state:{...state,lastAt:now,notified:state.notified||alert},stationary,alert};
}
