-- Enable FORCE ROW LEVEL SECURITY on sessions
-- Without FORCE, the table owner (postgres) bypasses RLS.
-- But the real issue might be that the policy isn't being applied correctly.
-- Let's also try: DROP and recreate ALL policies from scratch.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "sessions_insert_creator" ON public.sessions;
DROP POLICY IF EXISTS "admin_delete_any_session" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_creator" ON public.sessions;
DROP POLICY IF EXISTS "admin_read_all_sessions" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_participants" ON public.sessions;
DROP POLICY IF EXISTS "admin_update_any_session" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_creator" ON public.sessions;

-- Recreate with simple, direct expressions (no function calls in INSERT)
CREATE POLICY "sessions_insert_creator"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "sessions_select_own_or_participant"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_participant(id, auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "sessions_update_creator"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "sessions_delete_creator"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
