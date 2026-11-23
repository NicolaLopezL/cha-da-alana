-- Chá da Alana — Quiz dos Papais
-- Migração ADITIVA: só cria objetos novos com prefixo quiz_. Não altera nem apaga nada existente.
-- Pode ser executada mais de uma vez sem efeito colateral.
--
-- Segurança:
--  * RLS ligado em todas as tabelas, sem nenhuma política => anon/authenticated não leem nem gravam.
--  * Só o servidor (service_role) chama as funções quiz_*.
--  * O gabarito fica numa tabela separada (quiz_answer_key), que nenhuma função pública devolve.
--  * A pontuação é sempre calculada aqui, dentro da mesma transação da resposta.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_settings (
  id                 smallint primary key default 1 check (id = 1),
  status             text not null default 'draft' check (status in ('draft', 'open', 'closed', 'published')),
  tiebreak_mode      text not null default 'time' check (tiebreak_mode in ('time', 'extra', 'shared')),
  close_policy       text not null default 'block' check (close_policy in ('block', 'finish')),
  default_points     smallint not null default 1 check (default_points between 1 and 100),
  allow_same_device  boolean not null default true,
  live_enabled       boolean not null default false,
  live_show_scores   boolean not null default true,
  live_show_progress boolean not null default true,
  live_top10         boolean not null default true,
  live_hidden        boolean not null default false,
  texts              jsonb not null default '{}'::jsonb,
  opened_at          timestamptz,
  closed_at          timestamptz,
  published_at       timestamptz,
  updated_at         timestamptz not null default now()
);
insert into public.quiz_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.quiz_questions (
  id         uuid primary key default gen_random_uuid(),
  round      text not null default 'main' check (round in ('main', 'extra')),
  position   integer not null default 0,
  active     boolean not null default true,
  points     smallint not null default 1 check (points between 1 and 100),
  text_pt    text not null check (char_length(text_pt) between 1 and 300),
  text_es    text not null default '' check (char_length(text_es) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position    integer not null default 0,
  text_pt     text not null check (char_length(text_pt) between 1 and 120),
  text_es     text not null default '' check (char_length(text_es) <= 120),
  unique (id, question_id)
);
create index if not exists quiz_options_question_idx on public.quiz_options (question_id);

-- Gabarito: uma alternativa correta por pergunta (a FK composta garante que ela é da própria pergunta).
create table if not exists public.quiz_answer_key (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  option_id   uuid not null,
  foreign key (option_id, question_id) references public.quiz_options (id, question_id) on delete cascade
);

create table if not exists public.quiz_participants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 40),
  name_key       text not null,
  lang           text not null default 'pt' check (lang in ('pt', 'es')),
  token_hash     text not null unique,
  start_key      text not null unique,
  device_hash    text not null default '',
  status         text not null default 'active' check (status in ('active', 'done', 'invalid')),
  invalid_reason text not null default '' check (char_length(invalid_reason) <= 200),
  score          integer not null default 0,
  correct        integer not null default 0,
  answered       integer not null default 0,
  started_at     timestamptz not null default now(),
  last_at        timestamptz not null default now(),
  finished_at    timestamptz,
  duration_ms    bigint
);
-- Um nome por participação válida: o ranking não fica ambíguo e dois toques não criam duas pessoas.
create unique index if not exists quiz_participants_name_idx on public.quiz_participants (name_key) where status <> 'invalid';

create table if not exists public.quiz_answers (
  participant_id uuid not null references public.quiz_participants (id) on delete cascade,
  question_id    uuid not null references public.quiz_questions (id) on delete restrict,
  option_id      uuid not null,
  answered_at    timestamptz not null default now(),
  primary key (participant_id, question_id),
  foreign key (option_id, question_id) references public.quiz_options (id, question_id) on delete restrict
);
create index if not exists quiz_answers_question_idx on public.quiz_answers (question_id);

