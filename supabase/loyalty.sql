-- Table and RPC for loyalty accounts ensuring single source of truth

create table if not exists loyalty_accounts (
  user_id uuid primary key,
  stamps int not null default 0,
  free_drinks int not null default 0,
  updated_at timestamptz not null default now()
);

-- Function to award stamps without using aggregate FOR UPDATE
create or replace function award_loyalty_stamps(p_user_id uuid, p_stamps_to_award int)
returns void
language plpgsql
as $$
declare
  v_stamps int;
  v_free int;
begin
  -- lock the account row only
  update loyalty_accounts
  set stamps = stamps + p_stamps_to_award,
      updated_at = now()
  where user_id = p_user_id
  returning stamps into v_stamps;

  if not found then
    insert into loyalty_accounts(user_id, stamps)
    values (p_user_id, p_stamps_to_award)
    returning stamps into v_stamps;
  end if;

  v_free := floor(v_stamps / 10);
  if v_free > 0 then
    update loyalty_accounts
    set stamps = stamps - (v_free * 10),
        free_drinks = free_drinks + v_free,
        updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;
