const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const window={};
const ctx=vm.createContext({window,document:{},Number,String,Math,Array,Map});
for(const filename of ["finance_core.js","stock_math.js","payment_flow.js"])
 vm.runInContext(fs.readFileSync(filename,"utf8"),ctx,{filename});
const F=window.POTE_FINANCE,S=window.POTE_STOCK,P=window.POTE_PAYMENT;
assert(F&&S&&P,"All numeric module contracts must initialize");
for(const [input,expected] of [
 ["0,00",0],["2,30",2.3],["999,99",999.99],["1234,56",1234.56],
 ["1.234",1234],["R$ 1.234,56",1234.56],["1.234.567,89",1234567.89]
]){
 assert.equal(F.parseNumber(input),expected,"finance: "+input);
 assert.equal(S.number(input),expected,"inventory: "+input);
 assert.equal(P.toCents(input)/100,expected,"cash: "+input);
}
for(const input of ["1,2,3","1.2.3","R$ 1.234,5,6","--3"]){
 assert(Number.isNaN(F.parseNumber(input)),"finance must reject "+input);
 assert(Number.isNaN(S.number(input)),"stock must reject "+input);
 assert(Number.isNaN(P.toCents(input)),"cash must reject "+input);
}
console.log("PASS F03/F09: BRL separators agree between finance, stock and PDV.");
