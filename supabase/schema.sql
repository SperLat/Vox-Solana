create extension if not exists pgcrypto;

create table if not exists public.project_vox_bounties (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  excerpt text not null,
  genre text not null default 'Fiction',
  reward_sol numeric(12, 6) not null check (reward_sol > 0),
  full_project_budget_sol numeric(12, 6),
  author_wallet text not null,
  status text not null default 'open' check (status in ('open', 'awarded', 'paid')),
  cover_art text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_vox_submissions (
  id text primary key default gen_random_uuid()::text,
  bounty_id text not null references public.project_vox_bounties(id) on delete cascade,
  narrator_name text not null,
  narrator_wallet text not null,
  audio_url text not null,
  note text not null default '',
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.project_vox_payments (
  id text primary key default gen_random_uuid()::text,
  bounty_id text not null references public.project_vox_bounties(id) on delete cascade,
  submission_id text not null references public.project_vox_submissions(id) on delete cascade,
  payer_wallet text not null,
  recipient_wallet text not null,
  amount_sol numeric(12, 6) not null check (amount_sol > 0),
  tx_signature text not null unique,
  memo text not null,
  status text not null default 'pending_verification' check (status in ('verified', 'pending_verification', 'verification_failed')),
  verified_at timestamptz,
  verification_error text,
  created_at timestamptz not null default now()
);

alter table public.project_vox_bounties add column if not exists full_project_budget_sol numeric(12, 6);
alter table public.project_vox_payments add column if not exists status text not null default 'pending_verification';
alter table public.project_vox_payments add column if not exists verified_at timestamptz;
alter table public.project_vox_payments add column if not exists verification_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_vox_bounties_full_project_budget_check'
  ) then
    alter table public.project_vox_bounties
      add constraint project_vox_bounties_full_project_budget_check
      check (full_project_budget_sol is null or full_project_budget_sol > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_vox_payments_status_check'
  ) then
    alter table public.project_vox_payments
      add constraint project_vox_payments_status_check
      check (status in ('verified', 'pending_verification', 'verification_failed'));
  end if;
end $$;

create index if not exists project_vox_submissions_bounty_id_idx on public.project_vox_submissions(bounty_id);
create index if not exists project_vox_payments_bounty_id_idx on public.project_vox_payments(bounty_id);
create index if not exists project_vox_payments_submission_id_idx on public.project_vox_payments(submission_id);

alter table public.project_vox_bounties enable row level security;
alter table public.project_vox_submissions enable row level security;
alter table public.project_vox_payments enable row level security;

drop policy if exists "Project Vox bounty reads" on public.project_vox_bounties;
create policy "Project Vox bounty reads" on public.project_vox_bounties for select using (true);

drop policy if exists "Project Vox bounty inserts" on public.project_vox_bounties;
create policy "Project Vox bounty inserts" on public.project_vox_bounties for insert with check (true);

drop policy if exists "Project Vox bounty updates" on public.project_vox_bounties;
create policy "Project Vox bounty updates" on public.project_vox_bounties for update using (true) with check (true);

drop policy if exists "Project Vox submission reads" on public.project_vox_submissions;
create policy "Project Vox submission reads" on public.project_vox_submissions for select using (true);

drop policy if exists "Project Vox submission inserts" on public.project_vox_submissions;
create policy "Project Vox submission inserts" on public.project_vox_submissions for insert with check (true);

drop policy if exists "Project Vox submission updates" on public.project_vox_submissions;
create policy "Project Vox submission updates" on public.project_vox_submissions for update using (true) with check (true);

drop policy if exists "Project Vox payment reads" on public.project_vox_payments;
create policy "Project Vox payment reads" on public.project_vox_payments for select using (true);

drop policy if exists "Project Vox payment inserts" on public.project_vox_payments;
create policy "Project Vox payment inserts" on public.project_vox_payments for insert with check (true);

insert into storage.buckets (id, name, public)
values ('project-vox-auditions', 'project-vox-auditions', true)
on conflict (id) do update set public = true;

drop policy if exists "Project Vox audition reads" on storage.objects;
create policy "Project Vox audition reads" on storage.objects for select using (bucket_id = 'project-vox-auditions');

drop policy if exists "Project Vox audition uploads" on storage.objects;
create policy "Project Vox audition uploads" on storage.objects for insert with check (bucket_id = 'project-vox-auditions');

drop policy if exists "Project Vox audition updates" on storage.objects;
create policy "Project Vox audition updates" on storage.objects for update using (bucket_id = 'project-vox-auditions') with check (bucket_id = 'project-vox-auditions');
