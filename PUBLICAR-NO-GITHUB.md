# Publicar uma atualização do Saker

Repositório privado: https://github.com/FelipeCattoSilva/Saker

## 1. Editar e testar

Trabalhe na pasta `Desktop\Saker`. Abra `Iniciar Saker Dev.bat`, teste suas alterações e feche a instância de desenvolvimento antes de gerar a versão de distribuição.

## 2. Gerar o instalador

Atualize a versão em `package.json` quando for lançar uma nova versão (por exemplo, de `0.1.0` para `0.1.1`). Mantenha as versões relacionadas e lockfiles consistentes se alterar dependências.

Execute `Gerar Instalador Saker.bat`. O resultado será `dist/saker-windows-setup.exe`. Instale e teste a versão em um Windows de teste antes de compartilhar.

Gere um checksum atualizado no PowerShell:

```powershell
$installerHash = (Get-FileHash -LiteralPath .\dist\saker-windows-setup.exe -Algorithm SHA256).Hash.ToLowerInvariant()
"$installerHash  saker-windows-setup.exe" | Set-Content -LiteralPath .\dist\saker-windows-setup.exe.sha256 -Encoding ascii
```

Não reutilize o checksum de uma build anterior.

## 3. Enviar o código

Confira os arquivos antes de adicioná-los. No exemplo, troque `README.md` pelos arquivos que você revisou. Credenciais, `.env`, perfis e backups do Brain ficam fora do commit.

```powershell
git status
git diff
git add -- README.md
git commit -m "Preparar versão 0.1.1"
git push origin main
```

Siga também os checks do projeto em `AGENTS.md`. O instalador e as dependências ficam fora do Git, conforme `.gitignore`.

## 4. Criar a release

1. Abra https://github.com/FelipeCattoSilva/Saker/releases/new.
2. Crie uma tag nova, por exemplo `v0.1.1`, apontando para o commit correto da branch `main`.
3. Escreva as mudanças da versão.
4. Anexe `dist/saker-windows-setup.exe` e o checksum `.sha256` atualizado.
5. Publique a release. Como o repositório é privado, a release também será privada.

Se já distribuiu o instalador, crie uma nova versão com uma nova tag.

## Compartilhar com amigos

Quem tiver acesso ao repositório pode baixar a release e também consultar o código-fonte. Para compartilhar somente o aplicativo, envie o `.exe` diretamente ou por um canal de distribuição separado. O link de uma release privada exige acesso ao repositório.

O atualizador automático não está configurado para usar este repositório privado. Por enquanto, baixe e instale as novas versões manualmente.
