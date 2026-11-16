/* Pure Motoboy finance logic. A trip may contain multiple orders. No Pix payments are sent. */
const finite=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
export const MODELS=["delivery","kilometer","daily","hybrid"];
export function effectiveKm(trip){
 const km=finite(trip.km);
 return km*(trip.distanceMode==="oneWayReturn"?2:1);
}
export function tripAmount(courier,trip){
 if(trip?.status!=="delivered"||!courier)return 0;
 const count=new Set((trip.orderRefs||[]).map(x=>String(x.universe)+"/"+String(x.id))).size;
 const km=effectiveKm(trip);
 switch(courier.paymentModel){
 case "delivery":return round(finite(courier.rateDelivery)*count);
 case "kilometer":return round(finite(courier.rateKm)*km);
 case "daily":return 0;
 case "hybrid":return round(finite(courier.rateDelivery)*count+finite(courier.rateKm)*km);
 default:return 0;
 }
}
export function round(x){return Math.round((Number(x)||0)*100)/100}
export function courierStatement(courier,trips=[],settlements=[]){
 const completed=trips.filter(t=>t.courierId===courier.id&&t.status==="delivered");
 const dates=new Set(completed.map(t=>String(t.at||"").slice(0,10)).filter(Boolean));
 const daily=courier.paymentModel==="daily"?dates.size*finite(courier.rateDay):0;
 const variable=completed.reduce((a,t)=>a+tripAmount(courier,t),0);
 const due=round(daily+variable);
 const paid=round(settlements.filter(s=>s.courierId===courier.id).reduce((a,s)=>a+finite(s.amount),0));
 const count=completed.reduce((a,t)=>a+new Set((t.orderRefs||[]).map(x=>x.universe+"/"+x.id)).size,0);
 return {trips:completed.length,orders:count,km:round(completed.reduce((a,t)=>a+effectiveKm(t),0)),days:dates.size,
  due,paid,balance:round(Math.max(0,due-paid)),overpaid:round(Math.max(0,paid-due))};
}
export function normalizedPhone(value){
 let d=String(value||"").replace(/\D/g,"");
 if(d.startsWith("00"))d=d.slice(2);
 if(d.length===10||d.length===11)d="55"+d;
 return /^55\d{10,11}$/.test(d)?d:"";
}
export function canAssign(order,existingTrips){
 return !existingTrips.some(t=>t.status!=="cancelled"&&(t.orderRefs||[]).some(ref=>ref.id===order.id&&ref.universe===order.universe));
}
