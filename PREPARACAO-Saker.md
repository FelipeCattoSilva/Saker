# Preparação local do Saker

Preparado em 17/11/2026. Origem: `C:\Users\troll\Desktop\Orca Source`. Destino: `C:\Users\troll\Desktop\Saker`.

- Copiados 35.284 arquivos existentes de código, recursos e documentação, incluindo as alterações locais e arquivos novos. Dependências e builds foram gerados novamente no destino.
- A pasta original foi preservada. O nome incorreto SAKIR foi corrigido para Saker.
- Git local iniciado na branch `main`, com commits locais. Nenhum remoto configurado e nenhum envio ao GitHub.
- Os workflows originais estão arquivados em `.github/workflows-upstream`. Não executam como GitHub Actions nesse local.
- Licença original preservada em `LICENSE`. README original preservado em `README-UPSTREAM.md`.
- Instaladas dependências da raiz e de `mobile` com pnpm 12.14.0 e lockfiles congelados. Bun local 1.4.4 disponível.
- Checagem completa de tipos passou: projetos com 17.082, 14.260, 14.115, 4.325 e 39 arquivos; checagem adicional do CLI passou com 4.229 arquivos.
- Compilados backend, preload, interface, CLI, relays WSL e pacote web/mobile.
- Verificação do CLI passou com 1.402 arquivos de dependências e cinco comandos.
- Pacote web/mobile validado: 17 rotas, 149 recursos, aproximadamente 13,6 MB.
- Auxiliares nativos Windows compilados com Rust. Verificações do pacote passaram para ConPTY, daemon, dois plugins e recursos do servidor web.

## Limites da validação

Esta preparação verifica compilação e integridade do pacote. O instalador ainda deve ser instalado e testado manualmente em outro Windows antes de uma distribuição ampla. A janela da IDE do usuário não foi fechada nem substituída.

A build local não contém o template opcional `orcad-template`, usado para implantação do servidor remoto via SSH. Não há certificado de assinatura digital do Saker configurado.

O log completo fica em `build-local.log` (ignorado pelo Git). O log contém uma primeira tentativa interrompida porque o repositório ainda não tinha um commit; o commit foi criado e a compilação retomada com sucesso nas etapas seguintes.

## Resultado do instalador

**Concluído com sucesso**: `dist/saker-windows-setup.exe` (Windows x64).

- Tamanho: 195,034,148 bytes, aproximadamente 186 MiB.
- Empacotador terminou com código de saída 0.
- Verificação 7-Zip do conteúdo incorporado passou: 8.286 arquivos, “Everything is Ok”. O leitor também identifica dados adicionais do invólucro executável NSIS.
- Produto no executável: **Saker**.
- Assinatura digital: **NotSigned**. Nenhuma instalação foi executada automaticamente.
- SHA-256: `dd44983bd7233e0624db6db9b9e2306a8cf19f44b9014fe98329b84b22f61514`.
- Checksum disponível também em `dist/saker-windows-setup.exe.sha256`.

Envie somente o instalador aos seus amigos. Para editar ou gerar novas versões, utilize os atalhos na raiz desta pasta.

## Publicação privada no GitHub

Em 18/11/2026, preparado o repositório privado `FelipeCattoSilva/Saker`, com o remoto `origin` conectado a esta pasta. A publicação inclui o código-fonte, o README e a release `v0.1.0` com o instalador de 17/11/2026 e seu checksum. A pasta `Desktop\Saker` continua sendo a pasta de trabalho para próximas alterações. Consulte `PUBLICAR-NO-GITHUB.md`.