-- Rodadas de desempate (perguntas extras)
create table if not exists public.quiz_rounds (
  id         uuid primary key default gen_random_uuid(),
  number     integer not null unique,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create unique index if not exists quiz_rounds_one_open on public.quiz_rounds (status) where status = 'open';

create table if not exists public.quiz_round_questions (
  question_id uuid primary key references public.quiz_questions (id) on delete restrict,
  round_id    uuid not null references public.quiz_rounds (id) on delete cascade
);

create table if not exists public.quiz_round_members (
  round_id       uuid not null references public.quiz_rounds (id) on delete cascade,
  participant_id uuid not null references public.quiz_participants (id) on delete cascade,
  score          integer not null default 0,
  answered       integer not null default 0,
  finished_at    timestamptz,
  primary key (round_id, participant_id)
);

-- Ranking final "fotografado" na publicação
create table if not exists public.quiz_results (
  participant_id uuid primary key references public.quiz_participants (id) on delete cascade,
  sort           integer not null,
  position       integer not null,
  tied           boolean not null,
  name           text not null,
  score          integer not null,
  correct        integer not null,
  duration_ms    bigint
);

-- ---------------------------------------------------------------------------
-- Integridade: depois da abertura, perguntas e alternativas não mudam
-- (só a tradução para o espanhol). O gabarito só muda com o quiz encerrado ou em rascunho.
-- ---------------------------------------------------------------------------
create or replace function public.quiz_guard_question() returns trigger
language plpgsql set search_path = public as $$
declare
  r public.quiz_questions;
  v_status text;
  v_locked boolean;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' then
    if new.round is distinct from old.round then raise exception 'quiz_locked'; end if;
    if (new.position, new.active, new.points, new.text_pt) is not distinct from (old.position, old.active, old.points, old.text_pt) then
      return new; -- só tradução
    end if;
  end if;
  if r.round = 'main' then
    select status into v_status from public.quiz_settings where id = 1 for share;
    v_locked := v_status <> 'draft';
  else
    v_locked := tg_op <> 'INSERT' and exists (select 1 from public.quiz_round_questions where question_id = r.id);
  end if;
  if v_locked then raise exception 'quiz_locked'; end if;
  return r;
end $$;

create or replace function public.quiz_guard_option() returns trigger
language plpgsql set search_path = public as $$
declare
  o public.quiz_options;
  v_round text;
  v_status text;
begin
  if tg_op = 'DELETE' then o := old; else o := new; end if;
  if tg_op = 'UPDATE' then
    if (new.position, new.text_pt, new.question_id) is not distinct from (old.position, old.text_pt, old.question_id) then
      return new; -- só tradução
    end if;
  end if;
  select round into v_round from public.quiz_questions where id = o.question_id;
  if v_round = 'main' then
    select status into v_status from public.quiz_settings where id = 1 for share;
    if v_status <> 'draft' then raise exception 'quiz_locked'; end if;
  elsif v_round = 'extra' and exists (select 1 from public.quiz_round_questions where question_id = o.question_id) then
    raise exception 'quiz_locked';
  end if;
  return o; -- v_round nulo = exclusão em cascata da própria pergunta (já verificada)
end $$;

create or replace function public.quiz_guard_key() returns trigger
language plpgsql set search_path = public as $$
declare
  k public.quiz_answer_key;
  v_round text;
  v_status text;
begin
  if tg_op = 'DELETE' then k := old; else k := new; end if;
  if tg_op = 'UPDATE' then
    if new.option_id = old.option_id then return new; end if;
  end if;
  select round into v_round from public.quiz_questions where id = k.question_id;
  if v_round = 'main' then
    select status into v_status from public.quiz_settings where id = 1 for share;
    if v_status not in ('draft', 'closed') then raise exception 'quiz_locked'; end if;
  elsif v_round = 'extra' and exists (select 1 from public.quiz_round_questions where question_id = k.question_id) then
    raise exception 'quiz_locked';
  end if;
  return k;
end $$;

drop trigger if exists quiz_guard on public.quiz_questions;
create trigger quiz_guard before insert or update or delete on public.quiz_questions
  for each row execute function public.quiz_guard_question();
drop trigger if exists quiz_guard on public.quiz_options;
create trigger quiz_guard before insert or update or delete on public.quiz_options
  for each row execute function public.quiz_guard_option();
drop trigger if exists quiz_guard on public.quiz_answer_key;
create trigger quiz_guard before insert or update or delete on public.quiz_answer_key
  for each row execute function public.quiz_guard_key();

-- ---------------------------------------------------------------------------
-- Perguntas iniciais (sem gabarito: quem define são os papais, no painel)
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_i integer := 0;
  q record;
begin
  if exists (select 1 from public.quiz_questions) or (select status from public.quiz_settings where id = 1) <> 'draft' then
    return;
  end if;
  for q in select * from (values
    ('Quem escolheu o nome Alana?', '¿Quién escogió el nombre Alana?'),
    ('Quem ficou mais ansioso quando descobriu a gravidez?', '¿Quién se puso más ansioso al enterarse del embarazo?'),
    ('Quem é mais organizado?', '¿Quién es más organizado?'),
    ('Quem é mais dorminhoco?', '¿Quién es más dormilón?'),
    ('Quem costuma planejar mais as coisas?', '¿Quién suele planear más las cosas?'),
    ('Quem é mais tecnológico?', '¿Quién es más tecnológico?'),
    ('Quem tem mais paciência?', '¿Quién tiene más paciencia?'),
    ('Quem disse "eu te amo" primeiro?', '¿Quién dijo "te amo" primero?'),
    ('Quem costuma ser mais pontual?', '¿Quién suele ser más puntual?'),
    ('Quem é mais romântico?', '¿Quién es más romántico?'),
    ('Quem costuma acordar mais cedo?', '¿Quién suele madrugar más?'),
    ('Quem é mais esquecido?', '¿Quién es más olvidadizo?'),
    ('Quem costuma fazer mais surpresas?', '¿Quién suele dar más sorpresas?'),
    ('Quem é mais competitivo?', '¿Quién es más competitivo?'),
    ('Quem costuma demorar mais para se arrumar?', '¿Quién suele demorarse más para arreglarse?'),
    ('Quem é mais engraçado?', '¿Quién es más chistoso?'),
    ('Quem é mais teimoso?', '¿Quién es más terco?'),
    ('Quem costuma escolher os filmes ou séries?', '¿Quién suele escoger las películas o series?'),
    ('Quem é mais carinhoso?', '¿Quién es más cariñoso?'),
    ('Quem costuma tomar a iniciativa de fazer planos?', '¿Quién suele tomar la iniciativa para hacer planes?')
  ) as t (pt, es) loop
    insert into public.quiz_questions (position, text_pt, text_es) values (v_i, q.pt, q.es) returning id into v_id;
    insert into public.quiz_options (question_id, position, text_pt, text_es) values
      (v_id, 0, 'Nicola', 'Nicola'), (v_id, 1, 'Yasmin', 'Yasmin'), (v_id, 2, 'Os dois', 'Los dos');
    v_i := v_i + 1;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Cálculos internos
-- ---------------------------------------------------------------------------
create or replace function public.quiz_totals(out questions integer, out max_score integer)
language sql stable set search_path = public as $$
  select count(*)::int, coalesce(sum(points), 0)::int from public.quiz_questions where round = 'main' and active;
$$;

create or replace function public.quiz_rescore(p_participant uuid default null) returns void
language sql set search_path = public as $$
  update public.quiz_participants p set
    score = s.score, correct = s.correct, answered = s.answered
  from (
    select pp.id,
      coalesce(sum(q.points) filter (where k.option_id = a.option_id), 0)::int as score,
      (count(*) filter (where k.option_id = a.option_id))::int as correct,
      count(q.id)::int as answered
    from public.quiz_participants pp
    left join public.quiz_answers a on a.participant_id = pp.id
    left join public.quiz_questions q on q.id = a.question_id and q.round = 'main' and q.active
    left join public.quiz_answer_key k on k.question_id = q.id
    where p_participant is null or pp.id = p_participant
    group by pp.id
  ) s
  where p.id = s.id and (p.score, p.correct, p.answered) is distinct from (s.score, s.correct, s.answered);
$$;

-- Classificação. p_final = só participações concluídas. Nunca inclui invalidadas.
create or replace function public.quiz_ranking(p_final boolean)
returns table (id uuid, name text, status text, score integer, correct integer, answered integer,
               duration_ms bigint, started_at timestamptz, finished_at timestamptz, pos integer, tied boolean)
language sql stable set search_path = public as $$
  with base as (
    select p.*,
      case when s.tiebreak_mode = 'time' then p.duration_ms end as k_time,
      case when s.tiebreak_mode = 'extra' then coalesce((
        select array_agg(coalesce(m.score, 0) order by r.number)
        from public.quiz_rounds r
        left join public.quiz_round_members m on m.round_id = r.id and m.participant_id = p.id
        where r.status = 'closed'), '{}'::int[]) else '{}'::int[] end as k_extra
    from public.quiz_participants p cross join public.quiz_settings s
    where p.status <> 'invalid' and (not p_final or p.status = 'done')
  ), ranked as (
    select b.*,
      rank() over (order by b.score desc, b.k_extra desc, b.k_time asc nulls last) as rk,
      count(*) over (partition by b.score, b.k_extra, b.k_time) as same
    from base b
  )
  select r.id, r.name, r.status, r.score, r.correct, r.answered, r.duration_ms, r.started_at, r.finished_at,
         r.rk::int, r.same > 1
  from ranked r
  order by r.rk, (r.status = 'done') desc, r.answered desc, r.name, r.id;
$$;

create or replace function public.quiz_snapshot_results() returns void
language sql set search_path = public as $$
  delete from public.quiz_results where true;
  insert into public.quiz_results (participant_id, sort, position, tied, name, score, correct, duration_ms)
  select r.id, row_number() over (order by r.pos, r.name, r.id), r.pos, r.tied, r.name, r.score, r.correct, r.duration_ms
  from public.quiz_ranking(true) r;
$$;

-- ---------------------------------------------------------------------------
-- Funções públicas (chamadas pelo servidor em nome do convidado) — sem gabarito
-- ---------------------------------------------------------------------------
create or replace function public.quiz_info() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'status', s.status, 'tiebreakMode', s.tiebreak_mode, 'allowSameDevice', s.allow_same_device,
    'texts', s.texts, 'questions', t.questions, 'maxScore', t.max_score, 'liveEnabled', s.live_enabled)
  from public.quiz_settings s cross join public.quiz_totals() t;
