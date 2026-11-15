# Potê Batata Pro V6

Publicação gratuita com GitHub Pages.

- `/index.html`: demonstração FREE sem login (continua disponível).
- `/beta.html`: versão beta com **login Google real**, perfis ADM/FREE e estado sincronizado no Firestore.
- Firebase projeto: `potobatata-b71f3` (PotoBatata).
- Administrador reservado: `pixmcp@gmail.com` (identidade Google verificada nas regras do Firestore).
- Contato: contato@livresom.com | WhatsApp https://wa.me/5548999951729.

## Segurança e limites
A autenticação Google e as regras Firestore estão implantadas. Cada usuário tem seus próprios documentos, separados por UID; o administrador pode acessá-los para suporte. A versão beta ainda precisa ser testada por uma sessão Google real no navegador antes de substituir a V6 pública.

Funções PRO comerciais, faturamento, limites de licença seguros no servidor, pagamentos e migração de backups locais ainda estão pendentes. Não cobrar assinaturas usando esta versão.

## Implantação
`.github/workflows/deploy.yml` baixa a V6 original, prepara a demonstração com `sanitize_public.py` e `add_contacts.py`, e cria `beta.html` com `make_beta.py` + `firebase_integration.js`.

A política de dados está em `firestore.rules` e é implantada separadamente pelo Firebase CLI.
