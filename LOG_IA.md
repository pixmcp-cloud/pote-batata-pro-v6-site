# LOG IA — Índice permanente do laboratório de Inteligência Artificial

**Data de criação:** 19/11/2026  
**Comando para futuros chats:** "consulte Log IA no GitHub"  
**Arquivo canônico:** `LOG_IA.md` na branch `main` de `pixmcp-cloud/pote-batata-pro-v6-site`

> Este registro descreve **somente as IAs instaladas no computador Windows**. Não é o Log Mestre do aplicativo Potê Batata Pro. Os programas/modelos não são hospedados no GitHub. Nenhuma chave de API, arquivo de cliente, imagem facial ou amostra de voz deve ser publicada.
# Laboratório multimídia local — Potê Batata / LIVRESOM

Data: 19/11/2026. Computador: DESKTOP-9481JM1, RTX 4060 Laptop 8 GB, 16 GB RAM. Todas as instalações fora do sistema comercial. Nenhuma assinatura ou serviço pago contratado.

## Troca de rostos: FaceFusion

- Fonte oficial: https://github.com/facefusion/facefusion (release 3.9.2, commit decc6c9).
- Arquivos locais: `C:\Users\LIVRESOM\AI-Tools\FaceFusion`; venv Python 3.12.12.
- FFmpeg 7.0.2 oficial Gyan instalado por winget (recomendado nas instruções FaceFusion).
- onnxruntime-gpu 1.24.4; teste independente ONNX com `CUDAExecutionProvider` na RTX 4060 PASS. A DLL CUDA/cuDNN9 existente no venv CUDA do Chatterbox é fornecida pelo PATH temporário do launcher, sem duplicar o pacote de 2,4 GB.
- Atalho Desktop: `FaceFusion - Trocar Rostos.lnk` -> `AI-Tools\Iniciar-FaceFusion.cmd`.
- Estado do primeiro lançamento: FaceFusion 3.9.2 CLI PASS; modelos de detecção e troca baixados no primeiro uso; GUI e face swap com pessoa real precisam de validação final e permissão do titular da imagem.
- Licença FaceFusion: OpenRAIL-AS. Verificar obrigações de uso. Não habilitar conteúdo enganoso e não burlar controles do aplicativo.

## Foto para vídeo: ComfyUI + Wan 2.2 TI2V 5B GGUF Q5

- ComfyUI já estava em `C:\Users\LIVRESOM\ComfyUI`, CUDA com PyTorch 2.5.1.
- Plugin oficial comunitário `city96/ComfyUI-GGUF` instalado em `custom_nodes/ComfyUI-GGUF` (commit 6ea2651). `gguf` importou com sucesso.
- Quantização `unsloth/Wan2.2-TI2V-5B-GGUF`, arquivo `Wan2.2-TI2V-5B-Q5_K_M.gguf`, SHA-256 `4424633a876511b9be58a41119f7c9d762ea92b3cb74649cdb43cac850e42dba`; arquivo completo no ComfyUI `models/diffusion_models`.
- VAE oficial Comfy-Org `wan2.2_vae.safetensors`, SHA-256 `e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156`; arquivo completo no ComfyUI `models/vae`.
- Codificador de texto oficial Comfy-Org `umt5_xxl_fp8_e4m3fn_scaled.safetensors`, esperado SHA-256 `c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68` (download iniciado, confirmar conclusão antes de declarar modelo operacional).
- Workflows derivados do template oficial Comfy-Org: `tooling/comfyui/workflows/Wan22_5B_Q5_Foto_Para_Video_9x16.json` e `...16x9.json`. Nó de entrada de foto ativado; resolução de teste 288x512/512x288 e 49 quadros, 16 fps, adequado a testes com VRAM limitada. Arquivo de imagem sintética para teste incluído em `tooling/comfyui/fixtures/`; a foto real deve ser inserida pelo usuário com autorização.
- Atalho Desktop: `ComfyUI - Gerador de Videos.lnk` -> `AI-Tools\Iniciar-ComfyUI-Video.cmd`, escutando somente em 127.0.0.1:8188, `--lowvram`.
- Pesos Wan2.2 sob Apache 2.0 conforme Hugging Face; uso comercial depende também de direitos sobre as imagens utilizadas.

## Clonagem de voz PT-BR: Chatterbox Multilingual V3 e Applio

- Applio v3.6.2 existente em `C:\ApplioV3.6.2`, com modelos RVC preexistentes; nenhum modelo de voz de terceiro foi usado neste laboratório.
- Chatterbox de https://github.com/resemble-ai/chatterbox, clone commit ab55923, `C:\Users\LIVRESOM\AI-Tools\Chatterbox`, venv Python 3.11.14, Torch/torchaudio 2.6.0+cu124 com GPU RTX 4060.
- Chatterbox v0.1.7 instalado com dependências isoladas; seis arquivos oficiais de `ResembleAI/chatterbox` para Multilingual V3 baixados (aprox. 3 GB). Suporte português `language_id=pt`.
- **Geração de voz sintética de teste validada em GPU**: 3,2 segundos, 24kHz WAV em `C:\Users\LIVRESOM\AI-Tools\Chatterbox\TESTE_VOZ_SINTETICA_PTBR.wav`. Não foi gerado clone de voz real, pois não foi fornecida gravação autorizada.
- Atalho Desktop: `Chatterbox - Clonar Voz PTBR.lnk` -> `AI-Tools\Iniciar-Chatterbox-PTBR.cmd`, Gradio local `127.0.0.1:7862`, modelo V3 por padrão.
- Licença Chatterbox MIT; o projeto original está arquivado desde agosto/2026. Modelos de voz não garantem perfeição e uso da identidade vocal de terceiros exige autorização.