$$;

create or replace function public.quiz_public_questions(p_ids uuid[] default null) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'pt', q.text_pt, 'es', q.text_es,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'pt', o.text_pt, 'es', o.text_es) order by o.position, o.id), '[]'::jsonb)
                from public.quiz_options o where o.question_id = q.id)
  ) order by q.position, q.created_at, q.id), '[]'::jsonb)
  from public.quiz_questions q
  where case when p_ids is null then q.round = 'main' and q.active else q.id = any (p_ids) end;
$$;

create or replace function public.quiz_start(
  p_name text, p_name_key text, p_lang text, p_token_hash text, p_device_hash text, p_start_key text
) returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
  p public.quiz_participants;
begin
  select * into s from public.quiz_settings where id = 1 for share;
  -- Mesmo pedido repetido (a resposta se perdeu na rede): devolve a mesma participação.
  -- start_key é um segredo aleatório do próprio aparelho.
  select * into p from public.quiz_participants where start_key = p_start_key for update;
  if found then
    if p.status = 'invalid' then return jsonb_build_object('error', 'invalid'); end if;
    update public.quiz_participants set token_hash = p_token_hash where id = p.id;
    return jsonb_build_object('ok', true, 'id', p.id);
  end if;
  if s.status <> 'open' then return jsonb_build_object('error', 'not_open'); end if;
  if not s.allow_same_device and exists (
    select 1 from public.quiz_participants where device_hash = p_device_hash and status <> 'invalid'
  ) then
    return jsonb_build_object('error', 'device_used');
  end if;
  begin
    insert into public.quiz_participants (name, name_key, lang, token_hash, device_hash, start_key, started_at, last_at)
    values (p_name, p_name_key, p_lang, p_token_hash, p_device_hash, p_start_key, clock_timestamp(), clock_timestamp())
    returning * into p;
  exception when unique_violation then
    -- Corrida com o mesmo pedido, ou nome já em uso.
    if exists (select 1 from public.quiz_participants where start_key = p_start_key) then
      return jsonb_build_object('error', 'retry');
    end if;
    return jsonb_build_object('error', 'name_taken');
  end;
  return jsonb_build_object('ok', true, 'id', p.id);
