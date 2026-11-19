# Publicação do Chá da Alana

Este guia leva o site do computador até o endereço público, com custo inicial zero.
Faça na ordem. Nenhuma etapa contrata serviços pagos.

| Serviço | Plano | Custo | Observações |
|---|---|---|---|
| GitHub | Free | R$ 0 | Guarda o código (repositório **privado**). |
| Vercel | Hobby | R$ 0 | Uso pessoal e não comercial. Inclui HTTPS e 1 cron diário. |
| Supabase | Free | R$ 0 | Banco Postgres, login dos papais e arquivos. **Pausa após ~7 dias sem uso**, e o cron diário do projeto evita isso. |
| Domínio `.com.br` | opcional | R$ 40/ano no Registro.br (verificado em nov/2026) | Só se quiserem trocar `*.vercel.app` por um endereço próprio. |

> Disponibilidade verificada em 19/11/2026: `chadaalana.com.br` aparecia **livre** no Registro.br e `chadaalana.com` sem registro (RDAP), mas isso muda a qualquer momento. Confira de novo na hora de comprar. Nenhum domínio foi comprado.

---

## 1. Supabase (banco + login)

1. Crie uma conta em <https://supabase.com> e um projeto novo (região **South America (São Paulo)**). Guarde a senha do banco.
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/migrations/20261119000000_init.sql`](../supabase/migrations/20261119000000_init.sql) e clique em **Run**.
   O script cria as tabelas, as políticas RLS, o limitador de requisições e o bucket `media`.
3. Em **Project Settings → API Keys**, copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (ou `anon`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (ou `service_role`) → `SUPABASE_SECRET_KEY`. **Nunca** coloque essa chave no navegador, em prints ou no GitHub.
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**. Só as contas criadas pelo script abaixo entram no painel.
5. Crie as duas contas de administrador. No computador, crie um arquivo `.env.production.local` (já ignorado pelo Git) com as três variáveis acima e rode:

   ```bash
   node --env-file=.env.production.local scripts/create-admin.mjs mae@email.com "Mamãe"
   ```

   ```bash
   node --env-file=.env.production.local scripts/create-admin.mjs pai@email.com "Papai"
   ```

   O script mostra uma senha forte gerada para cada conta. Guardem num gerenciador de senhas. Para escolher a senha, passe-a como terceiro argumento (mínimo de 12 caracteres).

## 2. GitHub

1. Crie um repositório **privado** chamado `cha-da-alana`.
2. Na pasta do projeto:

   ```bash
   git remote add origin https://github.com/SEU_USUARIO/cha-da-alana.git
   ```

   ```bash
   git push -u origin main
   ```

## 3. Vercel (hospedagem)

1. Em <https://vercel.com>, entre com o GitHub e clique em **Add New → Project → Import** `cha-da-alana`.
2. Nome do projeto: `cha-da-alana`, que vira `https://cha-da-alana.vercel.app` se o nome estiver livre (em 19/11/2026 o endereço não estava em uso).
3. Em **Environment Variables**, cadastre:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | do passo 1.3 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | do passo 1.3 |
   | `SUPABASE_SECRET_KEY` | do passo 1.3 |
   | `SESSION_SECRET` | resultado de `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `CRON_SECRET` | outro valor gerado do mesmo jeito |
   | `SITE_URL` | `https://cha-da-alana.vercel.app` (ou o domínio próprio, depois) |

4. Clique em **Deploy**. O arquivo `vercel.json` já agenda o cron diário `/api/keepalive`, que mantém o Supabase ativo.
5. Teste: abra o site, entre em `/admin/login` com uma das contas, cadastre um convidado, abra o link pessoal numa aba anônima e confirme a presença. A confirmação deve aparecer em **Notificações**.

## 4. Primeiros ajustes no painel

- **Evento**: data, horário, prazo, local, WhatsApp do pai e da mãe, link da lista de enxoval.
- **Textos e visual**: envie a arte oficial da ursinha (PNG com fundo transparente), revise as mensagens e, se quiserem, envie uma música com direito de uso.
- **Presentes**: cadastre as sugestões simples (fraldas, lenços…).
- **Convidados**: cadastre cada pessoa ou família, copie o link pessoal ou use "Enviar no WhatsApp".

## 5. Domínio próprio (opcional)

1. Registre o domínio em <https://registro.br> (ou numa registradora credenciada). Isso **é uma compra**: decidam antes.
2. Na Vercel: **Project → Settings → Domains → Add** `chadaalana.com.br` e também `www.chadaalana.com.br`.
3. A Vercel mostra os registros DNS. No Registro.br, em **DNS → Editar zona**, crie:
   - `A` para `@` apontando para o IP indicado pela Vercel;
   - `CNAME` para `www` apontando para o valor indicado pela Vercel (algo como `cname.vercel-dns.com`).
   Use sempre os valores que aparecem na tela da Vercel, porque eles podem mudar.
