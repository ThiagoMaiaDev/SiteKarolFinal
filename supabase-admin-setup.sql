-- Apoio para o painel administrativo.
-- Rode no SQL Editor do Supabase somente se esses itens ainda nao existirem.

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  perfil text not null check (perfil in ('administrador', 'recepcionista')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'usuarios' and policyname = 'usuarios_authenticated_read'
  ) then
    create policy "usuarios_authenticated_read"
    on public.usuarios for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'usuarios' and policyname = 'usuarios_authenticated_write'
  ) then
    create policy "usuarios_authenticated_write"
    on public.usuarios for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

alter table public.agendamentos
drop constraint if exists agendamentos_status_check;

alter table public.agendamentos
add constraint agendamentos_status_check
check (status in ('agendado', 'concluido', 'cancelado', 'nao_compareceu'));

insert into storage.buckets (id, name, public)
values ('servicos', 'servicos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'servicos_images_public_read'
  ) then
    create policy "servicos_images_public_read"
    on storage.objects for select
    to public
    using (bucket_id = 'servicos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'servicos_images_authenticated_write'
  ) then
    create policy "servicos_images_authenticated_write"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'servicos')
    with check (bucket_id = 'servicos');
  end if;
end $$;
