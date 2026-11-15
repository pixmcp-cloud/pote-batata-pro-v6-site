#!/usr/bin/env python3
"""Incluir contatos na entrada do demonstrativo e no rodapé público."""
from pathlib import Path
import sys

file = Path(sys.argv[1] if len(sys.argv) > 1 else "public/index.html")
html = file.read_text(encoding="utf-8")
url = "https://wa.me/5548999951729"
email = "contato@livresom.com"
phone = "(48) 99995-1729"
links = (
    f'<a href="mailto:{email}" aria-label="Enviar e-mail para {email}">✉️ {email}</a>'
    f'<a href="{url}" target="_blank" rel="noopener noreferrer" '
    f'aria-label="Conversar pelo WhatsApp {phone}">💬 WhatsApp {phone}</a>'
)
banner = (
    '<section class="livresom-contact" aria-label="Contato e suporte">'
    '<div><strong>Contato e suporte</strong>'
    '<span>Precisa de ajuda com o Potê Batata Pro?</span></div>'
    f'<div class="livresom-links">{links}</div></section>'
)
footer = (
    '<div class="livresom-footer-contacts">'
    '<strong>Fale conosco</strong>'
    f'<div class="livresom-links">{links}</div></div>'
)
css = """
<style>
.livresom-contact{display:flex;align-items:center;justify-content:space-between;gap:14px;
  flex-wrap:wrap;padding:15px 18px;margin:0 0 18px;background:#21170e;
  border:1px solid #80552d;border-radius:15px}
.livresom-contact strong,.livresom-footer-contacts strong{display:block;color:#f6d5a0;font-size:14px}
.livresom-contact span{display:block;color:#cbbca6;font-size:12px;margin-top:3px}
.livresom-links{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.livresom-links a{color:#ffe0a6;text-decoration:none;border:1px solid #80603b;
  border-radius:10px;background:#302116;padding:10px 12px;font-weight:650;
  font-size:13px;display:inline-flex;align-items:center;min-height:40px;overflow-wrap:anywhere}
.livresom-links a:hover,.livresom-links a:focus-visible{background:#513219;outline:1px solid #e5ab51}
.livresom-footer-contacts{display:grid;justify-items:center;gap:10px;margin:0 auto 14px}
.livresom-footer-contacts .livresom-links{justify-content:center}
@media(max-width:580px){.livresom-contact{align-items:stretch}
  .livresom-contact .livresom-links{width:100%;flex-direction:column;align-items:stretch}
  .livresom-contact .livresom-links a{justify-content:center}}
</style>
"""
if html.count('<div class="foot">') != 1:
    raise SystemExit("Pontos de inserção não encontrados; cancelado")
if 'livresom-contact' in html:
    raise SystemExit("Contatos já inseridos; evitando duplicação")
html = html.replace("</head>", css + "</head>", 1)
html = html.replace('<div class="foot">', '<div class="foot">' + footer, 1)
assert html.count(f'href="{url}"') == 1
assert html.count(f'href="mailto:{email}"') == 1
file.write_text(html, encoding="utf-8")
print(f"Contatos inseridos somente no rodapé: {email} | {phone} | {url}")