end $$;

create or replace function public.quiz_session(p_token_hash text) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  s public.quiz_settings;
  p public.quiz_participants;
  r public.quiz_rounds;
  v_round jsonb;
  v_ids uuid[];
begin
  select * into p from public.quiz_participants where token_hash = p_token_hash;
  if not found then return null; end if;
  select * into s from public.quiz_settings where id = 1;
  select * into r from public.quiz_rounds where status = 'open';
  if found and p.status = 'done' and exists (
    select 1 from public.quiz_round_members where round_id = r.id and participant_id = p.id
  ) then
    select array_agg(question_id) into v_ids from public.quiz_round_questions where round_id = r.id;
    select jsonb_build_object('id', r.id, 'number', r.number, 'finished', m.finished_at is not null,
                              'questions', public.quiz_public_questions(v_ids))
      into v_round from public.quiz_round_members m where m.round_id = r.id and m.participant_id = p.id;
  end if;
  return jsonb_build_object(
    'name', p.name, 'lang', p.lang, 'status', p.status, 'quizStatus', s.status,
    'canAnswer', p.status = 'active' and (s.status = 'open' or (s.status = 'closed' and s.close_policy = 'finish')),
    'answers', (select coalesce(jsonb_object_agg(a.question_id, a.option_id), '{}'::jsonb)
                from public.quiz_answers a where a.participant_id = p.id),
    'round', v_round);
end $$;

-- Registra (ou corrige) uma resposta e recalcula a pontuação na mesma transação.
create or replace function public.quiz_answer(p_token_hash text, p_question uuid, p_option uuid) returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
  p public.quiz_participants;
  q public.quiz_questions;
  r public.quiz_rounds;
  t record;
  v_prev uuid;
  v_total integer;
  v_answered integer;
  v_done boolean;
  v_now timestamptz;
begin
  -- "for share" serializa com abrir/encerrar; "for update" serializa toques repetidos da mesma pessoa.
  select * into s from public.quiz_settings where id = 1 for share;
  select * into p from public.quiz_participants where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('error', 'no_session'); end if;
  if p.status = 'invalid' then return jsonb_build_object('error', 'invalid'); end if;

  select * into q from public.quiz_questions where id = p_question;
  if not found or not exists (select 1 from public.quiz_options where id = p_option and question_id = p_question) then
    return jsonb_build_object('error', 'bad_question');
  end if;
  select option_id into v_prev from public.quiz_answers where participant_id = p.id and question_id = p_question;
  v_now := clock_timestamp();

  if q.round = 'extra' then
    select rr.* into r from public.quiz_rounds rr
      join public.quiz_round_questions rq on rq.round_id = rr.id
      join public.quiz_round_members m on m.round_id = rr.id and m.participant_id = p.id
      where rq.question_id = q.id for share of rr;
    if not found then return jsonb_build_object('error', 'bad_question'); end if;
    select count(*)::int into v_total from public.quiz_round_questions where round_id = r.id;
    select answered, finished_at is not null into v_answered, v_done
      from public.quiz_round_members where round_id = r.id and participant_id = p.id for update;
    if v_prev = p_option then
      return jsonb_build_object('ok', true, 'answered', v_answered, 'total', v_total, 'finished', v_done);
    end if;
    if r.status <> 'open' then return jsonb_build_object('error', 'closed'); end if;
    if v_done then return jsonb_build_object('error', 'finished'); end if;
    insert into public.quiz_answers (participant_id, question_id, option_id, answered_at) values (p.id, q.id, p_option, v_now)
      on conflict (participant_id, question_id) do update set option_id = excluded.option_id, answered_at = excluded.answered_at;
    update public.quiz_round_members m set
      answered = x.answered, score = x.score,
      finished_at = case when x.answered >= v_total then v_now end
    from (
      select count(*)::int as answered, coalesce(sum(qq.points) filter (where k.option_id = a.option_id), 0)::int as score
      from public.quiz_round_questions rq
      join public.quiz_questions qq on qq.id = rq.question_id
      join public.quiz_answers a on a.question_id = rq.question_id and a.participant_id = p.id
      left join public.quiz_answer_key k on k.question_id = rq.question_id
      where rq.round_id = r.id
    ) x
    where m.round_id = r.id and m.participant_id = p.id
    returning m.answered, m.finished_at is not null into v_answered, v_done;
    return jsonb_build_object('ok', true, 'answered', v_answered, 'total', v_total, 'finished', v_done);
  end if;

  if not q.active then return jsonb_build_object('error', 'bad_question'); end if;
  select * into t from public.quiz_totals();
  -- Repetição da mesma resposta (reenvio após queda de internet): idempotente.
  if v_prev = p_option then
    return jsonb_build_object('ok', true, 'answered', p.answered, 'total', t.questions, 'finished', p.status = 'done');
  end if;
  if p.status = 'done' then return jsonb_build_object('error', 'finished'); end if;
  if not (s.status = 'open' or (s.status = 'closed' and s.close_policy = 'finish')) then
    return jsonb_build_object('error', 'closed');
  end if;

  insert into public.quiz_answers (participant_id, question_id, option_id, answered_at) values (p.id, q.id, p_option, v_now)
    on conflict (participant_id, question_id) do update set option_id = excluded.option_id, answered_at = excluded.answered_at;
  perform public.quiz_rescore(p.id);
  update public.quiz_participants pp set
    last_at = v_now,
    status = case when pp.answered >= t.questions then 'done' else pp.status end,
    finished_at = case when pp.answered >= t.questions then v_now end,
    duration_ms = case when pp.answered >= t.questions then greatest(0, round(extract(epoch from (v_now - pp.started_at)) * 1000))::bigint end
  where pp.id = p.id
  returning pp.answered, pp.status = 'done' into v_answered, v_done;
  return jsonb_build_object('ok', true, 'answered', v_answered, 'total', t.questions, 'finished', v_done);
