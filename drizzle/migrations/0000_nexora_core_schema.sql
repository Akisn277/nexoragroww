-- ============ enums ============
create type public.attention_sensitivity as enum ('conservative','balanced','sensitive');
create type public.item_priority as enum ('normal','high');
create type public.data_freshness as enum ('fresh','delayed','stale');
create type public.market_event_type as enum ('earnings','dividend','split','bonus','announcement');
create type public.event_importance as enum ('low','medium','high');
create type public.change_status as enum ('NEW','SEEN','ACKNOWLEDGED');

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  last_seen_at timestamptz,
  attention_sensitivity public.attention_sensitivity not null default 'balanced',
  default_watchlist_id uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============ watchlists ============
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index watchlists_user_idx on public.watchlists(user_id);
create unique index watchlists_user_name_uniq on public.watchlists(user_id, lower(name));
grant select, insert, update, delete on public.watchlists to authenticated;
grant all on public.watchlists to service_role;
alter table public.watchlists enable row level security;
create policy "own watchlists" on public.watchlists for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.profiles
  add constraint profiles_default_watchlist_fk
  foreign key (default_watchlist_id) references public.watchlists(id) on delete set null;

-- ============ watchlist_items ============
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  symbol text not null check (symbol = upper(symbol) and length(symbol) between 1 and 20),
  priority public.item_priority not null default 'normal',
  added_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);
create index watchlist_items_watchlist_idx on public.watchlist_items(watchlist_id);
grant select, insert, update, delete on public.watchlist_items to authenticated;
grant all on public.watchlist_items to service_role;
alter table public.watchlist_items enable row level security;
create policy "own watchlist items" on public.watchlist_items for all to authenticated
  using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));

-- ============ market_snapshots (shared reference market data) ============
create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  company_name text not null,
  price numeric(14,2) not null check (price > 0),
  change_percent numeric(8,2) not null,
  volume bigint not null check (volume >= 0),
  avg_volume bigint not null check (avg_volume > 0),
  volatility numeric(8,2) not null check (volatility >= 0),
  benchmark_change numeric(8,2) not null default 0,
  sector_change numeric(8,2) not null default 0,
  observed_at timestamptz not null,
  source text not null default 'demo',
  freshness public.data_freshness not null default 'fresh',
  unique (symbol, observed_at)
);
create index market_snapshots_symbol_time_idx on public.market_snapshots(symbol, observed_at desc);
grant select on public.market_snapshots to authenticated, anon;
grant all on public.market_snapshots to service_role;
alter table public.market_snapshots enable row level security;
create policy "market snapshots readable" on public.market_snapshots for select to authenticated, anon using (true);

-- ============ market_events ============
create table public.market_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  event_type public.market_event_type not null,
  title text not null,
  description text,
  importance public.event_importance not null default 'medium',
  event_time timestamptz not null,
  source text not null default 'demo',
  unique (symbol, event_type, event_time)
);
create index market_events_symbol_time_idx on public.market_events(symbol, event_time desc);
grant select on public.market_events to authenticated, anon;
grant all on public.market_events to service_role;
alter table public.market_events enable row level security;
create policy "market events readable" on public.market_events for select to authenticated, anon using (true);

-- ============ attention_events ============
create table public.attention_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  snapshot_id uuid not null references public.market_snapshots(id) on delete cascade,
  attention_score integer not null check (attention_score between 0 and 100),
  market_significance integer not null check (market_significance between 0 and 100),
  personal_relevance integer not null check (personal_relevance between 0 and 100),
  status public.change_status not null default 'NEW',
  detected_at timestamptz not null default now(),
  unique (user_id, snapshot_id)
);
create index attention_events_user_status_idx on public.attention_events(user_id, status, detected_at desc);
grant select, insert, update, delete on public.attention_events to authenticated;
grant all on public.attention_events to service_role;
alter table public.attention_events enable row level security;
create policy "own attention events" on public.attention_events for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ new-user bootstrap ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_watchlist uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.watchlists (user_id, name) values (new.id, 'My Watchlist')
  returning id into new_watchlist;

  insert into public.watchlist_items (watchlist_id, symbol, priority) values
    (new_watchlist, 'RELIANCE', 'high'),
    (new_watchlist, 'TCS', 'normal'),
    (new_watchlist, 'INFY', 'normal'),
    (new_watchlist, 'HDFCBANK', 'high'),
    (new_watchlist, 'ICICIBANK', 'normal'),
    (new_watchlist, 'SBIN', 'normal'),
    (new_watchlist, 'ITC', 'normal'),
    (new_watchlist, 'LT', 'normal'),
    (new_watchlist, 'MARUTI', 'normal'),
    (new_watchlist, 'AXISBANK', 'normal'),
    (new_watchlist, 'BHARTIARTL', 'normal'),
    (new_watchlist, 'SUNPHARMA', 'normal'),
    (new_watchlist, 'WIPRO', 'normal'),
    (new_watchlist, 'ADANIENT', 'normal'),
    (new_watchlist, 'TATAMOTORS', 'normal');

  update public.profiles set default_watchlist_id = new_watchlist where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ seeded deterministic demo market data ============
