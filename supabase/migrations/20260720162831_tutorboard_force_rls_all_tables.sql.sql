-- Apply FORCE RLS to all TutorBoard tables to prevent owner-bypass issues
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.board_events FORCE ROW LEVEL SECURITY;