4. Aguarde a propagação (de minutos até algumas horas). A Vercel emite o certificado HTTPS sozinha.
5. Troque `SITE_URL` para `https://chadaalana.com.br` e faça um **Redeploy**. Os links pessoais passam a usar o domínio novo, e os antigos (`*.vercel.app`) continuam funcionando.

## 5b. Avisos no celular (push, gratuito)

Nada para configurar na hospedagem: as chaves são geradas sozinhas e ficam num armazenamento
privado do Supabase (bucket `private`, criado automaticamente). Em cada celular:

- **Android:** abra o painel no Chrome → **Notificações** → **Ativar avisos neste aparelho**.
  Se quiser, "Adicionar à tela inicial" pelo menu ⋮.
- **iPhone (iOS 16.4+):** no Safari, **Compartilhar → Adicionar à Tela de Início**, abra pelo ícone
  "Chá da Alana", entre no painel e ative em **Notificações**.

Cada aparelho recebe um aviso de teste ao ativar. Para trocar as chaves, defina `VAPID_PUBLIC_KEY`
e `VAPID_PRIVATE_KEY` (os aparelhos precisarão ativar de novo).

## 6. Avisos por e-mail (opcional, gratuito)

1. Crie uma conta em <https://resend.com>. O plano gratuito tem limite diário e mensal, mais que suficiente para um chá.
2. Para enviar a qualquer destinatário, o Resend exige um **domínio verificado** (registros DNS). Sem domínio próprio, ele só entrega no e-mail da própria conta.
3. Cadastre `RESEND_API_KEY` e `NOTIFY_FROM_EMAIL` (ex.: `Chá da Alana <avisos@chadaalana.com.br>`) na Vercel e faça um redeploy.
4. No painel, em **Notificações → E-mails que recebem avisos**, coloque o e-mail do pai e o da mãe.

## 7. WhatsApp automático para os dois (opcional, pago)

Links `wa.me` (os botões do convite) abrem uma conversa com **uma** pessoa e não enviam nada sozinhos. Por isso a confirmação vale pelo **site**: ela é salva no banco e avisada no painel para os dois.

Para receber um WhatsApp automático a cada confirmação, o projeto já tem a integração com a **API oficial da Meta (WhatsApp Business Platform / Cloud API)**, desligada por padrão. Para ativar:

1. Conta no **Meta Business** (verificação do negócio pode ser exigida), app no <https://developers.facebook.com> com o produto WhatsApp.
2. Um **número de telefone dedicado** ao WhatsApp Business. Ele não pode estar em uso no WhatsApp comum ao mesmo tempo.
3. Um **modelo de mensagem (template)** da categoria *Utilidade*, aprovado pela Meta, em pt_BR, com duas variáveis no corpo. Exemplo:
   `Nova resposta no Chá da Alana: {{1}} — {{2}}`
4. Um **token de acesso permanente** (usuário do sistema) com permissão `whatsapp_business_messaging`.
5. Na Vercel: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` (e, se necessário, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_GRAPH_VERSION`).
6. No painel: **Notificações → Avisar pelo WhatsApp automaticamente**. Os destinatários são os números do pai e da mãe configurados em **Evento**.

**Custos e limites:** a Meta cobra por mensagem de modelo entregue. Para *Utilidade* no Brasil são centavos de real por mensagem, e a Meta anunciou cobrança em BRL a partir de 2026. Consultem a tabela oficial em <https://developers.facebook.com/docs/whatsapp/pricing> antes de ativar. Cada confirmação gera 2 mensagens (pai e mãe). Até concluírem a configuração acima, **não ativem** a opção: sem credenciais ela não envia nada.

> Bibliotecas não oficiais que usam a sessão pessoal do WhatsApp Web **não** foram usadas: violam os termos do WhatsApp e podem levar ao banimento do número.

## 8. Antes de enviar os convites

- [ ] Data, local e prazo conferidos no convite publicado.
- [ ] Os dois admins entram no painel.
- [ ] Uma confirmação de teste aparece em Notificações (depois, apaguem o convidado de teste).
- [ ] Botões de Maps, Waze, WhatsApp e enxoval abrem os destinos corretos no celular.
- [ ] O site abre bem num iPhone e num Android reais.

## Limitações conhecidas dos planos gratuitos

- **Supabase Free:** pausa projetos inativos. O cron diário evita isso, mas, se o projeto pausar, basta clicar em *Restore* no painel do Supabase. Há limites de armazenamento (bem acima do necessário).
- **Vercel Hobby:** apenas uso pessoal/não comercial, limite de 4,5 MB por envio (por isso imagens e músicas são limitadas a 3,5 MB) e cron no máximo diário.
- **Resend Free:** limite diário de e-mails.
