-- Schema + RLS for the marketplace entities (source of truth, applied to Supabase).

create table if not exists public._entity_base (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.entity_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(auth.role(), '') <> 'service_role' then
      new.created_by_id := auth.uid()::text;
      new.created_by := auth.jwt()->>'email';
    end if;
    new.created_date := coalesce(new.created_date, now());
  else
    new.created_by_id := old.created_by_id;
    new.created_by := old.created_by;
    new.created_date := old.created_date;
  end if;
  new.updated_date := now();
  return new;
end $$;
revoke execute on function public.entity_before_write() from public, anon, authenticated;

-- Helper: RLS + audit trigger + one policy per operation (empty expression = operation denied).
create or replace function public._mk_entity(t text, r text, c text, u text, d text, rt boolean) returns void
language plpgsql as $f$
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('drop trigger if exists %I on public.%I', t||'_write', t);
  execute format('create trigger %I before insert or update on public.%I for each row execute function public.entity_before_write()', t||'_write', t);
  execute format('drop policy if exists %I on public.%I', t||'_read', t);
  execute format('drop policy if exists %I on public.%I', t||'_create', t);
  execute format('drop policy if exists %I on public.%I', t||'_update', t);
  execute format('drop policy if exists %I on public.%I', t||'_delete', t);
  if r <> '' then execute format('create policy %I on public.%I for select to anon, authenticated using (%s)', t||'_read', t, r); end if;
  if c <> '' then execute format('create policy %I on public.%I for insert to anon, authenticated with check (%s)', t||'_create', t, c); end if;
  if u <> '' then execute format('create policy %I on public.%I for update to anon, authenticated using (%s) with check (%s)', t||'_update', t, u, u); end if;
  if d <> '' then execute format('create policy %I on public.%I for delete to anon, authenticated using (%s)', t||'_delete', t, d); end if;
  if rt then
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end if;
end $f$;
revoke execute on function public._mk_entity(text,text,text,text,text,boolean) from public, anon, authenticated;

create table if not exists public.audit_logs (
  like public._entity_base including all,
  actor_email text,
  actor_id text,
  action text,
  target_type text,
  target_id text,
  details text
);
select public._mk_entity('audit_logs','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.country_configs (
  like public._entity_base including all,
  code text,
  name text,
  currency text default 'USD',
  flag text,
  shipping numeric default 0,
  tax_rate numeric default 0,
  duty_rate numeric default 0,
  providers jsonb,
  financing_enabled boolean default true,
  delivery_days numeric default 7,
  enabled boolean default true
);
select public._mk_entity('country_configs','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.crawler_jobs (
  like public._entity_base including all,
  type text,
  source_id text,
  product_id text,
  url text,
  priority numeric default 5,
  payload jsonb,
  status text default 'QUEUED',
  attempts numeric default 0,
  max_attempts numeric default 3,
  scheduled_at text,
  started_at text,
  completed_at text,
  last_error text,
  locked_at text,
  locked_by text,
  result text
);
select public._mk_entity('crawler_jobs','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',true);

create table if not exists public.crawler_sources (
  like public._entity_base including all,
  name text,
  base_url text,
  adapter text default 'FEED_JSON',
  feed_url text,
  feed_pagination boolean default false,
  items_path text,
  field_map jsonb,
  url_pattern text,
  seed_urls jsonb,
  enabled boolean default true,
  status text default 'ACTIVE',
  priority numeric default 5,
  crawl_interval_minutes numeric default 720,
  requests_per_minute numeric default 10,
  max_products_per_run numeric default 30,
  max_depth numeric default 2,
  default_currency text default 'USD',
  supplier_score numeric default 80,
  available_countries jsonb,
  allowed_domains jsonb,
  reviews_enabled boolean default false,
  last_run text,
  next_run text,
  last_success text,
  last_error text,
  urls_discovered numeric default 0,
  products_discovered numeric default 0,
  products_found numeric default 0,
  products_validated numeric default 0,
  products_rejected numeric default 0,
  images_found numeric default 0,
  images_failed numeric default 0,
  products_updated numeric default 0,
  products_failed numeric default 0,
  success_rate numeric default 100
);
select public._mk_entity('crawler_sources','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',true);

create table if not exists public.currency_rates (
  like public._entity_base including all,
  code text,
  name text,
  symbol text,
  rate numeric,
  updated_by text
);
select public._mk_entity('currency_rates','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.disputes (
  like public._entity_base including all,
  intent_id text,
  order_number text,
  provider text,
  external_id text,
  amount numeric,
  currency text default 'USD',
  reason text,
  status text default 'OPEN',
  due_by text,
  evidence text,
  resolved_at text
);
select public._mk_entity('disputes','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.github_projects (
  like public._entity_base including all,
  full_name text,
  name text,
  owner text,
  description text,
  html_url text,
  private boolean default false,
  language text,
  stars numeric default 0,
  open_prs numeric default 0,
  pushed_at text,
  synced_at text
);
select public._mk_entity('github_projects','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.github_pull_requests (
  like public._entity_base including all,
  github_id text,
  project_full_name text,
  number numeric,
  title text,
  body text,
  author text,
  author_avatar text,
  draft boolean default false,
  html_url text,
  state text default 'OPEN',
  created_at text,
  updated_at text
);
select public._mk_entity('github_pull_requests','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.hero_slides (
  like public._entity_base including all,
  title text,
  subtitle text,
  badge text,
  stock_label text,
  image_url text,
  image_mobile_url text,
  link_url text,
  cta_label text default 'Shop now',
  sort_order numeric default 0,
  active boolean default true,
  active_from text,
  active_to text
);
select public._mk_entity('hero_slides','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.offers (
  like public._entity_base including all,
  product_id text,
  seller_id text,
  seller_name text,
  source_id text,
  source_product_id text,
  source_url text,
  source_price numeric,
  currency text default 'USD',
  supplier_currency text,
  shipping_cost numeric default 0,
  stock_status text default 'UNKNOWN',
  delivery_days numeric default 7,
  countries jsonb,
  supplier_score numeric default 80,
  last_checked text,
  stale boolean default false
);
select public._mk_entity('offers','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.orders (
  like public._entity_base including all,
  order_number text,
  customer_email text,
  customer_name text,
  items jsonb,
  subtotal numeric,
  discount numeric default 0,
  coupon_code text,
  shipping numeric default 0,
  tax numeric default 0,
  total numeric,
  currency text default 'USD',
  country text,
  payment_provider text,
  down_payment numeric,
  installment_count numeric default 0,
  installment_amount numeric default 0,
  price_snapshot jsonb,
  status text default 'PENDING_PAYMENT',
  address jsonb,
  tracking_number text
);
select public._mk_entity('orders','(((created_by_id = auth.uid()::text) or (lower(customer_email) = lower(coalesce(auth.jwt()->>''email'',''''))) or (public.is_admin())))','(true) and status = ''PENDING_PAYMENT''','(public.is_admin())','(public.is_admin())',true);

create table if not exists public.payment_intents (
  like public._entity_base including all,
  order_number text,
  provider text,
  amount numeric,
  currency text default 'USD',
  status text default 'CREATED',
  external_id text,
  idempotency_key text,
  payment_mode text default 'PAY_NOW',
  down_payment numeric,
  installment_count numeric default 0,
  installment_amount numeric default 0,
  risk_score numeric default 0,
  risk_flags jsonb,
  failure_reason text,
  confirmed_at text,
  metadata jsonb
);
select public._mk_entity('payment_intents','(((created_by_id = auth.uid()::text) or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.pricing_change_logs (
  like public._entity_base including all,
  admin_email text,
  field text,
  old_value text,
  new_value text,
  details text
);
select public._mk_entity('pricing_change_logs','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.pricing_configs (
  like public._entity_base including all,
  margin_percent numeric default 30,
  payment_fee_percent numeric default 0,
  financing_fee_percent numeric default 0,
  shipping_fee_default numeric default 0,
  partner_commission_percent numeric default 10,
  first_installment_percent numeric default 15,
  default_plan_id text default 'plan_5',
  rounding text default 'cent',
  installment_plans jsonb,
  category_rules jsonb,
  country_rules jsonb,
  supplier_rules jsonb,
  active boolean default true
);
select public._mk_entity('pricing_configs','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.products (
  like public._entity_base including all,
  name text,
  slug text,
  brand text,
  model text,
  sku text,
  gtin text,
  mpn text,
  badge text,
  category text,
  source_price numeric,
  customer_price numeric,
  currency text default 'USD',
  image_url text,
  gallery jsonb,
  image_status text default 'COMPLETE',
  videos jsonb,
  description text,
  specifications jsonb,
  rating numeric default 4.8,
  reviews_count numeric default 0,
  stock_status text default 'IN_STOCK',
  veyro_stock numeric default 0,
  reserved_stock numeric default 0,
  veyro_allocated_stock numeric default 0,
  available_to_sell numeric default 0,
  premium_score numeric default 95,
  premium_status text default 'REVIEW',
  match_confidence numeric default 0.97,
  data_quality_score numeric default 0,
  review_reason text,
  status text default 'REVIEW',
  refresh_tier text default 'AUTO',
  seo_title text,
  meta_description text,
  source_id text,
  source_name text default 'Authorized Merchant',
  source_product_id text,
  source_url text,
  canonical_url text,
  last_crawled_at text,
  first_seen_at text,
  available_date text,
  variant_info jsonb,
  previous_price numeric,
  price_changed_at text,
  stock_changed_at text,
  available_countries jsonb,
  delivery_days numeric default 5
);
select public._mk_entity('products','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',true);

create table if not exists public.promotions (
  like public._entity_base including all,
  name text,
  label text,
  description text,
  kind text default 'AUTOMATIC',
  code text,
  discount_type text default 'PERCENT',
  value numeric default 10,
  scope text default 'ALL',
  categories jsonb,
  brands jsonb,
  product_ids jsonb,
  min_order_usd numeric default 0,
  max_discount_usd numeric default 0,
  usage_limit numeric default 0,
  usage_count numeric default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean default true,
  priority numeric default 5
);
select public._mk_entity('promotions','(((kind = ''AUTOMATIC'') or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.psp_credentials (
  like public._entity_base including all,
  provider text,
  label text,
  enabled boolean default false,
  mode text default 'TEST',
  credentials jsonb,
  hints jsonb,
  configured boolean default false,
  updated_by text
);
select public._mk_entity('psp_credentials','','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.psp_webhook_events (
  like public._entity_base including all,
  provider text,
  event_type text,
  external_id text,
  signature_valid boolean default false,
  processed boolean default false,
  status text default 'RECEIVED',
  order_number text,
  intent_id text,
  amount numeric,
  currency text,
  error text
);
select public._mk_entity('psp_webhook_events','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',true);

create table if not exists public.refunds (
  like public._entity_base including all,
  intent_id text,
  order_number text,
  amount numeric,
  currency text default 'USD',
  reason text default 'CUSTOMER_REQUEST',
  status text default 'PENDING',
  external_id text,
  requested_by text,
  processed_at text
);
select public._mk_entity('refunds','(((created_by_id = auth.uid()::text) or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.reviews (
  like public._entity_base including all,
  product_id text,
  product_slug text,
  rating numeric,
  title text,
  text text,
  photos jsonb,
  verified_buyer boolean default false,
  invited_buyer boolean default false,
  order_id text,
  order_number text,
  status text default 'PENDING',
  flag_reason text,
  report_count numeric default 0,
  reported boolean default false,
  moderation_reason text,
  moderated_by text,
  moderated_at text,
  edit_count numeric default 0,
  last_edited_at text
);
select public._mk_entity('reviews','(((status = ''PUBLISHED'') or (created_by_id = auth.uid()::text) or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.review_invitations (
  like public._entity_base including all,
  product_id text,
  product_slug text,
  product_name text,
  email text,
  invited_by text,
  status text default 'PENDING',
  used_at text
);
select public._mk_entity('review_invitations','(((((lower(email) = lower(coalesce(auth.jwt()->>''email'',''''))) and (status = ''PENDING''))) or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.search_queries (
  like public._entity_base including all,
  query text,
  country text,
  mode text default 'suggest',
  results_count numeric default 0
);
select public._mk_entity('search_queries','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.sellers (
  like public._entity_base including all,
  name text,
  source_id text,
  website text,
  countries jsonb,
  supplier_score numeric default 80,
  verified boolean default true,
  active boolean default true
);
select public._mk_entity('sellers','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.site_settings (
  like public._entity_base including all,
  key text,
  value text,
  description text
);
select public._mk_entity('site_settings','true','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.source_reviews (
  like public._entity_base including all,
  product_id text,
  source_id text,
  source_name text,
  author text,
  rating numeric,
  text text,
  review_date text,
  votes numeric default 0,
  review_url text,
  status text default 'ACTIVE',
  imported_at text
);
select public._mk_entity('source_reviews','(((status = ''ACTIVE'') or (public.is_admin())))','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.stock_movements (
  like public._entity_base including all,
  product_id text,
  product_name text,
  qty numeric,
  old_stock numeric,
  new_stock numeric,
  reason text,
  order_number text,
  actor_email text
);
select public._mk_entity('stock_movements','(public.is_admin())','(public.is_admin())','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.support_tickets (
  like public._entity_base including all,
  subject text,
  message text,
  email text,
  topic text default 'other',
  order_number text,
  status text default 'OPEN',
  reply text
);
select public._mk_entity('support_tickets','(((created_by_id = auth.uid()::text) or (public.is_admin())))','true','(public.is_admin())','(public.is_admin())',false);

create table if not exists public.wishlist_items (
  like public._entity_base including all,
  product_id text,
  product_slug text,
  price_at_add numeric,
  currency_at_add text default 'USD'
);
select public._mk_entity('wishlist_items','(created_by_id = auth.uid()::text)','(created_by_id = auth.uid()::text)','(created_by_id = auth.uid()::text)','(created_by_id = auth.uid()::text)',true);

drop table public._entity_base;
