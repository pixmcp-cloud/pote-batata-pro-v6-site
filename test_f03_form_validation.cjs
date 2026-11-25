const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('source/pote_app_base.html','utf8');
function part(start,end){const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return src.slice(a,b);}
const fields=new Map(),messages=[];
function el(id){if(!fields.has(id))fields.set(id,{value:'',innerHTML:''});return fields.get(id)}
function set(values){for(const [id,value] of Object.entries(values))el(id).value=String(value)}
const data={businessType:'batataria',ingredients:[],expenses:[{id:'e',amount:25,repeat:1,mode:'mensal'}],beverages:[],combos:[],addons:[]};
let writes=0,renders=0,id=0;
const ctx={window:{},state:{data},document:{getElementById:el,querySelectorAll:()=>[]},draftItems:[{id:'i',g:50}],pro:()=>true,uid:()=>String(++id),ingredient:()=>null,render:()=>renders++,persist:()=>writes++,toast:m=>messages.push(m),alert:m=>messages.push(m),renderDraftItems:()=>'',recipe:()=>({id:'r'}),allowed:()=>true,isUnavailable:()=>false,comboQuote:()=>({price:10,contribution:2,estimatedProfit:1}),confirm:()=>true};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('finance_core.js','utf8'),ctx);
vm.runInContext(part('function parseBRNumber(v)','function commercialDate(')+part('function updateDraftQty(','function removeDraftItem(')+part('function addIngredient(){','function changeIngredient(')+part('function setExpenseRaw(','function removeExpense(')+part('function addExpense(){','function pageSuppliers(')+part('function comboDraft(){','function editCombo(')+part('function saveBeverage(){','function editBeverage('),ctx);
ctx.updateDraftQty(0,'abc');assert.equal(ctx.draftItems[0].g,50);
ctx.updateDraftQty(0,'0');assert.equal(ctx.draftItems[0].g,50);
ctx.updateDraftQty(0,'12,5');assert.equal(ctx.draftItems[0].g,12.5);
ctx.setExpenseRaw('e','');assert.equal(data.expenses[0].amount,25);
ctx.setExpenseRaw('e','15');assert.equal(data.expenses[0].amount,25);
set({'amt-e':'abc','times-e':1,'freq-e':'mensal'});ctx.saveExpense('e');assert.equal(data.expenses[0].amount,25);assert.equal(writes,0);
set({'amt-e':'20,50','times-e':'1,5'});ctx.saveExpense('e');assert.equal(writes,0);
set({'times-e':2});ctx.saveExpense('e');assert.equal(data.expenses[0].amount,20.5);assert.equal(data.expenses[0].repeat,2);assert.equal(writes,1);
set({expenseName:'Luz',expenseVal:'1 2',expenseMode:'mensal'});ctx.addExpense();assert.equal(data.expenses.length,1);
set({expenseVal:'100,50'});ctx.addExpense();assert.equal(data.expenses[1].amount,100.5);
set({newIngName:'Farinha',newIngCat:'Secos',newIngPrice:'abc',newIngQuantity:1,newIngUnit:'kg',newIngYield:100});ctx.addIngredient();assert.equal(data.ingredients.length,0);
set({newIngPrice:'12,50',newIngYield:0});ctx.addIngredient();assert.equal(data.ingredients.length,0);
set({newIngYield:100});ctx.addIngredient();assert.equal(data.ingredients[0].purchasePrice,12.5);
set({bevName:'Água',bevSize:'500 ml',bevCost:'abc',bevPrice:5,bevStock:4,bevMinimum:1});ctx.saveBeverage();assert.equal(data.beverages.length,0);
set({bevCost:'1,50',bevStock:'1,5'});ctx.saveBeverage();assert.equal(data.beverages.length,0);
set({bevStock:4,bevMinimum:'0'});ctx.saveBeverage();assert.equal(data.beverages[0].purchasePrice,1.5);assert.equal(data.beverages[0].stock,4);
set({comboName:'Combo',comboRecipe:'r',comboDiscount:'abc',comboDiscountType:'percent'});ctx.saveCombo();assert.equal(data.combos.length,0);
set({comboDiscount:'5'});ctx.saveCombo();assert.equal(data.combos[0].discountValue,5);
const order=part('function newOrder(){','function ');assert(order.includes('!Number.isSafeInteger(qty)'));assert(!order.includes('Math.floor(num(document.getElementById'));
console.log('PASS F03: invalid form edits preserve existing data; numeric input validation, no fractional order/beverage, valid decimal comma accepted.');
