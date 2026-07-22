/*
# TutorBoard Core Schema — Tables Only

Creates all foundational tables for TutorBoard. RLS policies are added in
a separate migration so cross-table policy references resolve correctly.

1. New Tables
- `profiles`: extends auth.users with display name and role.
- `sessions`: tutoring sessions with title, creator, join code, status.
- `session_participants`: users in a session with per-session role and draw permission.
- `board_events`: append-only event log (event sourcing) for whiteboard state.
- `hand_raises`: student hand-raise queue for each session.
- `reactions`: ephemeral emoji reactions from participants.

2. Important Notes
- Uses gen_random_uuid() for all primary keys.
- board_events.sequence_number is per-session monotonic, computed via trigger.
- join_code is unique and generated with a default 6-char random string.
- RLS is enabled on all tables but policies come in the next migration.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin','teacher','student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Session',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  join_code text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- SESSION_PARTICIPANTS
CREATE TABLE IF NOT EXISTS session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_session text NOT NULL DEFAULT 'student' CHECK (role_in_session IN ('admin','teacher','student')),
  can_draw boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (session_id, user_id)
);

-- BOARD_EVENTS (append-only event log)
CREATE TABLE IF NOT EXISTS board_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('stroke','text','erase','clear','laser','spotlight','spotlight_clear')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_number bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- HAND_RAISES
CREATE TABLE IF NOT EXISTS hand_raises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- REACTIONS
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hand_raises ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Sequence number trigger: per-session monotonic
CREATE OR REPLACE FUNCTION assign_board_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq bigint;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM board_events WHERE session_id = NEW.session_id;
  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_events_sequence_trigger ON board_events;
CREATE TRIGGER board_events_sequence_trigger
  BEFORE INSERT ON board_events
  FOR EACH ROW EXECUTE FUNCTION assign_board_event_sequence();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_events_session_seq ON board_events (session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants (session_id);
CREATE INDEX IF NOT EXISTS idx_handraises_session ON hand_raises (session_id, status);
CREATE INDEX IF NOT EXISTS idx_reactions_session ON reactions (session_id, created_at);
