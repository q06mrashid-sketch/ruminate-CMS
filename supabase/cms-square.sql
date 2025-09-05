-- Map a CMS item to its Square Catalog object
create table if not exists public.cms_square_map (
  cms_kind text not null check (cms_kind in ('item','syrup','coffee_blend')),
  cms_category text,      -- coffee | not-coffee | specials | pif (for items)
  cms_suffix text,        -- e.g. latte, cappuccino, vanilla, house-blend
  drink boolean default false,
  square_object_id text not null,     -- ITEM or MODIFIER id
  square_object_type text not null,   -- 'ITEM' | 'MODIFIER' | 'MODIFIER_LIST'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (cms_kind, coalesce(cms_category,''), coalesce(cms_suffix,''), coalesce(drink,false))
);

-- One row to hold the Syrups modifier-list ID and Coffee Blend modifier-list ID
create table if not exists public.cms_square_lists (
  name text primary key,  -- 'SYRUPS' or 'COFFEE_BLEND'
  square_modifier_list_id text not null,
  updated_at timestamp with time zone default now()
);