## Integração Gemini API opcional no ComfyUI

- Arquivo de origem `tooling/comfyui/pote_gemini_bridge`; cópia instalada em `C:\Users\LIVRESOM\ComfyUI\custom_nodes\pote_gemini_bridge`.
- Adicionados nós de prompt (Hydrogen) e imagem (Gemini Flash Image) com `dry_run` ativado e bloqueios de API pagos por padrão. Chaves NÃO são salvas no GitHub nem no ComfyUI.
- Testes offline `python -m unittest discover -s tooling/comfyui/tests -p 'test_*.py'` — 5/5 PASS, sem chamadas HTTP.
- API de imagem do Google pode gerar cobrança; não ativar `POTE_GEMINI_IMAGE_ENABLED=1` sem autorização específica. O recurso offline Wan 2.2 não usa chave Gemini.

## Limitações e segurança

Este laboratório não altera `main`, Firebase, Cloudflare, Floot ou vendas reais. O Windows estava com menos de 2 GB de RAM livres em parte dos testes; operar **um modelo pesado por vez**, fechando outros aplicativos conscientemente, para evitar troca de memória e CUDA OOM. Não executar troca de rosto ou clonagem para fraude, sem consentimento ou de forma enganosa. Não publicar dados, arquivos de clientes ou credenciais. Testes GPU de FaceFusion, GUI Chatterbox e vídeo ComfyUI devem ser identificados individualmente como aprovados ou pendentes; downloads parciais não significam teste concluído.

## CHECKPOINT DE TESTES COMPLEMENTARES — 19/11/2026

- **FaceFusion:** GUI local **HTTP 200 em http://127.0.0.1:7860/**; modelo `nsfw_3.onnx` de 358.188.033 bytes baixado por retomada e validado por tamanho. Os detectores e modelo `hyperswap_1a_256.onnx` também foram baixados no primeiro uso. CUDAExecutionProvider testado com inferência ONNX. **Ainda não foi feita uma troca de rosto em vídeo de teste**. A sessão da interface foi encerrada para liberar memória.
- **Chatterbox V3:** **geração real PASS** na RTX 4060: WAV PT-BR 24 kHz, 3,2 s, 307.280 bytes em `C:\Users\LIVRESOM\AI-Tools\Chatterbox\TESTE_VOZ_SINTETICA_PTBR.wav`. Modelos oficiais baixados. **Não houve teste de clonagem com voz de referência nem da GUI**.
- **ComfyUI:** versão **0.3.76**, frontend **1.33.13**, Python **3.10.11**, PyTorch **2.5.1+cu121**, CUDA RTX 4060, modo LOW_VRAM. Inicialização mostrou `Starting server` e `http://127.0.0.1:8188`; plugins `ComfyUI-GGUF` e `pote_gemini_bridge` importaram. **Renderização de vídeo ainda não foi validada**.
- **Wan 2.2:** os **3 arquivos de modelo** foram baixados e **SHA-256 verificado** (GGUF 3.810.603.360 bytes; VAE 1.409.400.960 bytes; codificador de texto 6.735.906.897 bytes). Os workflows locais vertical 9:16 e horizontal 16:9 usam imagem de entrada ativada, 49 frames, 16 fps. Uma imagem sintética de teste foi gerada em `ComfyUI\input\pote_video_teste_sintetico.png`.
- **Gemini bridge opcional:** instalado em `ComfyUI\custom_nodes\pote_gemini_bridge`, **5/5 testes offline PASS**; API e custos **desativados por padrão**. Código de laboratório está no clone local `pote-batata-agent-lab-f35\tooling\comfyui`, mas a pasta `tooling/` estava **untracked**, portanto **não está comprovadamente publicada no GitHub**. Não há credenciais copiadas para o plugin.
- **Atalhos no Desktop:** `FaceFusion - Trocar Rostos.lnk`, `Chatterbox - Clonar Voz PTBR.lnk`, `ComfyUI - Gerador de Videos.lnk`. Os lançadores estão em `C:\Users\LIVRESOM\AI-Tools\Iniciar-*.cmd`.
- **Custos:** as ferramentas locais não exigem créditos por geração; não foram ativadas APIs pagas. Processar um modelo pesado por vez devido aos 16 GB RAM / 8 GB VRAM.
- **Segurança:** usar imagens e vozes de terceiros somente com autorização, sem fraude ou falsa atribuição.

## INSTRUÇÃO DE CONTINUIDADE ENTRE CHATS

Quando o usuário disser **"consulte Log IA no GitHub"**, **ler integralmente** este arquivo na branch `main` em:

https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/blob/main/LOG_IA.md

Rever os últimos checkpoints, validar o que foi realmente testado, continuar de onde parou e **atualizar este mesmo arquivo** após novas instalações/testes, com data e evidências. Não confundir com `POTE_BATATA_PRO_LOG_MESTRE.md`, que documenta o app comercial.