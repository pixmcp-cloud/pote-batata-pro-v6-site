# Laboratório Potê Batata Pro no Dyad

Preparado para importar a interface original **sem conexão de escrita com produção**.

## Como executar
1. Necessários: Node.js, Python 3 e Git já presentes no PC.
2. Antes da primeira prévia: `python build_hosting.py`; gera `public/`.
3. Rodar `npm run dev` no diretório raiz. Abrir `http://127.0.0.1:5173` no navegador/Dyad.
4. Rodar `npm run test:dyad` para testar isolamento HTTP, CSP, erros e arquivos.
5. Importar a pasta raiz pelo botão **Import App → Local folder** no Dyad.
6. Regras obrigatórias no arquivo `AI_RULES.md`.

## Como os serviços são usados
- **GitHub:** fonte e versionamento. Trabalhar apenas na branch `feat/dyad-development-lab-20261119`.
- **Firebase Hosting:** hospeda o verdadeiro `pdv.livresom.com`; não é tocado.
- **Cloud Firestore:** banco comercial `potobatata-b71f3`; esta prévia não pode usá-lo.
- **Cloudflare Workers:** em homologação, escrita desativada.
- **Dyad:** IDE e prévia local. Não é backend e não substitui o Firestore.

## Modo de demonstração sem risco
O servidor `dyad/dev-server.mjs` serve apenas arquivos de `public/` e emite o cabeçalho `X-Pote-Lab: readonly-offline`, CSP com `connect-src 'self'`, `form-action 'self'` e `Cache-Control: no-store`. Rejeita métodos de escrita e caminhos fora da pasta gerada. A tela de login e a interface visual são carregadas, mas **não é possível autenticar ou concluir vendas reais nesse laboratório**. Para testes operacionais, usar Firebase Emulator e contas fictícias. Não remover essas proteções para tentar logar em produção.

Nunca editar `public/` como fonte; ela é gerada por `python build_hosting.py`.
