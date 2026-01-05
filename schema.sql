-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Demos Table
create table public.demos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  name text,
  url text,
  "order" integer default 0
);

-- Videos Table
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  youtube_id text,
  title text,
  "order" integer default 0
);

-- Studio Gear Table
create table public.studio_gear (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  name text,
  url text,
  "order" integer default 0
);

-- Clients Table
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  url text,
  "order" integer default 0
);

-- Reviews Table
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  text text,
  author text,
  "order" integer default 0
);

-- Site Settings Table
create table public.site_settings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null unique,
  hero_title text,
  hero_subtitle text,
  about_title text,
  about_text text,
  contact_email text,
  contact_phone text,
  site_name text,
  profile_image text,
  profile_cartoon text,
  show_cartoon boolean default true,
  clients_grayscale boolean default true,
  theme_color text,
  section_order jsonb default '["demos", "projects", "studio", "clients", "reviews", "about", "contact"]'::jsonb,
  font text default 'Outfit'
);

-- RLS Policies (Row Level Security)
-- Enable RLS on all tables
alter table public.demos enable row level security;
alter table public.videos enable row level security;
alter table public.studio_gear enable row level security;
alter table public.clients enable row level security;
alter table public.reviews enable row level security;
alter table public.site_settings enable row level security;

-- Policies
-- Allow anyone to READ (since it's a website)
create policy "Public Read Demos" on public.demos for select using (true);
create policy "Public Read Videos" on public.videos for select using (true);
create policy "Public Read Studio" on public.studio_gear for select using (true);
create policy "Public Read Clients" on public.clients for select using (true);
create policy "Public Read Reviews" on public.reviews for select using (true);
create policy "Public Read Settings" on public.site_settings for select using (true);

-- Allow Users to INSERT/UPDATE/DELETE their own data
create policy "User CRUD Demos" on public.demos for all using (auth.uid() = user_id);
create policy "User CRUD Videos" on public.videos for all using (auth.uid() = user_id);
create policy "User CRUD Studio" on public.studio_gear for all using (auth.uid() = user_id);
create policy "User CRUD Clients" on public.clients for all using (auth.uid() = user_id);
create policy "User CRUD Reviews" on public.reviews for all using (auth.uid() = user_id);
create policy "User CRUD Settings" on public.site_settings for all using (auth.uid() = user_id);