end $$;

-- Ranking ao vivo: devolve apenas o que a organizadora decidiu mostrar.
create or replace function public.quiz_live() returns jsonb
language plpgsql stable set search_path = public as $$
declare
  s public.quiz_settings;
  t record;
  v_rows jsonb := '[]'::jsonb;
  v_mode text;
  v_final boolean;
  v_total integer;
  v_done integer;
  v_tie boolean := false;
begin
  select * into s from public.quiz_settings where id = 1;
  select * into t from public.quiz_totals();
  v_final := s.status = 'published';
  v_mode := case
    when not s.live_enabled then 'off'
    when s.status = 'draft' then 'waiting'
    when s.live_hidden and not v_final then 'hidden'
    when v_final then 'final'
    else 'ranking' end;

  if v_mode = 'final' then
    select count(*)::int into v_total from public.quiz_results;
    v_done := v_total;
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', x.participant_id, 'name', x.name, 'pos', x.position, 'tied', x.tied, 'done', true,
      'score', case when s.live_show_scores then x.score end)) order by x.sort), '[]'::jsonb),
      coalesce(bool_or(x.tied), false)
    into v_rows, v_tie
    from (select * from public.quiz_results order by sort limit case when s.live_top10 then 10 end) x;
  else
    select count(*)::int, (count(*) filter (where status = 'done'))::int into v_total, v_done
      from public.quiz_participants where status <> 'invalid';
    if v_mode = 'ranking' then
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', x.id, 'name', x.name, 'pos', x.pos, 'tied', x.tied and x.answered > 0, 'done', x.status = 'done',
        'score', case when s.live_show_scores then x.score end,
        'answered', case when s.live_show_progress then x.answered end)) order by x.ord), '[]'::jsonb),
        coalesce(bool_or(x.tied and x.answered > 0), false)
      into v_rows, v_tie
      from (
        select r.*, row_number() over () as ord from public.quiz_ranking(s.status = 'closed') r
        limit case when s.live_top10 then 10 end
      ) x;
    end if;
  end if;

  return jsonb_build_object(
    'mode', v_mode, 'status', s.status, 'showScores', s.live_show_scores, 'showProgress', s.live_show_progress,
    'top10', s.live_top10, 'participants', v_total, 'done', v_done, 'questions', t.questions, 'maxScore', t.max_score,
    'tie', v_tie, 'round', exists (select 1 from public.quiz_rounds where status = 'open'), 'rows', v_rows);
end $$;

create or replace function public.quiz_final() returns jsonb
language sql stable set search_path = public as $$
  select case when s.status <> 'published' then jsonb_build_object('published', false, 'status', s.status)
  else jsonb_build_object('published', true, 'status', s.status, 'maxScore', t.max_score, 'questions', t.questions,
    'tiebreakMode', s.tiebreak_mode,
    'participants', (select count(*)::int from public.quiz_results),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', r.participant_id, 'name', r.name, 'pos', r.position,
              'tied', r.tied, 'score', r.score, 'durationMs', r.duration_ms) order by r.sort), '[]'::jsonb) from public.quiz_results r))
  end
  from public.quiz_settings s cross join public.quiz_totals() t;
$$;

-- ---------------------------------------------------------------------------
-- Funções administrativas
-- ---------------------------------------------------------------------------
create or replace function public.quiz_admin_state() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'status', s.status, 'tiebreakMode', s.tiebreak_mode, 'closePolicy', s.close_policy, 'defaultPoints', s.default_points,
    'allowSameDevice', s.allow_same_device, 'texts', s.texts,
    'live', jsonb_build_object('enabled', s.live_enabled, 'showScores', s.live_show_scores, 'showProgress', s.live_show_progress,
                               'top10', s.live_top10, 'hidden', s.live_hidden),
    'openedAt', s.opened_at, 'closedAt', s.closed_at, 'publishedAt', s.published_at,
    'questions', t.questions, 'maxScore', t.max_score,
    'missingKey', (select count(*)::int from public.quiz_questions q where q.round = 'main' and q.active
                   and not exists (select 1 from public.quiz_answer_key k where k.question_id = q.id)),
    'missingEs', (select count(*)::int from public.quiz_questions q where q.round = 'main' and q.active
                  and (q.text_es = '' or exists (select 1 from public.quiz_options o where o.question_id = q.id and o.text_es = ''))),
    'stats', (select jsonb_build_object(
        'total', count(*) filter (where status <> 'invalid'),
        'active', count(*) filter (where status = 'active'),
        'done', count(*) filter (where status = 'done'),
        'invalid', count(*) filter (where status = 'invalid'),
        'answers', coalesce(sum(answered) filter (where status <> 'invalid'), 0),
        'avgScore', round(avg(score) filter (where status = 'done'), 1)) from public.quiz_participants),
    'ranking', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'pos', r.pos, 'tied', r.tied, 'status', r.status,
                  'score', r.score, 'answered', r.answered, 'durationMs', r.duration_ms) order by r.ord), '[]'::jsonb)
                from (select *, row_number() over () as ord from public.quiz_ranking(s.status in ('closed', 'published'))) r),
    'rounds', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'number', r.number, 'status', r.status,
                  'questions', (select count(*)::int from public.quiz_round_questions rq where rq.round_id = r.id),
                  'members', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'score', m.score,
                      'answered', m.answered, 'finished', m.finished_at is not null) order by m.score desc, p.name), '[]'::jsonb)
                    from public.quiz_round_members m join public.quiz_participants p on p.id = m.participant_id where m.round_id = r.id)
                ) order by r.number), '[]'::jsonb) from public.quiz_rounds r)
  )
  from public.quiz_settings s cross join public.quiz_totals() t;
