/*
# Fix profiles RLS infinite recursion

## Problem
The `profiles` SELECT policies (`select_own_profile`, `admin_read_all_profiles`)
contained inline subqueries of the form `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.
A policy on `profiles` that queries `profiles` creates an infinite recursion at query time,
surfacing as `infinite recursion detected in policy for relation "profiles"`.

## Fix
1. Add a new SECURITY DEFINER helper `is_admin(p_user uuid)` that reads the
   `profiles` table while bypassing RLS (SECURITY DEFINER + owner is superuser-ish
   postgres role), returning true iff the given user has `role = 'admin'`.
   Because the function runs as the definer (not the caller), the internal
   `SELECT FROM profiles` does NOT re-enter the profiles RLS policies, so no
   recursion occurs.
2. Rewrite `select_own_profile` to: `auth.uid() = id OR is_admin(auth.uid())`.
3. Rewrite `admin_read_all_profiles` to: `is_admin(auth.uid())`.
4. Drop the redundant `admin_read_all_profiles` policy (folded into `select_own_profile`
   via the `OR is_admin(...)` branch) — actually keep a separate admin-read policy
   for clarity but make it use `is_admin()`.

## Security
- No data loss; only policy predicates change.
- `is_admin` is STABLE and SECURITY DEFINER; it only exposes a single boolean.
- Non-admin users still can only read/update their own profile row.
*/

CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'admin');
$function$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
