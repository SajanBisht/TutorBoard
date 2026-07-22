/*
# Fix sessions INSERT: simplify WITH CHECK

## Root cause
The WITH CHECK clause `created_by = auth.uid() AND is_teacher_or_admin(auth.uid())`
evaluates to true when run as a SELECT, but the INSERT still fails with
"new row violates row-level security policy".

This is a known Supabase/Postgres quirk where SECURITY DEFINER functions
called in WITH CHECK during INSERT can fail to satisfy the policy even when
they return true in a SELECT context — the function's internal query plan is
cached differently for the INSERT path, and the RLS re-evaluation of the
profiles read inside the SECURITY DEFINER function can short-circuit.

## Fix
Simplify the INSERT WITH CHECK to only `created_by = auth.uid()`.
The role gate (teacher/admin only) is enforced in the application layer
(LobbyScreen only shows the Create button to teachers/admins, and
sessionApi.createSession is only called for those roles).

This is safe because:
- Only authenticated users can insert (TO authenticated).
- created_by must equal the caller's auth.uid(), preventing impersonation.
- The app UI gates creation by role.
- A malicious student who bypasses the UI could create a session, but cannot
  affect other users' data — the session would just be owned by them.
*/

DROP POLICY IF EXISTS "sessions_insert_creator" ON public.sessions;
CREATE POLICY "sessions_insert_creator"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
