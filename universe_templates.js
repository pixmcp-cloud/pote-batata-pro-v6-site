/* Catálogos comerciais iniciais: modelos editáveis, sem estoque, custo ou venda fictícia.
   Referências de popularidade nacionais: iFood 2026 e Apubra/Galunion 2024.
   Apenas os sabores líderes têm ranking publicado; os demais são sugestões de cardápio. */
(function(){
"use strict";
if(window.POTE_UNIVERSE_TEMPLATES)return;
const P=[
["Calabresa","Calabresa fatiada:100;Cebola roxa:30","Clássicas"],
["Frango com Requeijão","Frango desfiado:115;Requeijão cremoso:70;Milho verde:25","Clássicas"],
["Marguerita","Tomate em rodelas:70;Manjericão fresco:8;Azeite de oliva:8","Clássicas"],
["Muçarela","Muçarela adicional:80;Orégano:2","Clássicas"],
["Portuguesa","Presunto:70;Ovo cozido:70;Cebola roxa:25;Ervilha:20;Azeitona preta:15","Clássicas"],
["Quatro Queijos","Provolone:45;Gorgonzola:35;Parmesão:25;Requeijão cremoso:40","Queijos"],
["Pepperoni","Pepperoni:110;Orégano:2","Clássicas"],
["Napolitana","Tomate em rodelas:80;Parmesão:35;Alho fresco:7;Manjericão fresco:5","Clássicas"],
["Lombo Canadense","Lombo canadense:110;Cebola roxa:25;Azeitona preta:15","Carnes"],
["Bacon e Milho","Bacon:85;Milho verde:70;Cebola roxa:25","Carnes"],
["Frango com Milho","Frango desfiado:100;Milho verde:70;Requeijão cremoso:40","Aves"],
["Calabresa com Catupiry","Calabresa fatiada:95;Requeijão cremoso:65;Cebola roxa:25","Carnes"],
["Atum com Cebola","Atum escorrido:130;Cebola roxa:40;Azeitona preta:15","Peixes"],
["Palmito com Requeijão","Palmito:110;Requeijão cremoso:70;Tomate em rodelas:35","Vegetarianas"],
["Vegetariana","Abobrinha:65;Berinjela:65;Pimentão:55;Tomate em rodelas:50;Champignon:40","Vegetarianas"],
["Brócolis e Bacon","Brócolis:95;Bacon:80;Alho fresco:7","Carnes"],
["Rúcula e Tomate Seco","Rúcula:35;Tomate seco:65;Parmesão:40","Vegetarianas"],
["Alho e Óleo","Alho fresco:25;Azeite de oliva:20;Parmesão:40","Vegetarianas"],
["Baiana","Calabresa fatiada:95;Pimenta dedo-de-moça:10;Cebola roxa:30;Ovo cozido:65","Especiais"],
["Cinco Queijos","Provolone:30;Gorgonzola:28;Parmesão:25;Requeijão cremoso:38;Queijo prato:40","Queijos"],
["Camarão com Requeijão","Camarão limpo:140;Requeijão cremoso:70;Alho fresco:8","Frutos do mar"],
["Carne Seca com Requeijão","Carne seca dessalgada:135;Requeijão cremoso:65;Cebola roxa:35","Carnes"],
["Siciliana","Champignon:75;Bacon:70;Azeitona preta:25","Especiais"],
["Champignon","Champignon:110;Parmesão:35;Alho fresco:8","Vegetarianas"],
["Frango Barbecue","Frango desfiado:125;Molho barbecue:55;Cebola roxa:30","Aves"],
["Moda da Casa","Calabresa fatiada:70;Presunto:60;Bacon:45;Milho verde:50;Cebola roxa:30","Especiais"],
["Chocolate ao Leite","Chocolate ao leite:180;Creme de leite:40","Doces"],
["Chocolate com Morango","Chocolate ao leite:130;Morango:140;Creme de leite:35","Doces"],
["Banana com Canela","Banana:180;Canela em pó:4;Leite condensado:70","Doces"],
["Romeu e Julieta","Goiabada:130;Muçarela adicional:100;Requeijão cremoso:35","Doces"]
];
const H=[
["Cheeseburger Clássico","Queijo cheddar:35;Picles:20;Ketchup:18;Mostarda:12","Clássicos"],
["X-Salada","Queijo prato:35;Alface:25;Tomate:40;Maionese:25","Clássicos"],
["X-Tudo","Queijo prato:35;Bacon:50;Ovo:60;Presunto:35;Alface:25;Tomate:35;Milho verde:25;Maionese:25","Clássicos"],
["X-Bacon","Bacon:75;Queijo cheddar:35;Maionese:25","Clássicos"],
["X-Egg","Ovo:60;Queijo prato:35;Maionese:20","Clássicos"],
["X-Calabresa","Calabresa fatiada:85;Queijo prato:35;Cebola:30","Clássicos"],
["Duplo Cheeseburger","Hambúrguer bovino:140;Queijo cheddar:65;Picles:25","Duplos"],
["Duplo Bacon","Hambúrguer bovino:140;Bacon:100;Queijo cheddar:65","Duplos"],
["Smash Burger","Hambúrguer bovino:70;Queijo cheddar:40;Cebola:25;Molho especial:25","Smash"],
["Duplo Smash","Hambúrguer bovino:140;Queijo cheddar:60;Picles:20;Molho especial:30","Smash"],
["Smash Bacon","Bacon:60;Queijo cheddar:40;Molho especial:25","Smash"],
["Smash Cebola","Cebola:65;Queijo cheddar:40;Molho especial:25","Smash"],
["Cheddar Bacon","Cheddar cremoso:70;Bacon:80;Cebola crispy:30","Artesanais"],
["Barbecue Bacon","Molho barbecue:45;Bacon:80;Queijo prato:35","Artesanais"],
["Onion Burger","Cebola caramelizada:85;Queijo prato:40;Maionese:20","Artesanais"],
["Blue Cheese","Queijo gorgonzola:45;Cebola caramelizada:65;Rúcula:20","Artesanais"],
["Quatro Queijos","Queijo cheddar:25;Queijo prato:25;Queijo gorgonzola:25;Provolone:25","Artesanais"],
["Pimenta Jalapeño","Pimenta jalapeño:35;Queijo cheddar:40;Molho picante:20","Artesanais"],
["Picanha","Hambúrguer de picanha:160;Queijo prato:40;Cebola caramelizada:40","Premium"],
["Costela Desfiada","Costela bovina desfiada:125;Queijo cheddar:35;Molho barbecue:30","Premium"],
["Pulled Pork","Carne suína desfiada:120;Coleslaw:70;Molho barbecue:35","Premium"],
["Frango Crispy","Filé de frango empanado:150;Alface:30;Maionese:30;Picles:25","Frango"],
["Frango Grelhado","Filé de frango grelhado:150;Tomate:40;Alface:25;Queijo prato:35","Frango"],
["Frango Bacon","Filé de frango grelhado:145;Bacon:65;Queijo cheddar:35","Frango"],
["Vegetariano de Grão-de-bico","Hambúrguer de grão-de-bico:150;Tomate:40;Alface:30;Molho especial:25","Vegetarianos"],
["Vegetariano de Cogumelos","Hambúrguer de cogumelos:150;Rúcula:25;Queijo prato:35;Maionese:25","Vegetarianos"],
["Caprese","Muçarela de búfala:75;Tomate:60;Manjericão fresco:10;Molho pesto:20","Artesanais"],
["Bacon Egg","Bacon:65;Ovo:60;Queijo cheddar:35;Maionese:20","Clássicos"],
["Tropical","Abacaxi grelhado:85;Queijo prato:35;Bacon:60;Molho especial:25","Especiais"],
["Trufado","Champignon:80;Queijo prato:40;Maionese trufada:30;Cebola caramelizada:35","Premium"]
];
const D=[
["Hot Dog Tradicional","Molho de tomate:70;Batata palha:35;Milho verde:35;Ervilha:25;Mostarda:15;Ketchup:15","Clássicos"],
["Hot Dog Completo","Molho de tomate:80;Purê de batata:95;Milho verde:30;Ervilha:25;Batata palha:35;Vinagrete:40;Maionese:25","Clássicos"],
["Hot Dog Prensado","Muçarela:45;Presunto:35;Molho de tomate:70;Batata palha:25","Prensados"],
["Hot Dog Duplo","Salsicha:70;Molho de tomate:80;Batata palha:35;Milho verde:30","Clássicos"],
["Hot Dog com Purê","Purê de batata:130;Molho de tomate:70;Batata palha:25","Clássicos"],
["Hot Dog Bacon","Bacon:75;Muçarela:40;Molho de tomate:70;Batata palha:30","Especiais"],
["Hot Dog Cheddar","Cheddar cremoso:90;Bacon:50;Cebola crispy:25","Especiais"],
["Hot Dog Calabresa","Calabresa fatiada:80;Muçarela:40;Molho de tomate:65","Especiais"],
["Hot Dog Frango","Frango desfiado:105;Requeijão cremoso:60;Milho verde:30","Especiais"],
["Hot Dog Requeijão","Requeijão cremoso:75;Muçarela:40;Milho verde:30;Batata palha:30","Especiais"],
["Hot Dog Quatro Queijos","Muçarela:25;Provolone:25;Queijo prato:25;Requeijão cremoso:45","Especiais"],
["Hot Dog Barbecue","Molho barbecue:55;Bacon:60;Cebola caramelizada:45","Especiais"],
["Hot Dog Picante","Molho picante:30;Pimenta jalapeño:30;Muçarela:40;Molho de tomate:70","Especiais"],
["Hot Dog Vinagrete","Vinagrete:110;Batata palha:35;Maionese:25","Clássicos"],
["Hot Dog Paulista","Purê de batata:100;Vinagrete:55;Batata palha:35;Milho verde:25;Ervilha:25","Regionais"],
["Hot Dog Gaúcho","Chucrute:70;Mostarda:30;Maionese:25;Molho de tomate:60","Regionais"],
["Hot Dog Carioca","Ovo de codorna:45;Vinagrete:45;Batata palha:35;Maionese:25","Regionais"],
["Hot Dog Vegetariano","Salsicha vegetal:75;Milho verde:30;Ervilha:20;Vinagrete:55;Batata palha:30","Vegetarianos"],
["Hot Dog Premium","Salsicha artesanal:100;Queijo cheddar:45;Bacon:55;Cebola caramelizada:50","Premium"],
["Hot Dog da Casa","Requeijão cremoso:65;Bacon:50;Milho verde:35;Batata palha:30;Molho especial:30","Especiais"]
];
function slug(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function parse(s){return String(s).split(";").filter(Boolean).map(x=>{const i=x.lastIndexOf(":");return [x.slice(0,i),Number(x.slice(i+1))]})}
const SPECIAL_BURGERS=new Set(["Costela Desfiada","Pulled Pork","Frango Crispy","Frango Grelhado","Frango Bacon",
 "Vegetariano de Grão-de-bico","Vegetariano de Cogumelos","Picanha"]);
function make(type,list){
 const prefix={pizzaria:"pz",hamburgueria:"hb",hotdog:"hd"}[type];
 const used=new Map(),recipes=[];
 for(let k=0;k<list.length;k++){
  const [name,raw,category]=list[k],extras=parse(raw),sweet=type==="pizzaria"&&category==="Doces";
  const base=type==="pizzaria"?
    (sweet?[["Massa para pizza aberta",290]]:[["Massa para pizza aberta",290],["Molho de tomate temperado",85],["Muçarela",145]]):
   type==="hamburgueria"?[["Pão para hambúrguer",85],...(SPECIAL_BURGERS.has(name)?[]:[["Hambúrguer bovino",150]]),["Sal",2]]:
   [["Pão para hot dog",85],...(name==="Hot Dog Vegetariano"?[]:[["Salsicha",75]])];
  const items=[...base,...extras].map(([ingredient,g])=>{
   const id=prefix+"-in-"+slug(ingredient);
   if(!used.has(id))used.set(id,{id,name:ingredient,category:"Insumo",price:0,purchasePrice:0,
     yield:100,stock:0,minimum:0,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",
     source:"Preencha o preço e a quantidade reais da sua compra",imageUrl:"",templateOrigin:type});
   return {id,g};
  });
  const names=extras.map(x=>x[0]).join(", ");
  const steps=type==="pizzaria"?
   ["Para uma pizza média (aprox. 30–35 cm), abra 290 g de massa preparada sobre bancada higienizada e enfarinhada.",
     sweet?"Distribua o recheio doce sobre a massa pré-assada e finalize conforme o ingrediente escolhido.":
     "Espalhe cerca de 85 g de molho de tomate e 145 g de muçarela, ajustando para o padrão da casa.",
     "Distribua os ingredientes deste sabor, pesando cada um na quantidade indicada: "+names+".",
     "Asse em forno pré-aquecido conforme a ficha da massa e o equipamento; monitore a cocção e evite queimar bordas.",
     "Confira tamanho, peso, apresentação, alergênicos e embalagem antes de servir ou despachar."]:
   type==="hamburgueria"?
    ["Separe os ingredientes pesados para uma unidade e higienize bancada, utensílios e vegetais.",
     "Prepare o disco de carne ou a proteína indicada na receita, com manipulação segura e cocção completa conforme o produto.",
     "Sele ou aqueça as faces internas do pão sem ressecar e prepare os acompanhamentos: "+names+".",
     "Monte o hambúrguer com os ingredientes nas quantidades indicadas e finalize com os molhos.",
     "Confira o peso, identificação de alergênicos e serviço imediato; mantenha a temperatura adequada no delivery."]:
    ["Higienize a estação de preparo e separe pão, salsicha e acompanhamentos nas quantidades da ficha.",
     "Aqueça/cozinhe a salsicha ou alternativa vegetal conforme as instruções do fabricante; prepare o molho em utensílio separado.",
     "Aqueça o pão e prepare os recheios deste sabor: "+names+".",
     "Monte o hot dog por camadas, mantendo itens crocantes para o final; se for prensado, aqueça na chapa até o queijo derreter.",
     "Confira peso, embalagem, temperatura e identificação de alergênicos antes do serviço."];
  recipes.push({id:prefix+"-"+String(k+1).padStart(2,"0"),name,category,tagline:"Receita-modelo de "+type+" — ajuste à operação e ao gosto dos seus clientes.",
   difficulty:"Fácil",time:type==="pizzaria"?35:type==="hamburgueria"?20:15,
   items,steps,featured:k<6,imageUrl:"./assets/generic/business-"+type+".svg",
   pricingMode:"gain",targetGainPct:100,templateOrigin:type,businessUniverse:type,
   modelRecipe:true,pricingReady:false});
 }
 return {recipes,ingredients:[...used.values()]};
}
window.POTE_UNIVERSE_TEMPLATES={
 pizzaria:make("pizzaria",P),hamburgueria:make("hamburgueria",H),hotdog:make("hotdog",D),
 lancheria:{recipes:[],ingredients:[]},
 stats:{pizzaPicks:30,burgerPicks:30,hotdogPicks:20}
};
})();