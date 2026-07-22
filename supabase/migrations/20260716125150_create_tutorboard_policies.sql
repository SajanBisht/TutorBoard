/*
# TutorBoard RLS Policies + Realtime

1. Security
- Profiles: users read/update own; admins read all.
- Sessions: authenticated can read sessions they're in or created; creators can insert/update own.
- Participants: session members read; self-insert on join; teachers/admins update draw permission.
- Board events: session participants read; only those with can_draw (or laser) insert.
- Hand raises: session members read; students insert own; teachers update (resolve).
- Reactions: session members read; participants insert own.

2. Realtime
- Adds board_events, session_participants, hand_raises, reactions to supabase_realtime publication.
*/

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SESSIONS policies
DROP POLICY IF EXISTS "sessions_select_participants" ON sessions;
CREATE POLICY "sessions_select_participants" ON sessions FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sessions_insert_creator" ON sessions;
CREATE POLICY "sessions_insert_creator" ON sessions FOR INSERT
  TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','teacher')
    )
  );

DROP POLICY IF EXISTS "sessions_update_creator" ON sessions;
CREATE POLICY "sessions_update_creator" ON sessions FOR UPDATE
  TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- SESSION_PARTICIPANTS policies
DROP POLICY IF EXISTS "participants_select_members" ON session_participants;
CREATE POLICY "participants_select_members" ON session_participants FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = session_participants.session_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = session_participants.session_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "participants_insert_self" ON session_participants;
CREATE POLICY "participants_insert_self" ON session_participants FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id)
  );

DROP POLICY IF EXISTS "participants_update_teacher_or_self" ON session_participants;
CREATE POLICY "participants_update_teacher_or_self" ON session_participants FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = session_participants.session_id AND s.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = session_participants.session_id AND s.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- BOARD_EVENTS policies
DROP POLICY IF EXISTS "events_select_participants" ON board_events;
CREATE POLICY "events_select_participants" ON board_events FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = board_events.session_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = board_events.session_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "events_insert_can_draw" ON board_events;
CREATE POLICY "events_insert_can_draw" ON board_events FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND event_type IN ('stroke','text','erase','clear','laser','spotlight','spotlight_clear')
    AND (
      EXISTS (
        SELECT 1 FROM sessions s WHERE s.id = board_events.session_id AND s.created_by = auth.uid()
      )
      OR (
        EXISTS (
          SELECT 1 FROM session_participants sp
          WHERE sp.session_id = board_events.session_id
            AND sp.user_id = auth.uid()
            AND (sp.can_draw = true OR board_events.event_type = 'laser')
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- HAND_RAISES policies
DROP POLICY IF EXISTS "handraises_select_members" ON hand_raises;
CREATE POLICY "handraises_select_members" ON hand_raises FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = hand_raises.session_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = hand_raises.session_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "handraises_insert_self" ON hand_raises;
CREATE POLICY "handraises_insert_self" ON hand_raises FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = hand_raises.session_id AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "handraises_update_teacher" ON hand_raises;
CREATE POLICY "handraises_update_teacher" ON hand_raises FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = hand_raises.session_id AND s.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = hand_raises.session_id AND s.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- REACTIONS policies
DROP POLICY IF EXISTS "reactions_select_members" ON reactions;
CREATE POLICY "reactions_select_members" ON reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = reactions.session_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = reactions.session_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions_insert_self" ON reactions;
CREATE POLICY "reactions_insert_self" ON reactions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = reactions.session_id AND sp.user_id = auth.uid()
    )
  );

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'board_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE board_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hand_raises'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hand_raises;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
END
$$;
