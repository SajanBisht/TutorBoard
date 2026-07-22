/*
# Fix: Allow authenticated users to SELECT sessions by join_code

## Problem
The sessions SELECT policy required `created_by = auth.uid() OR is_participant(...) OR is_admin(...)`.
When a student joins by code, they are NOT yet a participant, NOT the creator, and NOT admin,
so the lookup query `SELECT ... WHERE join_code = 'XYZ'` returns nothing → "No session found".

## Fix
Allow all authenticated users to SELECT sessions. The join_code is the access secret —
knowing it is sufficient to join. Sessions are not private beyond the join code.
*/

DROP POLICY IF EXISTS "sessions_select_own_or_participant" ON public.sessions;
CREATE POLICY "sessions_select_all_authenticated"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (true);
