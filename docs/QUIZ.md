# Quiz dos Papais — guia da organizadora e de publicação

## Endereços

| Página | Endereço | Login |
|---|---|---|
| Quiz (convidados) | <https://cha-da-alana.vercel.app/quiz> | não |
| **Ranking ao vivo** | <https://cha-da-alana.vercel.app/quiz/ao-vivo> | não |
| Ranking ao vivo, modo televisão | <https://cha-da-alana.vercel.app/quiz/ao-vivo?tv=1> | não |
| Ranking final | <https://cha-da-alana.vercel.app/quiz/ranking> | não |
| Tela do QR Code | <https://cha-da-alana.vercel.app/quiz/qr> | não |
| Painel | <https://cha-da-alana.vercel.app/admin/quiz> | sim |

Para forçar um idioma numa tela, acrescente `?lang=es` ou `?lang=pt` (na televisão: `?tv=1&lang=es`).

## Publicar (uma vez só)

Faça nesta ordem. Enquanto a migração não for executada, o convite continua normal e a seção Brincadeiras simplesmente não aparece.

1. **Banco:** no Supabase, abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/migrations/20261123000000_quiz.sql`](../supabase/migrations/20261123000000_quiz.sql) e clique em **Run**.
   A migração é aditiva: só cria objetos `quiz_*`, não altera nem apaga nada, e pode ser rodada de novo.
2. **Código:** junte a branch `quiz-dos-papais` na `main` e faça o push. A Vercel publica sozinha.

   ```bash
   git switch main
   ```

   ```bash
   git merge quiz-dos-papais
   ```

   ```bash
   git push
   ```

3. **Variáveis de ambiente:** nenhuma nova. O quiz usa as que já existem (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `SESSION_SECRET` e `SITE_URL`, que define o endereço do QR Code e dos links).
4. **Conta da organizadora** (se ela ainda não tiver acesso ao painel):

   ```bash
   node --env-file=.env.production.local scripts/create-admin.mjs email-da-irma@exemplo.com "Nome dela"
   ```

   Essa conta enxerga o painel inteiro, não só o quiz.

## Antes da festa

1. **Perguntas** (`/admin/quiz/perguntas`): as 20 sugestões já vêm cadastradas, em português e espanhol.
   Dá para criar, editar, traduzir, duplicar, reordenar (↑ ↓), desativar e excluir, e mudar os pontos de cada uma.
2. **Gabarito:** em cada pergunta, toque na alternativa correta (fica verde com ✓). Nenhuma vem marcada.
   O botão **Abrir Quiz** só libera quando todas as perguntas ativas tiverem resposta.
3. **Desempate** (`/admin/quiz/desempate`): escolha menor tempo, perguntas extras ou empate permitido. A regra trava ao abrir.
4. **Ajustes** (`/admin/quiz/ajustes`): textos em PT/ES, o que acontece ao encerrar, uma ou várias pessoas por aparelho.
5. **Ensaio:** abra, responda com alguns celulares, encerre e publique. Depois use **Ajustes → Zerar participações**
   (digite `ZERAR`): apaga só as participações do quiz e volta para rascunho.
6. **QR Code** (`/admin/quiz/divulgar`): baixe o PNG, baixe o cartaz A4 em PDF, copie o link ou exiba em tela cheia.

## No dia

1. `/admin/quiz` → **Abrir Quiz**.
2. Mostre o QR Code (`/quiz/qr`) na televisão ou no cartaz impresso.
3. Os convidados digitam o nome e tocam nas respostas. Tudo é salvo sozinho, sem botão de enviar.
4. Acompanhe em **Visão geral** e **Participantes** (atualizam sozinhos).
5. **Ranking ao vivo** → ligue **Transmissão ativada** e use **Exibir na televisão**. Na TV, clique em **Tela cheia**.
   - *Ocultar classificação temporariamente* mostra uma tela de suspense.
   - Com o ranking visível durante o quiz, alguém pode deduzir respostas vendo quando a própria pontuação sobe. Se isso incomodar, deixe oculto até o fim.
   - **Modo misterioso** (na mesma tela): os primeiros colocados ficam trocando de lugar, sempre próximos, e os pontos viram "???".
     A ordem mostrada é só suspense; a verdadeira fica em **Visão geral**. Ao desligar (ou ao publicar), as telas fazem 3, 2, 1 e revelam.
6. **Encerrar Quiz**. A televisão avisa que a brincadeira terminou e mostra só quem concluiu.
7. Se a regra for *perguntas extras* e houver empate: em **Desempate**, marque as perguntas, clique em **Iniciar rodada** e depois em **Encerrar rodada**.
8. **Publicar Resultados**. A televisão revela 3º, 2º e 1º com chuva de corações, e `/quiz/ranking` é liberado. **Ocultar Resultados** desfaz.

### Se algo der errado

- **Participação repetida:** em **Participantes**, use o filtro *Possíveis duplicidades* e **Invalidar** (dá para restaurar).
- **Nome impróprio na TV:** abra o participante e renomeie ou invalide.
- **Gabarito errado descoberto tarde:** encerre, corrija em **Perguntas** e as pontuações são recalculadas.
- **Convidado fechou o site no meio:** ao abrir de novo no mesmo navegador, continua na pergunta em que parou, sem digitar o nome.
- **Convidado já respondeu:** ao voltar, vê "Você já respondeu este quiz!" e o botão do ranking (se a transmissão estiver ligada).
- **Sem voltar:** a primeira resposta vale. Não há botão de voltar e o servidor recusa trocas.
- **Convidado sem internet:** a resposta fica guardada no aparelho e é reenviada. Ele não avança até salvar.

## Como funciona por dentro

- **Banco:** 10 tabelas `quiz_*` (configurações, perguntas, alternativas, gabarito, participantes, respostas, rodadas e seus
  participantes/perguntas, resultado final) e funções SQL. O histórico administrativo usa a tabela `audit_log` que já existia.
- **Segurança:** RLS ligado e sem políticas, então a chave pública não lê nada; as funções só rodam com a chave secreta do servidor.
  O gabarito fica em tabela separada e nenhuma resposta pública o contém. A resposta ao convidado é idêntica acertando ou errando.
- **Pontuação e tempo:** calculados no Postgres, na mesma transação da resposta, com travas contra toques simultâneos.
- **Sessão do convidado:** token aleatório em cookie `httpOnly`; o banco guarda só o hash. Não há cadastro nem dados além do nome.
- **Ranking ao vivo:** consulta curta a cada 2–3 s, com ETag e cache de 1 s na CDN, pausada com a aba escondida. Foi preferida ao
  Supabase Realtime porque aquele exigiria dar leitura pública às tabelas.
- **Limites:** 200 perguntas, 8 alternativas, 200 inícios por IP a cada 10 min (a festa toda usa o mesmo Wi-Fi), 120 respostas por minuto por pessoa.
- **Desenvolvimento e testes sem Supabase:** usam um Postgres embutido (PGlite) com a mesma migração.