$$;

create or replace function public.quiz_admin_questions(p_round text) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'round', q.round, 'active', q.active, 'points', q.points, 'pt', q.text_pt, 'es', q.text_es,
    'key', (select k.option_id from public.quiz_answer_key k where k.question_id = q.id),
    'used', exists (select 1 from public.quiz_round_questions rq where rq.question_id = q.id),
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'pt', o.text_pt, 'es', o.text_es) order by o.position, o.id), '[]'::jsonb)
                from public.quiz_options o where o.question_id = q.id)
  ) order by q.position, q.created_at, q.id), '[]'::jsonb)
  from public.quiz_questions q where q.round = p_round;
$$;

-- Cria/edita pergunta, alternativas e gabarito de uma vez. p.correct = índice da alternativa certa ou null.
create or replace function public.quiz_save_question(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_round text := coalesce(p ->> 'round', 'main');
  v_opts jsonb := p -> 'options';
  v_keep uuid[] := '{}';
  v_opt jsonb;
  v_oid uuid;
  v_i integer := 0;
  v_key uuid;
  v_old_key uuid;
begin
  if jsonb_array_length(v_opts) not between 2 and 8 then return jsonb_build_object('error', 'bad_options'); end if;
  if v_id is null then
    if (select count(*) from public.quiz_questions where round = v_round) >= 200 then return jsonb_build_object('error', 'too_many'); end if;
    insert into public.quiz_questions (round, position, active, points, text_pt, text_es)
    values (v_round, (select coalesce(max(position), -1) + 1 from public.quiz_questions where round = v_round),
            (p ->> 'active')::boolean, (p ->> 'points')::smallint, p ->> 'pt', coalesce(p ->> 'es', ''))
    returning id into v_id;
  else
    update public.quiz_questions set active = (p ->> 'active')::boolean, points = (p ->> 'points')::smallint,
      text_pt = p ->> 'pt', text_es = coalesce(p ->> 'es', '') where id = v_id;
    if not found then return jsonb_build_object('error', 'not_found'); end if;
  end if;

  for v_opt in select * from jsonb_array_elements(v_opts) loop
    v_oid := nullif(v_opt ->> 'id', '')::uuid;
    if v_oid is not null then
      update public.quiz_options set position = v_i, text_pt = v_opt ->> 'pt', text_es = coalesce(v_opt ->> 'es', '')
        where id = v_oid and question_id = v_id;
      if not found then raise exception 'quiz_option_not_found'; end if;
    else
      insert into public.quiz_options (question_id, position, text_pt, text_es)
        values (v_id, v_i, v_opt ->> 'pt', coalesce(v_opt ->> 'es', '')) returning id into v_oid;
    end if;
    v_keep := v_keep || v_oid;
    if (p ->> 'correct')::integer = v_i then v_key := v_oid; end if;
    v_i := v_i + 1;
  end loop;

  select option_id into v_old_key from public.quiz_answer_key where question_id = v_id;
  if v_key is null and v_old_key is not null then
    delete from public.quiz_answer_key where question_id = v_id;
  elsif v_key is not null and v_key is distinct from v_old_key then
    insert into public.quiz_answer_key (question_id, option_id) values (v_id, v_key)
      on conflict (question_id) do update set option_id = excluded.option_id;
  end if;
  delete from public.quiz_options where question_id = v_id and id <> all (v_keep);
  if v_key is distinct from v_old_key then perform public.quiz_rescore(); end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.quiz_set_key(p_question uuid, p_option uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.quiz_options where id = p_option and question_id = p_question) then
    return jsonb_build_object('error', 'not_found');
  end if;
  insert into public.quiz_answer_key (question_id, option_id) values (p_question, p_option)
    on conflict (question_id) do update set option_id = excluded.option_id;
  perform public.quiz_rescore();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_set_active(p_question uuid, p_active boolean) returns jsonb
language plpgsql set search_path = public as $$
begin
  update public.quiz_questions set active = p_active where id = p_question;
  return case when found then jsonb_build_object('ok', true) else jsonb_build_object('error', 'not_found') end;
end $$;

create or replace function public.quiz_delete_question(p_question uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  delete from public.quiz_questions where id = p_question;
  return case when found then jsonb_build_object('ok', true) else jsonb_build_object('error', 'not_found') end;
end $$;

create or replace function public.quiz_duplicate_question(p_question uuid) returns jsonb
language plpgsql set search_path = public as $$
declare
  q public.quiz_questions;
  v_id uuid;
  v_new uuid;
  v_key uuid;
  o record;
begin
  select * into q from public.quiz_questions where id = p_question;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if (select count(*) from public.quiz_questions where round = q.round) >= 200 then return jsonb_build_object('error', 'too_many'); end if;
  select option_id into v_key from public.quiz_answer_key where question_id = p_question;
  insert into public.quiz_questions (round, position, active, points, text_pt, text_es)
    values (q.round, (select max(position) + 1 from public.quiz_questions where round = q.round), q.active, q.points,
            left(q.text_pt, 290) || ' (cópia)', q.text_es) returning id into v_id;
  for o in select * from public.quiz_options where question_id = p_question order by position loop
    insert into public.quiz_options (question_id, position, text_pt, text_es) values (v_id, o.position, o.text_pt, o.text_es) returning id into v_new;
    if o.id = v_key then
      insert into public.quiz_answer_key (question_id, option_id) values (v_id, v_new);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.quiz_move_question(p_question uuid, p_delta integer) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_round text;
  v_ids uuid[];
  v_i integer;
  v_j integer;
begin
  select round into v_round from public.quiz_questions where id = p_question;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select array_agg(id order by position, created_at, id) into v_ids from public.quiz_questions where round = v_round;
  v_i := array_position(v_ids, p_question);
  v_j := greatest(1, least(array_length(v_ids, 1), v_i + p_delta));
  if v_i = v_j then return jsonb_build_object('ok', true); end if;
  v_ids := array_remove(v_ids, p_question);
  v_ids := v_ids[1 : v_j - 1] || p_question || v_ids[v_j : ];
  update public.quiz_questions q set position = x.ord - 1
    from unnest(v_ids) with ordinality as x (id, ord) where q.id = x.id and q.position <> x.ord - 1;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_save_config(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare s public.quiz_settings;
begin
  select * into s from public.quiz_settings where id = 1 for update;
  if s.status <> 'draft' and p ? 'tiebreakMode' and p ->> 'tiebreakMode' <> s.tiebreak_mode then
    return jsonb_build_object('error', 'locked');
  end if;
  update public.quiz_settings set
    tiebreak_mode      = coalesce(p ->> 'tiebreakMode', tiebreak_mode),
    close_policy       = coalesce(p ->> 'closePolicy', close_policy),
    default_points     = coalesce((p ->> 'defaultPoints')::smallint, default_points),
    allow_same_device  = coalesce((p ->> 'allowSameDevice')::boolean, allow_same_device),
    live_enabled       = coalesce((p ->> 'liveEnabled')::boolean, live_enabled),
    live_show_scores   = coalesce((p ->> 'liveShowScores')::boolean, live_show_scores),
    live_show_progress = coalesce((p ->> 'liveShowProgress')::boolean, live_show_progress),
    live_top10         = coalesce((p ->> 'liveTop10')::boolean, live_top10),
    live_hidden        = coalesce((p ->> 'liveHidden')::boolean, live_hidden),
    texts              = coalesce(p -> 'texts', texts),
    updated_at         = now()
  where id = 1;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_set_status(p_to text) returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
begin
  select * into s from public.quiz_settings where id = 1 for update;
  if s.status = p_to then return jsonb_build_object('ok', true, 'from', s.status); end if;
  if not ((s.status, p_to) in (('draft', 'open'), ('open', 'closed'), ('closed', 'open'), ('closed', 'published'), ('published', 'closed'))) then
    return jsonb_build_object('error', 'bad_transition');
  end if;

  if p_to = 'open' then
    if (select questions from public.quiz_totals()) = 0 then return jsonb_build_object('error', 'no_questions'); end if;
    if exists (select 1 from public.quiz_questions q where q.round = 'main' and q.active
               and not exists (select 1 from public.quiz_answer_key k where k.question_id = q.id)) then
      return jsonb_build_object('error', 'missing_key');
    end if;
    if exists (select 1 from public.quiz_rounds) then return jsonb_build_object('error', 'has_rounds'); end if;
  end if;
  if p_to = 'published' then
    if exists (select 1 from public.quiz_rounds where status = 'open') then return jsonb_build_object('error', 'round_open'); end if;
  end if;

  update public.quiz_settings set
    status = p_to,
    opened_at = case when p_to = 'open' then coalesce(opened_at, now()) else opened_at end,
    closed_at = case when p_to = 'closed' and s.status = 'open' then now() when p_to = 'open' then null else closed_at end,
    published_at = case when p_to = 'published' then now() end,
    updated_at = now()
  where id = 1;

  if p_to = 'published' then
    perform public.quiz_rescore();
    perform public.quiz_snapshot_results();
  elsif s.status = 'published' then
    delete from public.quiz_results where true;
  end if;
  return jsonb_build_object('ok', true, 'from', s.status);
end $$;

create or replace function public.quiz_admin_participants() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'lang', p.lang, 'status', p.status, 'reason', p.invalid_reason,
    'startedAt', p.started_at, 'finishedAt', p.finished_at, 'lastAt', p.last_at, 'answered', p.answered,
    'score', p.score, 'correct', p.correct, 'durationMs', p.duration_ms,
    'sameDevice', p.status <> 'invalid' and p.device_hash <> '' and exists (
      select 1 from public.quiz_participants o where o.id <> p.id and o.status <> 'invalid' and o.device_hash = p.device_hash),
    'similarName', p.status <> 'invalid' and exists (
      select 1 from public.quiz_participants o where o.id <> p.id and o.status <> 'invalid'
        and split_part(o.name_key, ' ', 1) = split_part(p.name_key, ' ', 1))
  ) order by p.started_at desc), '[]'::jsonb)
  from public.quiz_participants p;
