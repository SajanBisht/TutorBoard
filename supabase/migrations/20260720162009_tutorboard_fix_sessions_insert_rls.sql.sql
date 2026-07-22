/*
# Fix sessions INSERT RLS policy

## Problem
`sessions_insert_creator` WITH CHECK used an inline subquery
`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher'))`.
Under RLS, that subquery reads `profiles`, whose SELECT policies restrict rows.
For a non-admin teacher, the `admin_read_all_profiles` policy is false and
`select_own_profile` returns the row, so the subquery *should* work — but the
interaction with the recently-rewritten profiles policies can cause the check
to fail depending on evaluation order, producing
"new row violates row-level security policy for table sessions".

## Fix
Use a SECURITY DEFINER helper `is_teacher_or_admin(p_user)` that reads profiles
bypassing RLS, and rewrite all sessions policies to use it (and the existing
`is_admin`). This removes every inline `SELECT FROM profiles` subquery from the
sessions policies, eliminating the cross-policy dependency.

## Security
- Helpers are STABLE + SECURITY DEFINER; they only expose a single boolean.
- INSERT still requires created_by = auth.uid() AND caller is teacher/admin.
- UPDATE/DELETE still require created_by = auth.uid() OR is_admin.
- SELECT unchanged (is_participant / is_admin).
*/

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role IN ('admin','teacher'));
$function$;

GRANT EXECUTE ON FUNCTION public.is_teacher_or_admin(uuid) TO authenticated;

-- INSERT
DROP POLICY IF EXISTS "sessions_insert_creator" ON public.sessions;
CREATE POLICY "sessions_insert_creator"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_teacher_or_admin(auth.uid()));

-- UPDATE
DROP POLICY IF EXISTS "sessions_update_creator" ON public.sessions;
CREATE POLICY "sessions_update_creator"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_any_session" ON public.sessions;
CREATE POLICY "admin_update_any_session"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- DELETE
DROP POLICY IF EXISTS "sessions_delete_creator" ON public.sessions;
CREATE POLICY "sessions_delete_creator"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_delete_any_session" ON public.sessions;
CREATE POLICY "admin_delete_any_session"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- SELECT
DROP POLICY IF EXISTS "sessions_select_participants" ON public.sessions;
CREATE POLICY "sessions_select_participants"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (public.is_participant(id, auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_read_all_sessions" ON public.sessions;
CREATE POLICY "admin_read_all_sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
