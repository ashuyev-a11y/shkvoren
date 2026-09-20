-- Каталог запчастей ГАЗ/УАЗ — схема Supabase (PostgreSQL)
-- Этап 1: склад + каталог + цены конкурентов + лиды/заказы из всех каналов

create extension if not exists pg_trgm;

-- Модели и двигатели (справочник применимости)
create table vehicle_models (
  id          serial primary key,
  brand       text not null check (brand in ('ГАЗ','УАЗ')),
  name        text not null,              -- 'Газель Бизнес', 'УАЗ Патриот'
  aliases     text[] default '{}',        -- 'буханка', 'таблетка', '3302'
  unique (brand, name)
);

create table engines (
  id      serial primary key,
  name    text unique not null,           -- 'ЗМЗ-405', 'УМЗ-4216'
  aliases text[] default '{}'
);

-- Товар
create table parts (
  id            uuid primary key default gen_random_uuid(),
  sku           text unique not null,     -- G-0001 / U-0001
  catalog_no    text,                     -- как на детали: 3302-1601090
  catalog_norm  text generated always as (upper(regexp_replace(coalesce(catalog_no,''), '[^0-9A-Za-zА-Яа-я]', '', 'g'))) stored,
  title         text not null,
  unit_group    text,                     -- узел: Сцепление, Тормоза...
  manufacturer  text,
  condition     text not null default 'Новый',
  qty           int  not null default 0 check (qty >= 0),
  location      text,                     -- С1-П2
  cost_price    numeric(12,2),
  price         numeric(12,2),
  abc           char(1) check (abc in ('A','B','C')),
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index parts_catalog_norm_idx on parts (catalog_norm);
create index parts_title_trgm_idx   on parts using gin (title gin_trgm_ops);

-- Применимость (многие-ко-многим)
create table part_fitment (
  part_id   uuid not null references parts(id) on delete cascade,
  model_id  int  not null references vehicle_models(id),
  engine_id int  references engines(id)      -- NULL = подходит к любому двигателю
);
create unique index part_fitment_uniq on part_fitment (part_id, model_id, coalesce(engine_id, 0));

-- Кросс-номера / аналоги (старый и новый номер, номера других производителей)
create table part_cross (
  part_id     uuid references parts(id) on delete cascade,
  cross_no    text not null,
  cross_norm  text generated always as (upper(regexp_replace(cross_no, '[^0-9A-Za-zА-Яа-я]', '', 'g'))) stored,
  primary key (part_id, cross_no)
);
create index part_cross_norm_idx on part_cross (cross_norm);

create table part_photos (
  id        uuid primary key default gen_random_uuid(),
  part_id   uuid references parts(id) on delete cascade,
  url       text not null,
  sort      int default 0
);

-- Мониторинг цен конкурентов (Kolesa, Kaspi, другие)
create table competitor_prices (
  id         bigserial primary key,
  part_id    uuid references parts(id) on delete cascade,
  source     text not null check (source in ('kolesa','kaspi','other')),
  price      numeric(12,2) not null,
  url        text,
  seen_at    timestamptz not null default now()
);

-- Публикация в каналах
create table channel_listings (
  part_id     uuid references parts(id) on delete cascade,
  channel     text not null check (channel in ('kaspi','kolesa','site','2gis')),
  external_id text,
  status      text not null default 'draft',  -- draft / active / paused / error
  synced_at   timestamptz,
  primary key (part_id, channel)
);

-- Клиенты: розница, СТО, организации (парки), госзаказчики
create table customers (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'retail' check (kind in ('retail','sto','fleet','gov','dealer')),
  name       text,
  phone      text unique,
  bin_iin    text,
  city       text,
  discount   numeric(5,2) default 0,
  source     text,                       -- whatsapp / kaspi / kolesa / 2gis / walk-in
  created_at timestamptz default now()
);

-- Запросы (что спрашивали — даже если не было в наличии: это данные для закупки)
create table inquiries (
  id          bigserial primary key,
  customer_id uuid references customers(id),
  channel     text not null,
  query_text  text,                      -- «корзина сцепления на буханку 409»
  matched_part uuid references parts(id),
  in_stock    boolean,
  created_at  timestamptz default now()
);

create table orders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  channel     text not null,
  status      text not null default 'new',  -- new / reserved / paid / shipped / done / cancelled
  total       numeric(12,2) default 0,
  created_at  timestamptz default now()
);

create table order_items (
  order_id  uuid references orders(id) on delete cascade,
  part_id   uuid references parts(id),
  qty       int not null check (qty > 0),
  price     numeric(12,2) not null,
  primary key (order_id, part_id)
);

-- Поиск: по номеру (точный и кросс) + по тексту
create or replace function search_parts(q text)
returns setof parts language sql stable as $$
  with n as (select upper(regexp_replace(q, '[^0-9A-Za-zА-Яа-я]', '', 'g')) as norm)
  select p.* from parts p, n
   where p.is_active and (
         p.catalog_norm = n.norm
      or exists (select 1 from part_cross c where c.part_id = p.id and c.cross_norm = n.norm)
      or p.title % q
   )
   order by (p.catalog_norm = n.norm) desc, similarity(p.title, q) desc
   limit 20;
$$;

-- updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger parts_touch before update on parts for each row execute function touch_updated_at();
