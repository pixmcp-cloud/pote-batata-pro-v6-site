// Núcleo puro do cardápio de demonstração. Valores monetários sempre em centavos.
// Não registra pedidos, não lê dados privados do PDV e não processa pagamentos.
export function money(cents) {
  const value = Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function validProduct(product) {
  return !!product && typeof product.id === "string" && !!product.id &&
    typeof product.title === "string" && product.title.length > 0 &&
    Number.isSafeInteger(product.priceCents) && product.priceCents >= 0 &&
    Array.isArray(product.addons || []);
}
export function optionsFor(product, ids) {
  const available = new Map((product.addons || []).map(a => [a.id, a]));
  const seen = new Set();
  return (Array.isArray(ids) ? ids : []).filter(id => {
    if (typeof id !== "string" || seen.has(id) || !available.has(id)) return false;
    seen.add(id);
    return true;
  });
}
export function itemUnitCents(product, ids) {
  if (!validProduct(product)) return 0;
  const selected = optionsFor(product, ids);
  const addons = selected.reduce((sum, id) => {
    const addon = product.addons.find(a => a.id === id);
    return sum + (Number.isSafeInteger(addon.priceCents) && addon.priceCents >= 0 ? addon.priceCents : 0);
  }, 0);
  return product.priceCents + addons;
}
export function makeLine(product, quantity, addonIds = [], note = "") {
  if (!validProduct(product)) throw new Error("Produto inválido");
  const qty = Math.max(1, Math.min(99, Math.trunc(Number(quantity) || 1)));
  const ids = optionsFor(product, addonIds).sort();
  return { id: product.id, quantity: qty, addonIds: ids, note: String(note || "").trim().slice(0, 220) };
}
export function lineKey(line) {
  return JSON.stringify([line.id, line.addonIds || [], line.note || ""]);
}
export function normalizeCart(raw, products) {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(products.filter(p=>validProduct(p)&&p.available!==false).map(p => [p.id, p]));
  const merged = new Map();
  for (const entry of raw.slice(0, 80)) {
    if (!entry || typeof entry.id !== "string" || !byId.has(entry.id)) continue;
    const product = byId.get(entry.id);
    const line = makeLine(product, entry.quantity, entry.addonIds, entry.note);
    const key = lineKey(line), previous = merged.get(key);
    merged.set(key, previous ? { ...line, quantity: Math.min(99, previous.quantity + line.quantity) } : line);
  }
  return [...merged.values()];
}
export function addLine(cart, line, products) {
  return normalizeCart([...cart, line], products);
}
export function cartTotals(cart, products) {
  const byId = new Map(products.filter(validProduct).map(p => [p.id, p]));
  let count = 0, subtotalCents = 0;
  for (const line of normalizeCart(cart, products)) {
    const product = byId.get(line.id);
    count += line.quantity;
    subtotalCents += itemUnitCents(product, line.addonIds) * line.quantity;
  }
  return { count, subtotalCents };
}
export function demoSummary({ cart, products, fulfillment, payment, customerName, customerPhone, address }) {
  const list = normalizeCart(cart, products);
  const byId = new Map(products.map(p => [p.id, p]));
  const rows = [
    "PRÉVIA DE CARDÁPIO — NÃO É UM PEDIDO REAL",
    "Produtos e valores fictícios para avaliação visual",
    "",
    "Itens:"
  ];
  for (const line of list) {
    const product = byId.get(line.id);
    rows.push(line.quantity + "x " + product.title + " — " + money(itemUnitCents(product, line.addonIds) * line.quantity));
    for (const id of line.addonIds) {
      const addon = product.addons.find(a => a.id === id);
      if (addon) rows.push("  + " + addon.label);
    }
    if (line.note) rows.push("  Obs.: " + line.note);
  }
  rows.push("", "Subtotal: " + money(cartTotals(list, products).subtotalCents));
  rows.push("Recebimento: " + (fulfillment === "entrega" ? "Entrega (taxa não calculada)" : "Retirada"));
  rows.push("Pagamento simulado: " + ({ pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" }[payment] || "Não informado"));
  if (customerName) rows.push("Nome: " + String(customerName).trim().slice(0, 80));
  if (customerPhone) rows.push("Telefone: " + String(customerPhone).trim().slice(0, 20));
  if (fulfillment === "entrega" && address) rows.push("Endereço: " + String(address).trim().slice(0, 220));
  rows.push("", "NÃO EFETUA VENDA • NÃO FAZ COBRANÇA • NÃO ENTRA NO PDV");
  return rows.join("\n");
}
