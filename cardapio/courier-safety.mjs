// Heuristic only: GPS cannot establish whether a collision occurred.
export function observeAbruptStop(previous,fix,now){
 const reset={state:null,suspect:false};
 if(!fix||!Number.isFinite(fix.speed)||fix.speed<0||fix.speed>65||!Number.isFinite(fix.accuracy)||fix.accuracy>20||fix.accuracy<0||!Number.isSafeInteger(now))return reset;
 const base={speed:fix.speed,at:now};
 if(!previous||now<=previous.at||now-previous.at>6000)return {state:base,suspect:false};
 const dt=(now-previous.at)/1000;
 return {state:base,suspect:previous.speed>=8&&fix.speed<=1.5&&(previous.speed-fix.speed)/dt>=4};
}
