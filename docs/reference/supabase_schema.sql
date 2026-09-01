-- DailyWorkbench · 模型配置云端存储
-- 在 Supabase 控制台 → SQL Editor 中执行本文件即可。
-- 单用户方案：只用一行 (id='default') 存全部模型配置。

create table if not exists public.model_configs (
  id         text primary key default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 说明：
-- 1) 前端【不】持有任何 Supabase key，所有读写都经 server.py 中转，
--    服务端使用 service_role key（拥有绕过 RLS 的权限），key 永不离开本机。
-- 2) 因此这里无需为 anon 配置权限，也不强制开启 RLS；若你要更严格，可取消下一行注释。
-- alter table public.model_configs enable row level security;
