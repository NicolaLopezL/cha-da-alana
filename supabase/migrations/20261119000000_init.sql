-- Chá da Alana — esquema inicial
-- Princípio: o navegador NUNCA acessa estas tabelas diretamente.
-- Convidados falam apenas com as rotas do servidor (Next.js), que usam a chave secreta.
-- O RLS abaixo é uma segunda barreira: mesmo com a chave pública, um visitante anônimo
-- não lê nem grava nada; usuários autenticados só acessam se estiverem na tabela admins.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Administradores (pai e mãe). Usuários do Supabase Auth + vínculo nesta tabela.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Configurações do evento (linha única, JSON validado no servidor com Zod)
-- ---------------------------------------------------------------------------
create table if not exists public.event_settings (
  id         smallint primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.event_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Convidados / convites (um convite por pessoa ou grupo, com token secreto)
-- ---------------------------------------------------------------------------
create table if not exists public.guests (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique check (char_length(token) >= 20),
  name           text not null check (char_length(name) between 1 and 120),
  group_name     text not null default '' check (char_length(group_name) <= 120),
  max_people     smallint not null default 1 check (max_people between 1 and 20),
  phone          text not null default '' check (char_length(phone) <= 20),
  internal_notes text not null default '' check (char_length(internal_notes) <= 1000),
  sent_at        timestamptz,
  origin         text not null default 'personal' check (origin in ('personal', 'generic')),
  name_key       text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists guests_name_key_idx on public.guests (name_key);

-- ---------------------------------------------------------------------------
-- Respostas de presença (no máximo uma por convite; atualizações sobrescrevem)
-- ---------------------------------------------------------------------------
create table if not exists public.rsvp_responses (
  id         uuid primary key default gen_random_uuid(),
  guest_id   uuid not null unique references public.guests (id) on delete cascade,
  attending  text not null check (attending in ('yes', 'no')),
  people     smallint not null check (people between 0 and 20),
  message    text not null default '' check (char_length(message) <= 500),
  source     text not null default 'site' check (source in ('site', 'whatsapp_manual', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante no banco o limite de pessoas do convite (além da validação no servidor).
create or replace function public.enforce_rsvp_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_max smallint;
begin
  select max_people into v_max from public.guests where id = new.guest_id;
  if new.attending = 'no' then
    new.people := 0;
  elsif new.people < 1 or new.people > v_max then
    raise exception 'people_out_of_range' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rsvp_limit on public.rsvp_responses;
create trigger rsvp_limit
  before insert or update on public.rsvp_responses
  for each row execute function public.enforce_rsvp_limit();

-- ---------------------------------------------------------------------------
-- Sugestões de presentes simples (a lista de enxoval é um site externo)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_suggestions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  brand      text not null default '' check (char_length(brand) <= 120),
  size       text not null default '' check (char_length(size) <= 60),
  notes      text not null default '' check (char_length(notes) <= 300),
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notificações do painel (visíveis para os dois administradores)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('rsvp_new', 'rsvp_updated', 'system')),
  guest_id   uuid references public.guests (id) on delete set null,
  title      text not null,
  body       text not null default '',
  read_at    timestamptz,
  read_by    text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_unread_idx on public.notifications (guest_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Histórico de alterações
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Limite de requisições (janela fixa, atômico)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null,
  window_start timestamptz not null
);

create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;

  -- Limpeza ocasional de chaves antigas
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

-- Função usada pelo cron diário para manter o projeto gratuito ativo.
create or replace function public.keepalive()
returns timestamptz
language sql
security definer
set search_path = public
as $$ select now(); $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.event_settings   enable row level security;
alter table public.guests           enable row level security;
alter table public.rsvp_responses   enable row level security;
alter table public.gift_suggestions enable row level security;
alter table public.notifications    enable row level security;
alter table public.audit_log        enable row level security;
alter table public.rate_limits      enable row level security;

drop policy if exists "admins_read" on public.admins;
create policy "admins_read" on public.admins for select to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['event_settings', 'guests', 'rsvp_responses', 'gift_suggestions', 'notifications', 'audit_log'] loop
    execute format('drop policy if exists "admin_all" on public.%I', t);
    execute format(
      'create policy "admin_all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;
-- rate_limits: sem políticas => apenas a chave secreta (service_role) acessa.

-- Permissões explícitas (anon não recebe nada)
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
revoke execute on function public.keepalive() from public, anon, authenticated;
grant execute on function public.keepalive() to service_role;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Armazenamento de imagens e música (bucket público só para leitura;
-- uploads passam pelo servidor, que verifica se quem envia é administrador)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608,
        array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'audio/mpeg', 'audio/mp4', 'audio/ogg'])
on conflict (id) do nothing;