$$;

create or replace function public.quiz_admin_answers(p_participant uuid default null) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId', a.participant_id, 'questionId', a.question_id, 'optionId', a.option_id, 'at', a.answered_at,
    'question', q.text_pt, 'round', q.round, 'option', o.text_pt, 'points', q.points,
    'correct', coalesce(k.option_id = a.option_id, false),
    'correctOption', (select co.text_pt from public.quiz_options co where co.id = k.option_id)
  ) order by q.round desc, q.position, a.answered_at), '[]'::jsonb)
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  join public.quiz_options o on o.id = a.option_id
  left join public.quiz_answer_key k on k.question_id = a.question_id
  where p_participant is null or a.participant_id = p_participant;
$$;

create or replace function public.quiz_update_participant(p_id uuid, p_name text, p_name_key text, p_status text, p_reason text) returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
  p public.quiz_participants;
begin
  select * into s from public.quiz_settings where id = 1 for update;
  select * into p from public.quiz_participants where id = p_id for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  begin
    update public.quiz_participants set
      name = coalesce(p_name, name),
      name_key = coalesce(p_name_key, name_key),
      status = case when p_status = 'invalid' then 'invalid'
                    when p_status = 'valid' then case when finished_at is null then 'active' else 'done' end
                    else status end,
      invalid_reason = case when p_status = 'invalid' then coalesce(p_reason, '') when p_status = 'valid' then '' else invalid_reason end
    where id = p_id;
  exception when unique_violation then
    return jsonb_build_object('error', 'name_taken');
  end;
  if s.status = 'published' then perform public.quiz_snapshot_results(); end if;
  return jsonb_build_object('ok', true, 'name', p.name);
