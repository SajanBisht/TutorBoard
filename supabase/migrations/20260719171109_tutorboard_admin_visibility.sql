/*
# Admin full visibility + safe session list queries

1. Problem
- The sessions SELECT policy uses is_participant(), which returns true only for
  the creator or existing participants. An admin who has not joined a session
  cannot see sessions created by other users. The admin dashboard must list ALL
  sessions system-wide.
- The earlier "infinite recursion" error came from policies that embedded OR
  subqueries across sessions and session_participants. We already fixed that
  with SECURITY DEFINER helpers. This migration extends the helpers so an admin
  can read everything, and adds an explicit admin-read-all policy on sessions
  and session_participants.

2. Changes
A. Update is_participant() and is_session_host() to short-circuit to TRUE when
   the caller is an admin (role = 'admin'). This makes every policy that uses
   these helpers automatically grant admins full read/update access without
   embedding role checks in each policy.
B. Add explicit admin-read-all SELECT policies on sessions and
   session_participants so the admin dashboard's direct queries (without a
   created_by filter) return all rows. These are additive (OR) to the existing
   ownership/participant policies.
C. Add an admin-read-all SELECT policy on profiles so the Users tab can list
   every user (the existing profiles SELECT only allowed self or admin; we
   formalize the admin branch as its own policy for clarity).
D. Add an admin-bypass UPDATE/DELETE policy on sessions so admins can end or
   delete any session, not just their own.

3. Security
- Admin bypass is intentional and explicit (role = 'admin'), not a USING(true).
- All policies use auth.uid(), never current_user.
- Scoped to authenticated.
*/

-- A. Update helpers to short-circuit for admins
CREATE OR REPLACE FUNCTION is_participant(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = p_user AND role = 'admin')
    OR EXISTS (SELECT 1 FROM session_participants WHERE session_id = p_session AND user_id = p_user)
    OR EXISTS (SELECT 1 FROM sessions WHERE id = p_session AND created_by = p_user);
$$;

CREATE OR REPLACE FUNCTION is_session_host(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = p_user AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN profiles p ON p.id = s.created_by
      WHERE s.id = p_session AND s.created_by = p_user
        AND p.role IN ('admin','teacher')
    );
$$;

-- can_user_draw already grants teachers/admins in-session draw; keep as is.
CREATE OR REPLACE FUNCTION can_user_draw(p_session uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((
    SELECT (can_draw = true OR role_in_session IN ('teacher','admin'))
    FROM session_participants
    WHERE session_id = p_session AND user_id = p_user
  ), false) OR EXISTS (SELECT 1 FROM profiles WHERE id = p_user AND role = 'admin');
$$;

-- B. Admin read-all policies (additive)
DROP POLICY IF EXISTS "admin_read_all_sessions" ON sessions;
CREATE POLICY "admin_read_all_sessions" ON sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_read_all_participants" ON session_participants;
CREATE POLICY "admin_read_all_participants" ON session_participants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- C. Admin read-all profiles (formalize the existing admin branch)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'));

-- D. Admin can update/delete any session
DROP POLICY IF EXISTS "admin_update_any_session" ON sessions;
CREATE POLICY "admin_update_any_session" ON sessions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_any_session" ON sessions;
CREATE POLICY "admin_delete_any_session" ON sessions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admin can update any participant row (e.g. toggle can_draw on anyone)
DROP POLICY IF EXISTS "admin_update_any_participant" ON session_participants;
CREATE POLICY "admin_update_any_participant" ON session_participants
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
