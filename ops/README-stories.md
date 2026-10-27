# Stories diários do Instagram (NoClickCerto) — como ligar

Estado em 27/10/2026: gerador pronto, **postagem DESLIGADA** até o Stefano aprovar as 2 primeiras artes.

- Artes do dia: `bun scripts/stories-diarios.mjs [AAAA-MM-DD]` → SSD
  `01-NoClickCerto/Marca e Artes/Stories Catalogo/AAAA-MM/AAAA-MM-DD-storyN-CODIGO.png`
- Ensaio de postagem (não publica): `bun scripts/postar-story.mjs AAAA-MM-DD 1`

## Para ligar (depois do OK do Stefano)
1. Credenciais (o Stefano preenche; ninguém cola token em chat):
   `~/Library/NCK/stories/.env` com `NCK_IG_USER_ID=` e `NCK_IG_TOKEN=` do app Instagram do
   NoClickCerto (o mesmo que o WaveFlow usa no Direct; precisa da permissão
   `instagram_business_content_publish`). `chmod 600` no arquivo.
2. Trava: `touch ~/Library/NCK/stories/LIGADO` (apagar o arquivo desliga na hora).
3. Agendamento 11h (story 1) e 18h (story 2):
   `cp ops/com.noclickcerto.stories.plist ~/Library/LaunchAgents/` e
   `launchctl load ~/Library/LaunchAgents/com.noclickcerto.stories.plist`.
   Log: `~/Library/NCK/stories/stories.log`.

## Pendente
- Lista de bairros/regiões com entrega grátis em Ubatuba (hoje a arte diz só "Entrega grátis em Ubatuba";
  quando vier a lista, muda `ENTREGA` em `scripts/stories-diarios.mjs`).
- O SSD precisa estar montado às 11h (as artes nascem lá).
