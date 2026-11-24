-- Quiz do Chá da Alana: modo misterioso do ranking ao vivo.
-- Só acrescenta (nada é apagado nem alterado) e pode ser executado mais de uma vez.

alter table public.quiz_settings add column if not exists live_mystery boolean not null default false;

create or replace function public.quiz_mystery() returns boolean
language sql stable set search_path = public as $$
  select live_mystery from public.quiz_settings where id = 1;
$$;

create or replace function public.quiz_set_mystery(p_on boolean) returns jsonb
language plpgsql set search_path = public as $$
begin
  update public.quiz_settings set live_mystery = coalesce(p_on, false), updated_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.quiz_mystery() from public, anon, authenticated;
revoke execute on function public.quiz_set_mystery(boolean) from public, anon, authenticated;
grant execute on function public.quiz_mystery() to service_role;
grant execute on function public.quiz_set_mystery(boolean) to service_role;

notify pgrst, 'reload schema';