end $$;

-- Desempate por perguntas extras: só para TODOS os empatados de uma mesma posição.
create or replace function public.quiz_round_start(p_participants uuid[], p_questions uuid[]) returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
  v_round uuid;
  v_number integer;
  v_pos integer;
  v_group uuid[];
begin
  select * into s from public.quiz_settings where id = 1 for update;
  if s.tiebreak_mode <> 'extra' or s.status <> 'closed' then return jsonb_build_object('error', 'bad_transition'); end if;
  if exists (select 1 from public.quiz_rounds where status = 'open') then return jsonb_build_object('error', 'round_open'); end if;
  if coalesce(array_length(p_questions, 1), 0) < 1 then return jsonb_build_object('error', 'no_questions'); end if;

  select r.pos into v_pos from public.quiz_ranking(true) r where r.id = any (p_participants) limit 1;
  select array_agg(r.id) into v_group from public.quiz_ranking(true) r where r.pos = v_pos;
  if v_pos is null or coalesce(array_length(v_group, 1), 0) < 2 or not (v_group @> p_participants and p_participants @> v_group) then
    return jsonb_build_object('error', 'not_tied');
  end if;
  if exists (select 1 from unnest(p_questions) x where not exists (
      select 1 from public.quiz_questions q join public.quiz_answer_key k on k.question_id = q.id
      where q.id = x and q.round = 'extra' and q.active
        and not exists (select 1 from public.quiz_round_questions rq where rq.question_id = q.id))) then
    return jsonb_build_object('error', 'bad_question');
  end if;
  select coalesce(max(number), 0) + 1 into v_number from public.quiz_rounds;
  insert into public.quiz_rounds (number) values (v_number) returning id into v_round;
  insert into public.quiz_round_questions (round_id, question_id) select distinct v_round, x from unnest(p_questions) x;
  insert into public.quiz_round_members (round_id, participant_id) select v_round, x from unnest(v_group) x;
  return jsonb_build_object('ok', true, 'id', v_round, 'number', v_number);
end $$;

create or replace function public.quiz_round_close(p_round uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  perform 1 from public.quiz_settings where id = 1 for update;
  update public.quiz_rounds set status = 'closed', closed_at = now() where id = p_round and status = 'open';
  return case when found then jsonb_build_object('ok', true) else jsonb_build_object('error', 'not_found') end;
end $$;

-- Apaga SOMENTE participações do quiz (ensaio) e volta ao rascunho. Perguntas e gabarito ficam.
create or replace function public.quiz_reset() returns jsonb
language plpgsql set search_path = public as $$
declare
  s public.quiz_settings;
  v_n integer;
begin
  select * into s from public.quiz_settings where id = 1 for update;
  if s.status = 'open' then return jsonb_build_object('error', 'bad_transition'); end if;
  select count(*)::int into v_n from public.quiz_participants;
  delete from public.quiz_results where true;
  delete from public.quiz_rounds where true;
  delete from public.quiz_participants where true;
  update public.quiz_settings set status = 'draft', opened_at = null, closed_at = null, published_at = null, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'removed', v_n);
end $$;

-- ---------------------------------------------------------------------------
-- Permissões: só service_role. (O Supabase concede por padrão a anon/authenticated; aqui revogamos.)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  f regprocedure;
begin
  foreach t in array array['quiz_settings', 'quiz_questions', 'quiz_options', 'quiz_answer_key', 'quiz_participants',
                           'quiz_answers', 'quiz_rounds', 'quiz_round_questions', 'quiz_round_members', 'quiz_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'quiz\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Faz a API do Supabase enxergar as funções novas imediatamente.
notify pgrst, 'reload schema';