with base(symbol, company, price, chg, volume, avgvol, vol_typ, sector_chg, fresh_min) as (values
  ('RELIANCE','Reliance Industries',1376.00,-3.64,20720000,7400000,0.89,-1.10,4),
  ('TCS','Tata Consultancy Services',3896.00,1.96,4930000,2900000,1.05,0.95,4),
  ('INFY','Infosys',1542.00,0.13,6100000,5800000,0.98,0.95,4),
  ('HDFCBANK','HDFC Bank',1695.00,0.59,11200000,10100000,0.74,0.31,5),
  ('ICICIBANK','ICICI Bank',1249.00,0.32,9400000,9100000,0.81,0.31,5),
  ('SBIN','State Bank of India',809.00,-0.37,12600000,12000000,1.02,0.31,5),
  ('ITC','ITC',449.00,0.22,8900000,8600000,0.64,0.18,6),
  ('LT','Larsen & Toubro',3612.00,-0.22,2100000,2000000,0.92,-0.40,6),
  ('MARUTI','Maruti Suzuki India',12805.00,0.20,610000,590000,0.87,0.12,6),
  ('AXISBANK','Axis Bank',1128.00,-0.35,7300000,7100000,0.94,0.31,6),
  ('BHARTIARTL','Bharti Airtel',1601.00,0.38,5200000,5000000,0.79,0.44,7),
  ('SUNPHARMA','Sun Pharmaceutical Industries',1774.00,-0.34,1900000,1850000,0.86,-0.20,190),
  ('WIPRO','Wipro',533.00,-2.20,9800000,8100000,0.83,0.95,7),
  ('ADANIENT','Adani Enterprises',2402.00,0.92,15300000,4500000,1.42,0.30,5),
  ('TATAMOTORS','Tata Motors',1013.00,2.84,14100000,9600000,1.12,0.62,5)
),
hist as (
  select b.*, i,
    (b.price / (1 + b.chg / 100.0)) as pre_price,
    case when i % 2 = 0 then 1 else -1 end as dir
  from base b cross join generate_series(1,4) as i
)
insert into public.market_snapshots
  (symbol, company_name, price, change_percent, volume, avg_volume, volatility, benchmark_change, sector_change, observed_at, source, freshness)
select
  symbol, company,
  round((pre_price * (1 + dir * 0.004 * i))::numeric, 2),
  round((dir * vol_typ * 0.55)::numeric, 2),
  (avgvol * (0.88 + 0.06 * i))::bigint,
  avgvol,
  round((vol_typ * (1 - 0.015 * i))::numeric, 2),
  round((dir * 0.18)::numeric, 2),
  round((dir * 0.24)::numeric, 2),
  date_trunc('minute', now()) - (i || ' days')::interval,
  'demo-seed',
  'fresh'
from hist;

with base(symbol, company, price, chg, volume, avgvol, vol_typ, sector_chg, fresh_min) as (values
  ('RELIANCE','Reliance Industries',1376.00,-3.64,20720000,7400000,0.89,-1.10,4),
  ('TCS','Tata Consultancy Services',3896.00,1.96,4930000,2900000,1.05,0.95,4),
  ('INFY','Infosys',1542.00,0.13,6100000,5800000,0.98,0.95,4),
  ('HDFCBANK','HDFC Bank',1695.00,0.59,11200000,10100000,0.74,0.31,5),
  ('ICICIBANK','ICICI Bank',1249.00,0.32,9400000,9100000,0.81,0.31,5),
  ('SBIN','State Bank of India',809.00,-0.37,12600000,12000000,1.02,0.31,5),
  ('ITC','ITC',449.00,0.22,8900000,8600000,0.64,0.18,6),
  ('LT','Larsen & Toubro',3612.00,-0.22,2100000,2000000,0.92,-0.40,6),
  ('MARUTI','Maruti Suzuki India',12805.00,0.20,610000,590000,0.87,0.12,6),
  ('AXISBANK','Axis Bank',1128.00,-0.35,7300000,7100000,0.94,0.31,6),
  ('BHARTIARTL','Bharti Airtel',1601.00,0.38,5200000,5000000,0.79,0.44,7),
  ('SUNPHARMA','Sun Pharmaceutical Industries',1774.00,-0.34,1900000,1850000,0.86,-0.20,190),
  ('WIPRO','Wipro',533.00,-2.20,9800000,8100000,0.83,0.95,7),
  ('ADANIENT','Adani Enterprises',2402.00,0.92,15300000,4500000,1.42,0.30,5),
  ('TATAMOTORS','Tata Motors',1013.00,2.84,14100000,9600000,1.12,0.62,5)
)
insert into public.market_snapshots
  (symbol, company_name, price, change_percent, volume, avg_volume, volatility, benchmark_change, sector_change, observed_at, source, freshness)
select
  symbol, company, price, chg, volume, avgvol, vol_typ, -0.42, sector_chg,
  date_trunc('minute', now()) - (fresh_min || ' minutes')::interval,
  'demo-seed',
  case when fresh_min <= 10 then 'fresh'::public.data_freshness
       when fresh_min <= 30 then 'delayed'::public.data_freshness
       else 'stale'::public.data_freshness end
from base;

insert into public.market_events (symbol, event_type, title, description, importance, event_time) values
  ('RELIANCE','earnings','Quarterly results announced','Q2 consolidated results released to the exchanges.','high', date_trunc('minute', now()) - interval '95 minutes'),
  ('HDFCBANK','earnings','Quarterly results announced','Quarterly earnings filing published on the exchange.','high', date_trunc('minute', now()) - interval '3 hours'),
  ('ITC','dividend','Interim dividend declared','Board declared an interim dividend with record date set.','medium', date_trunc('minute', now()) - interval '6 hours'),
  ('TATAMOTORS','announcement','Monthly sales update','Company published its monthly wholesale volume update.','medium', date_trunc('minute', now()) - interval '5 hours');
