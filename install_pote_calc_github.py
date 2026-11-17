#!/usr/bin/env python3
"""Install Potê Calc Quantum PRO into the public GitHub Pages build, non-destructively.
Usage: python3 install_pote_calc_github.py /path/to/pote-batata-pro-v6-site
Run from the release bundle root (where calculator files reside).
Idempotent; refuses unknown repo layouts instead of overwriting app data.
"""
from pathlib import Path
import sys,shutil
source=Path(__file__).resolve().parent
repo=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
workflow=repo/'.github/workflows/deploy.yml'
beta=repo/'make_beta.py'
for file in (workflow,beta):
 if not file.is_file():raise SystemExit('Repositório inválido ou arquivo ausente: '+str(file))
files=['pote_calc_quantum_99_fullscreen.html','pote_calc_launcher.js','pote_calc_launcher.css','test_pote_calc_launcher.js']
for file in files:
 if not (source/file).is_file():raise SystemExit('Pacote incompleto: '+file)
workflow_text=workflow.read_text(encoding='utf8')
beta_text=beta.read_text(encoding='utf8')
# Preserve local changes. Verify all anchors before editing anything.
workflow_anchor='          cp -R assets/integrations public/assets/integrations\n'
python_check_anchor='          python3 -c \'import pathlib,re; s=pathlib.Path("public/index.html").read_text(); scripts='
if workflow_text.count(workflow_anchor)!=1:raise SystemExit('Não encontrei âncora única da publicação de assets')
if python_check_anchor not in workflow_text:raise SystemExit('Não encontrei a verificação da publicação GitHub')
beta_anchor='once("</body></html>", \'<link rel="stylesheet" href="./pdv_cash.css?v=pdv-20261116"'
if beta_anchor not in beta_text:raise SystemExit('Não encontrei a seção final de injeções de scripts no make_beta.py')
# Insert just before the title/validation lines, after all previous once() injections.
beta_insert='''# Calculadora independente: mesmo DOM no login FREE/PRO/ADM, sem escrita no Firestore.
once("</body></html>", '<link rel="stylesheet" href="./pote_calc_launcher.css?v=quantum-99-20261117"><script defer src="./pote_calc_launcher.js?v=quantum-99-20261117"></script></body></html>')
'''
marker='# Identidade neutra no login; conta mestre recupera a marca ao entrar.\n'
if beta_text.count(marker)!=1:raise SystemExit('Âncora beta final não encontrada')
if 'pote_calc_launcher.js' not in beta_text:beta_text=beta_text.replace(marker,beta_insert+marker,1)
workflow_insert='''          cp pote_calc_quantum_99_fullscreen.html public/pote_calc_quantum_99_fullscreen.html
          cp pote_calc_launcher.js public/pote_calc_launcher.js
          cp pote_calc_launcher.css public/pote_calc_launcher.css
          node --check public/pote_calc_launcher.js
          node test_pote_calc_launcher.js
'''
if 'cp pote_calc_quantum_99_fullscreen.html' not in workflow_text:workflow_text=workflow_text.replace(workflow_anchor,workflow_anchor+workflow_insert,1)
# Write dependency files first, then deployment updates.
for name in files:
 if (source/name).resolve()!=(repo/name).resolve():shutil.copyfile(source/name,repo/name)
beta.write_text(beta_text,encoding='utf8')
workflow.write_text(workflow_text,encoding='utf8')
print('Integração pronta:',repo)
print('Arquivos adicionados:',', '.join(files))
print('make_beta.py e .github/workflows/deploy.yml atualizados sem tocar em banco, pedidos ou estoque')
