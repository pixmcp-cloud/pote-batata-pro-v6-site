const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("source/pote_app_base.html","utf8");
const fn=html.match(/async function approveRecipeServerPrice\(id\)\{[\s\S]*?\n\}/);
assert(fn,"Price action missing");
assert(html.includes("window.POTE_WORKER?.enabled===true?"),"Worker flag must gate UI");
const calls=[],button={disabled:false,isConnected:true,textContent:""};
const ctx={window:{POTE_WORKER:{enabled:false,approvePrice:async(...args)=>{calls.push(args);return {revision:2}}},
 POTE_AUTH:{proActive:true}},state:{data:{businessType:"batataria"}},
 pro:()=>true,recipe:()=>({id:"recipe-qa",name:"Batata QA"}),allowed:()=>true,
 sellPrice:()=>29.9,money:n=>"R$ "+n.toFixed(2),toast:()=>{},
 document:{getElementById:()=>button},confirm:()=>true,render:()=>{ctx.rendered=(ctx.rendered||0)+1},
 Number,Math,String};
vm.createContext(ctx);vm.runInContext(fn[0],ctx);
(async()=>{
 assert.equal(await ctx.approveRecipeServerPrice("recipe-qa"),false);
 assert.equal(calls.length,0);
 ctx.window.POTE_WORKER.enabled=true;
 assert.equal(await ctx.approveRecipeServerPrice("recipe-qa"),true);
 assert.deepEqual(calls[0],["recipe-qa","batataria",2990]);
 assert.equal(ctx.rendered,1);
 ctx.window.POTE_AUTH.proActive=false;
 assert.equal(await ctx.approveRecipeServerPrice("recipe-qa"),false);
 assert.equal(calls.length,1);
 ctx.window.POTE_AUTH.proActive=true;
 ctx.window.POTE_WORKER.approvePrice=async()=>{throw Error("423")};
 assert.equal(await ctx.approveRecipeServerPrice("recipe-qa"),false);
 assert.equal(ctx.rendered,1);assert.equal(button.disabled,false);
 console.log("PASS F02 price UI: disabled Worker, PRO gate, cents, rejection fail closed");
})().catch(e=>{console.error(e);process.exitCode=1});