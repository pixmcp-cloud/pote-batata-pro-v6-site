import assert from "node:assert/strict";
import {statusView} from "./order_ticker.mjs";
const t=1000000;
let n=0;
function eq(a,b){assert.deepEqual(a,b);n++}
for(const [status,label] of Object.entries({received:"Pedido recebido",preparing:"Em preparo",ready:"Pedido finalizado",out_for_delivery:"Saiu para entrega"})){
 const v=statusView({status,createdAt:t},{connected:true,serverNowMs:t+65000});
 eq(v.label,label);eq(v.clock,"00:01:05");eq(v.live,true);
}
eq(statusView({status:"preparing",createdAt:t},{connected:false,serverNowMs:t+5000}).live,false);
for(const status of ["delivered","cancelled"]){const v=statusView({status,createdAt:t,elapsedMs:123000},{connected:true,serverNowMs:t+999999});eq(v.clock,"00:02:03");eq(v.terminal,true);eq(v.live,false)}
eq(statusView({status:"received",createdAt:t},{serverNowMs:t-1000}).clock,"00:00:00");
assert.throws(()=>statusView({status:"invalid",createdAt:t}));n++;
assert.throws(()=>statusView({status:"delivered",createdAt:t,elapsedMs:-1}));n++;
console.log("PASS B02.1 ticker",n,"assertivas de projeção; DOM não testado");
