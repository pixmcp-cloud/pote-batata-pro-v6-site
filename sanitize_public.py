#!/usr/bin/env python3
"""Sanitize public V6 showcase. This does not implement authentication."""
from pathlib import Path
import re
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'public/index.html')
s=p.read_text(encoding='utf-8')
orig=s
switch=r'<div class="switch" role="group" aria-label="Escolha o perfil de teste">.*?</div>'
s,n=re.subn(switch,'<div class="switch" role="group" aria-label="Versão de demonstração"><span style="font-weight:800;font-size:12px;color:#e5ab51">DEMONSTRAÇÃO FREE</span></div>',s,count=1,flags=re.S)
if n!=1: raise SystemExit('Seletor de perfis não encontrado; publicação cancelada')
old="function pro(){return state.mode!=='free'}\nfunction master(){return state.mode==='adm'}"
if old not in s: raise SystemExit('Controle de modos não encontrado')
s=s.replace(old,"function pro(){return false} function master(){return false}",1)
old="function setMode(m){if(!['free','pro','adm'].includes(m))return;state.mode=m;persist();render();toast('Perfil de teste: '+m.toUpperCase())}"
if old not in s: raise SystemExit('Troca de modo não encontrada')
s=s.replace(old,"function setMode(m){state.mode='free';persist();render();toast('Demonstração FREE apenas.')}",1)
old="for(const m of ['free','pro','adm'])document.getElementById(m+'Btn').classList.toggle('active',m===state.mode);"
if old not in s: raise SystemExit('Renderização de modos não encontrada')
s=s.replace(old,"",1)
old="function render(){window.POTE_EXIT?.beforeRender?.(state);document.body.classList.toggle('admin-mode',master());"
if old not in s: raise SystemExit('Renderização principal não encontrada')
s=s.replace(old,"function render(){window.POTE_EXIT?.beforeRender?.(state);state.mode='free';document.body.classList.toggle('admin-mode',false);",1)
s=s.replace('LABORATÓRIO V6 • OPERAÇÃO COMPLETA + VITRINE','V6 • DEMONSTRAÇÃO FREE')
s=s.replace('</head>', '<meta name="robots" content="noindex,nofollow,noarchive"></head>', 1)
s=s.replace('🧪 Todos os perfis são simulações. Os dados ficam somente neste aparelho.','🔒 Demonstração gratuita: dados salvos apenas neste aparelho. Sem login Google ou permissões reais nesta versão.')
s=s.replace("'\n'","'\\n'")
s=s.replace("obs?'\n*Obs:* '+obs:''","obs?'\\n*Obs:* '+obs:''")
if orig==s or 'id="admBtn"' in s or 'id="proBtn"' in s:
    raise SystemExit('Sanitização incompleta')
p.write_text(s,encoding='utf-8')
print('Demonstração FREE sanitizada:',len(s),'caracteres.')
