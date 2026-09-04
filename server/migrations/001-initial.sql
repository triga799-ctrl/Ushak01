create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists app_entities (
  store text not null,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store, id),
  constraint app_entities_store_check check (store in (
    'tasks', 'documents', 'directories', 'users', 'messages',
    'notifications', 'reportTemplates', 'auditLog', 'meta'
  ))
);

create index if not exists app_entities_store_updated_idx on app_entities (store, updated_at desc);
create index if not exists app_entities_task_owner_idx on app_entities ((data->>'ownerId')) where store = 'tasks';
create index if not exists app_entities_message_sender_idx on app_entities ((data->>'senderId')) where store = 'messages';
create index if not exists app_entities_message_recipient_idx on app_entities ((data->>'recipientId')) where store = 'messages';
create index if not exists app_entities_notification_user_idx on app_entities ((data->>'userId')) where store = 'notifications';

create table if not exists auth_users (
  user_id text primary key,
  login text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists auth_users_login_lower_idx on auth_users (lower(login));

create table if not exists user_sessions (
  id uuid primary key,
  user_id text not null references auth_users(user_id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on user_sessions (user_id);
create index if not exists user_sessions_expires_at_idx on user_sessions (expires_at);

create table if not exists entity_files (
  id uuid primary key,
  entity_store text not null,
  entity_id text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null check (byte_size >= 0),
  content bytea not null,
  created_at timestamptz not null default now(),
  foreign key (entity_store, entity_id) references app_entities(store, id) on delete cascade
);

create index if not exists entity_files_entity_idx on entity_files (entity_store, entity_id);

create table if not exists audit_events (
  id bigint generated always as identity primary key,
  user_id text,
  action text not null,
  entity_store text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_idx on audit_events (created_at desc);
create index if not exists audit_events_user_idx on audit_events (user_id, created_at desc);
