# Chá da Alana — convite digital

Convite digital cinematográfico para o chá de bebê da Alana: envelope com abertura em 3D, revelação tipográfica, rolagem animada, confirmação de presença real, convites personalizados e painel para os papais.

## Tecnologias

- **Next.js 16** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **GSAP 3** (timelines, ScrollTrigger, SplitText). O Motion for React ficou de fora porque o GSAP cobre tudo com uma biblioteca só.
- **Supabase** (Postgres com RLS, Auth e Storage) em produção
- **Playwright** (ponta a ponta em Chrome, iPhone/WebKit e Android) + **Vitest** + **PGlite** (executa a migração SQL de verdade nos testes)

## Rodar localmente

```bash
npm install
```

```bash
cp .env.example .env.local
```

Sem as variáveis do Supabase, o projeto usa um **armazenamento local de desenvolvimento** (`.data/db.json`) e as contas de teste de `LOCAL_ADMINS`. Esse modo é recusado em produção.

```bash
npm run dev
```

- Convite geral: <http://localhost:3000>
- Convite pessoal: `/convite/<token>` (gerado no painel)
- Painel: <http://localhost:3000/admin>

## Testes

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` cobre formatação, validações, tokens, limites, a migração SQL com RLS e gatilhos. `npm run test:e2e` faz o build de produção e testa envelope, rolagem, links pessoais, confirmação e atualização, limites, convite aberto sem duplicidade, painel (login, convidados, CSV, notificações, registro manual), Maps, Waze, WhatsApp, enxoval e acessibilidade (axe).

## Estrutura

```
src/app/                  páginas (convite, convite pessoal, painel, APIs)
src/components/invite/    experiência do convidado (envelope, cenas, RSVP)
src/components/admin/     componentes do painel
src/lib/                  regras compartilhadas (configurações, datas, links)
src/lib/server/           servidor: dados, autenticação, segurança, notificações
supabase/migrations/      esquema do banco + RLS
scripts/create-admin.mjs  cria as contas dos papais no Supabase
docs/PUBLICACAO.md        passo a passo de publicação, domínio e integrações
```

## Segurança e privacidade (LGPD)

- O navegador nunca acessa o banco diretamente: toda leitura e escrita passa pelo servidor, que valida os dados com Zod.
- RLS ativo em todas as tabelas. A chave pública não lê nada, e só usuários na tabela `admins` acessam pelo Supabase.
- Tokens de convite com 144 bits aleatórios (não sequenciais). Os links pessoais não são indexados.
- Limite de requisições por IP (o IP é guardado só como hash), campo honeypot e Cloudflare Turnstile opcional no convite aberto.
- Coletamos apenas nome, quantidade de pessoas, recado opcional e telefone opcional no convite aberto.
- Cabeçalhos de segurança (HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy`).

Publicação: veja [docs/PUBLICACAO.md](docs/PUBLICACAO.md).
