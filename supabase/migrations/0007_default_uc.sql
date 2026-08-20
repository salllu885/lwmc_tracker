-- Amendment: a user with more than one active UC assignment (e.g. a
-- Supervisor covering two UCs) needs one marked as their default so the New
-- Issue form can auto-select it instead of picking whichever row happened to
-- come back first. At most one default per user, enforced with a partial
-- unique index (only counts active, default rows).
alter table public.user_assignments add column if not exists is_default boolean not null default false;

create unique index if not exists user_assignments_one_default_per_user
  on public.user_assignments(user_id)
  where is_default and is_active;
