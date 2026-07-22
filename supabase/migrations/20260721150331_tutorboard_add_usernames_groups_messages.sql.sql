/*
# Add usernames, groups, group_members, messages, and media storage

## Summary
Adds unique usernames to profiles so users can find each other (like Telegram).
Adds a groups system (like Discord) where any user can create a group with a
unique group_id and shareable URL. Members can chat in real-time with text,
emoji, images, files, and videos.

## Changes

### 1. profiles: add username column
- `username` (text, unique, not null) — Telegram-style unique handle.
- Auto-generates a username from the existing name for current rows.
- Triggers: auto-generate username on insert if not provided.

### 2. New table: groups
- `id` (uuid, pk)
- `name` (text, not null) — group display name
- `slug` (text, unique, not null) — URL-safe unique identifier for join URL
- `description` (text)
- `created_by` (uuid, not null, default auth.uid()) — group creator
- `avatar_url` (text) — optional group avatar
- `created_at` (timestamptz)

### 3. New table: group_members
- `id` (uuid, pk)
- `group_id` (uuid, fk -> groups.id cascade)
- `user_id` (uuid, not null, default auth.uid())
- `role` (text, default 'member') — 'owner' | 'admin' | 'member'
- `joined_at` (timestamptz)
- Unique constraint on (group_id, user_id)

### 4. New table: messages
- `id` (uuid, pk)
- `group_id` (uuid, fk -> groups.id cascade)
- `user_id` (uuid, not null, default auth.uid())
- `content` (text) — text/emoji content (null if media-only)
- `message_type` (text, default 'text') — 'text' | 'image' | 'file' | 'video' | 'sticker'
- `media_url` (text) — storage path for uploaded media
- `media_name` (text) — original file name
- `media_size` (bigint) — file size in bytes
- `created_at` (timestamptz)

### 5. Storage
- Public bucket 'group-media' for file/image/video uploads.

### 6. Security (RLS)
- groups: SELECT for all authenticated; INSERT for authenticated (creator);
  UPDATE/DELETE for owner.
- group_members: SELECT for authenticated; INSERT for authenticated
  (self-join); UPDATE/DELETE for owner or self.
- messages: SELECT for authenticated; INSERT for authenticated; DELETE for
  owner of message or group owner.
- profiles: updated SELECT to allow all authenticated (needed for username search).
- Storage policies: authenticated users can upload to group-media; anyone can read.
*/

-- ============ profiles: add username ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Backfill usernames for existing rows from name
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM public.profiles WHERE username IS NULL LOOP
    base := lower(regexp_replace(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'), '\s+', '', 'g'));
    IF base = '' THEN base := 'user'; END IF;
    candidate := base;
    n := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
      n := n + 1;
      candidate := base || n::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Auto-generate username on insert if not provided
CREATE OR REPLACE FUNCTION public.generate_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int;
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username <> '' THEN
    NEW.username := lower(regexp_replace(NEW.username, '[^a-z0-9_]', '', 'g'));
    RETURN NEW;
  END IF;
  base := lower(regexp_replace(regexp_replace(COALESCE(NEW.name, 'user'), '[^a-zA-Z0-9]', '', 'g'), '\s+', '', 'g'));
  IF base = '' THEN base := 'user'; END IF;
  candidate := base;
  n := 0;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  NEW.username := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_generate_username ON public.profiles;
CREATE TRIGGER profiles_generate_username
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_username();

-- Update profiles SELECT policy to allow all authenticated (for username search)
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============ groups ============
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_all" ON public.groups;
CREATE POLICY "groups_select_all"
  ON public.groups FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "groups_insert_creator" ON public.groups;
CREATE POLICY "groups_insert_creator"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
CREATE POLICY "groups_update_owner"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;
CREATE POLICY "groups_delete_owner"
  ON public.groups FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ============ group_members ============
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;
CREATE POLICY "group_members_select_all"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_members_update_self_or_owner" ON public.group_members;
CREATE POLICY "group_members_update_self_or_owner"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT created_by FROM public.groups WHERE groups.id = group_members.group_id))
  WITH CHECK (auth.uid() = user_id OR auth.uid() = (SELECT created_by FROM public.groups WHERE groups.id = group_members.group_id));

DROP POLICY IF EXISTS "group_members_delete_self_or_owner" ON public.group_members;
CREATE POLICY "group_members_delete_self_or_owner"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT created_by FROM public.groups WHERE groups.id = group_members.group_id));

-- ============ messages ============
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  media_url text,
  media_name text,
  media_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_all" ON public.messages;
CREATE POLICY "messages_select_all"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "messages_insert_self" ON public.messages;
CREATE POLICY "messages_insert_self"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_delete_owner" ON public.messages;
CREATE POLICY "messages_delete_owner"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT created_by FROM public.groups WHERE groups.id = messages.group_id));

CREATE INDEX IF NOT EXISTS idx_messages_group_created ON public.messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_groups_slug ON public.groups (slug);

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-media', 'group-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "group_media_read" ON storage.objects;
CREATE POLICY "group_media_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'group-media');

DROP POLICY IF EXISTS "group_media_upload" ON storage.objects;
CREATE POLICY "group_media_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'group-media');

DROP POLICY IF EXISTS "group_media_delete" ON storage.objects;
CREATE POLICY "group_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'group-media');
