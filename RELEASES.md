# Saker 0.1.0

Primeira distribuição privada do Saker IDE para Windows de 64 bits.

## Nesta versão

- Interface com identidade visual do Saker e organização de projetos.
- Terminais para trabalhar com agentes de IA.
- Saker Brain com notas persistentes, grafo de arquivos e referências.
- Exportação/importação compacta do Brain entre computadores.
- Gerenciamento de provedores compatíveis e visualização do saldo de uso.
- Ditado por voz para o terminal/campo ativo, após configurar o microfone e um modelo compatível.
- Código-fonte organizado e atalhos para desenvolvimento e build local.

## Instalação

Baixe `saker-windows-setup.exe` nos assets da release e execute no Windows x64.

- Tamanho: **195.034.148 bytes** (aproximadamente 186 MiB).
- SHA-256: `dd44983bd7233e0624db6db9b9e2306a8cf19f44b9014fe98329b84b22f61514`.
- O arquivo `.sha256` também acompanha a release.

## Validação

Build gerada em 17/11/2026. Checagens de tipos, compilação, verificações do CLI, pacote web/mobile, ConPTY, daemon e plugins concluídas. A verificação do conteúdo compactado do instalador passou. A instalação em outro Windows ainda exige teste manual.

## Observações

- O instalador não tem assinatura digital do Saker.
- O repositório e esta release são privados; o download pelo GitHub exige acesso ao repositório.
- A build local não inclui o template opcional de implantação de servidor remoto via SSH (`orcad-template`).
- As novas versões são instaladas manualmente; o atualizador automático não está configurado para este repositório privado.
- A memória do Brain depende das instruções/integrações ativadas; não há garantia de captura automática de toda conversa em qualquer CLI.

A licença MIT e os avisos de autoria do projeto original foram preservados.
