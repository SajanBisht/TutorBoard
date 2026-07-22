/*
# Align TutorBoard schema with current build

1. Overview
A prior TutorBoard attempt left tables in place (profiles, sessions,
session_participants, board_events, hand_raises, reactions) with a slightly
different shape and an extra event-type vocabulary (laser/spotlight). This
migration aligns the schema with the current build without dropping user data.

2. Changes
- Add `email` text column to `profiles` (nullable; new signups populate it).
- Replace the board_events INSERT policy with one matching the current event
  vocabulary (stroke/text/erase/permission/presence/clear) and permission rules:
  stroke/text/erase require can_draw (or host); permission/clear require host;
  presence allowed for any participant.
- Drop unused tables hand_raises and reactions (and their policies) — these
  were from a prior feature set not in this build and are empty in this env.
- Ensure realtime publication includes board_events, session_participants, sessions.

3. Security
- profiles: add email column; no policy changes.
- board_events: replace INSERT policy; keep existing SELECT policy.
- Drop hand_raises/reactions policies and tables.

4. Idempotent
- ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS, DROP TABLE IF EXISTS.
- Publication membership handled via DO block (ADD TABLE IF NOT EXISTS not supported).
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

DROP POLICY IF EXISTS "events_insert_can_draw" ON board_events;
CREATE POLICY "events_insert_can_draw" ON board_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM sessions s WHERE s.id = board_events.session_id AND s.created_by = auth.uid())
      OR EXISTS (
        SELECT 1 FROM session_participants sp
        WHERE sp.session_id = board_events.session_id
          AND sp.user_id = auth.uid()
          AND (
            (board_events.event_type IN ('stroke','text','erase') AND sp.can_draw = true)
            OR board_events.event_type = 'presence'
          )
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "handraises_insert_self" ON hand_raises;
DROP POLICY IF EXISTS "handraises_select_members" ON hand_raises;
DROP POLICY IF EXISTS "handraises_update_teacher" ON hand_raises;
DROP POLICY IF EXISTS "reactions_insert_self" ON reactions;
DROP POLICY IF EXISTS "reactions_select_members" ON reactions;
DROP TABLE IF EXISTS hand_raises;
DROP TABLE IF EXISTS reactions;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['board_events','session_participants','sessions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
