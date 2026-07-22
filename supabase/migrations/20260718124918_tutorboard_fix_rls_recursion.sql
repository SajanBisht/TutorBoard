/*
# Create helper functions + fix RLS recursion

1. Problem
The SECURITY DEFINER helper functions (is_participant, is_session_host,
can_user_draw) were never created — the original migration that defined them
timed out before applying them. As a result, the existing RLS policies use
inline subqueries that reference each other (sessions SELECT checks
session_participants, session_participants SELECT checks sessions), causing
infinite recursion: "infinite recursion detected in policy for relation
session_participants".

2. Fix (two parts)
A. Create the helper functions as SECURITY DEFINER. These run with the
   owner's privileges and do NOT re-evaluate RLS on the tables they read,
   breaking the recursion.
   - is_participant(session_uuid, user_uuid): true if user is a participant
     OR the session creator.
   - is_session_host(session_uuid, user_uuid): true if user created the
     session AND has role admin/teacher.
   - can_user_draw(session_uuid, user_uuid): true if user has can_draw OR
     is teacher/admin in the session.
B. Replace all policies on sessions, session_participants, profiles, and
   board_events to use these helpers instead of inline subqueries.

3. Security
- All policies use auth.uid(), never current_user.
- Scoped to authenticated (app has sign-in screen).
- No USING(true) shortcuts.
*/

-- A. Helper functions

CREATE OR REPLACE FUNCTION is_participant(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants
    WHERE session_id = p_session AND user_id = p_user
  ) OR EXISTS (
    SELECT 1 FROM sessions WHERE id = p_session AND created_by = p_user
  );
$$;

CREATE OR REPLACE FUNCTION is_session_host(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions s
    JOIN profiles p ON p.id = s.created_by
    WHERE s.id = p_session AND s.created_by = p_user
      AND p.role IN ('admin','teacher')
  );
$$;

CREATE OR REPLACE FUNCTION can_user_draw(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((
    SELECT (can_draw = true OR role_in_session IN ('teacher','admin'))
    FROM session_participants
    WHERE session_id = p_session AND user_id = p_user
  ), false);
$$;

-- B. Policies

-- sessions
DROP POLICY IF EXISTS "sessions_select_participants" ON sessions;
CREATE POLICY "sessions_select_participants" ON sessions
  FOR SELECT TO authenticated
  USING (is_participant(id, auth.uid()));

DROP POLICY IF EXISTS "sessions_insert_creator" ON sessions;
CREATE POLICY "sessions_insert_creator" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin','teacher')
    )
  );

DROP POLICY IF EXISTS "sessions_update_creator" ON sessions;
CREATE POLICY "sessions_update_creator" ON sessions
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "delete_own_session" ON sessions;
DROP POLICY IF EXISTS "sessions_delete_creator" ON sessions;
CREATE POLICY "sessions_delete_creator" ON sessions
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- session_participants
DROP POLICY IF EXISTS "participants_select_members" ON session_participants;
CREATE POLICY "participants_select_members" ON session_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_session_host(session_id, auth.uid())
    OR is_participant(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "participants_insert_self" ON session_participants;
CREATE POLICY "participants_insert_self" ON session_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_teacher_or_self" ON session_participants;
DROP POLICY IF EXISTS "update_participant_host" ON session_participants;
CREATE POLICY "update_participant_host" ON session_participants
  FOR UPDATE TO authenticated
  USING (is_session_host(session_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (is_session_host(session_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "delete_participant_host" ON session_participants;
DROP POLICY IF EXISTS "participants_delete" ON session_participants;
CREATE POLICY "delete_participant_host" ON session_participants
  FOR DELETE TO authenticated
  USING (is_session_host(session_id, auth.uid()) OR user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- board_events
DROP POLICY IF EXISTS "events_select_participants" ON board_events;
DROP POLICY IF EXISTS "select_events_if_participant" ON board_events;
CREATE POLICY "select_events_if_participant" ON board_events
  FOR SELECT TO authenticated
  USING (is_participant(session_id, auth.uid()));

DROP POLICY IF EXISTS "events_insert_can_draw" ON board_events;
DROP POLICY IF EXISTS "insert_event_if_participant" ON board_events;
CREATE POLICY "insert_event_if_participant" ON board_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_participant(session_id, auth.uid())
    AND (
      (event_type IN ('stroke','text','erase') AND can_user_draw(session_id, auth.uid()))
      OR (event_type IN ('permission','clear') AND is_session_host(session_id, auth.uid()))
      OR (event_type = 'presence')
    )
  );
