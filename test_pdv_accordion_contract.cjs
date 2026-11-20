const fs=require("node:fs"),assert=require("node:assert/strict");
const pdv=fs.readFileSync("pdv_cash_ui.mjs","utf8");
const build=fs.readFileSync("make_beta.py","utf8");
const output=fs.readFileSync("public/index.html","utf8");
assert(pdv.includes("function captureCashDetails(body)")&&pdv.includes("function restoreCashDetails(body,openDetails,scrollY)"),"Cash breakdown expanded state must be preserved");
assert(pdv.includes("function fingerprintCash(data,session)")&&pdv.includes("if(nextFingerprint===lastModalFingerprint)return"),"Unchanged data should never rebuild accordion");
for(const key of ["cash-equation","movements","receipts","closed-history","old-receivables"])
 assert(pdv.includes('data-pdv-detail="'+key+'"'),"Missing stable details key: "+key);
assert(pdv.includes("restoreCashDetails(body,openedDetails,scrollY)"),"Expanded details must be restored when cash summary changes");
assert(pdv.includes("lastModalFingerprint=null;visible=true"),"Intentional reopen requires fresh render");
assert(build.includes("pdv_cash_ui.mjs?v=pdv-order-sequence-20261119"),"Cache-busted module required");
assert(output.includes("pdv_cash_ui.mjs?v=pdv-order-sequence-20261119"),"Built site should use new module");
console.log("PASS: PDV accordion stays open on autosave and data updates with stable keys.");
