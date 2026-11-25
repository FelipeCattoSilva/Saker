# Como desenvolver o Saker

Os atalhos desta pasta ajudam a preparar o ambiente, abrir o código e gerar o instalador para Windows.

## Usar no Windows

1. Execute **Preparar Saker.bat** na primeira vez ou depois de atualizar dependências. Ele instala as versões fixadas nos dois lockfiles, inclusive o cliente mobile usado pelo build desktop.
2. Execute **Abrir Codigo Saker.bat** para abrir no VS Code. Se ele não estiver disponível, a pasta abre no Explorer; abra-a no editor de sua preferência.
3. Execute **Iniciar Saker Dev.bat** para testar as alterações. Encerre com Ctrl+C no terminal. Feche a instância antiga antes de abrir esta cópia: o atalho mantém o mesmo perfil local do Saker para conservar seus projetos e preferências.
4. Execute **Gerar Instalador Saker.bat** para compilar os auxiliares Windows, validar tipos e gerar o instalador. O processo para no primeiro erro e não publica nada.
5. Envie aos amigos somente **dist/saker-windows-setup.exe**. A pasta inteira contém o código para desenvolvimento.

A primeira instalação e o primeiro build podem demorar e precisam de internet para baixar ferramentas e dependências. Não mova a pasta enquanto um build ou a IDE de desenvolvimento estiver rodando. Depois de mover ou copiar para outro PC, execute novamente o preparador.

## Ferramentas necessárias

- Node.js **24** e npm/npx: https://nodejs.org/
- Git para Windows: https://git-scm.com/download/win
- Python 3 e Visual Studio Build Tools com **Desenvolvimento para desktop com C++**, MSVC e Windows SDK (necessários para módulos nativos): https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Rust com toolchain **MSVC**, usado pelos auxiliares Windows: https://rustup.rs/

O preparador usa pnpm **12.14.0** por npx. O projeto fixa a versão do Bun em `config/.bun-version`; o pacote local é instalado pelas dependências. Não é preciso trocar o Bun global para usar o pacote local. Consulte também `.github/CONTRIBUTING.md` e `docs/development.md` para detalhes técnicos.

## Onde editar

- `src/renderer/src`: telas, componentes, traduções e estilos.
- `src/main`: backend Electron, Brain, arquivos e integrações.
- `src/preload` e `src/shared`: comunicação e contratos compartilhados.
- `resources`: ícones e recursos do aplicativo.
- `config/electron-builder.config.cjs`: empacotamento do instalador.
- `package.json` e `pnpm-lock.yaml`: scripts e dependências.

Os nomes técnicos internos `orca` e `@orca/*` ainda são usados por módulos e comandos compatíveis. Não substitua todos de uma vez: isso pode quebrar imports, autenticação, scripts e builds. A licença original foi preservada em `LICENSE`.

## GitHub privado

Este projeto está preparado para o repositório privado `FelipeCattoSilva/Saker`. O Git local preserva o código e o histórico das alterações; os instaladores são distribuídos pelas releases.

A pasta de trabalho continua sendo `Desktop\Saker`. Veja [PUBLICAR-NO-GITHUB.md](PUBLICAR-NO-GITHUB.md) para enviar alterações e publicar uma nova versão.

Os workflows originais foram preservados em `.github/workflows-upstream`, fora da pasta ativa de workflows. Dependências, builds e credenciais locais ficam fora do Git. O Brain e os logins usados pela IDE são dados locais separados; use a exportação do Brain para transportá-lo.

## Comandos equivalentes

```powershell
npx --yes pnpm@12.14.0 install --frozen-lockfile
npx --yes pnpm@12.14.0 -C mobile install --frozen-lockfile
npx --yes pnpm@12.14.0 dev --worktree-profile
npx --yes pnpm@12.14.0 run build:native
npx --yes pnpm@12.14.0 run build:win --publish never
```

A build local não inclui o template opcional de implantação do servidor remoto via SSH (`orcad-template`); essa distribuição exige preparação separada.

O instalador local não usa assinatura digital de um editor. Antes de distribuir uma versão, instale-a em um Windows de teste e confira abertura, terminal, Brain e ícone. O resultado desta preparação e as verificações executadas ficam em `PREPARACAO-Saker.md`.
