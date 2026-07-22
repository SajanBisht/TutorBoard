import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, SessionRow } from '../../lib/types';

export function canCreateSession(profile: Profile | null): boolean {
  return !!profile && (profile.role === 'teacher' || profile.role === 'admin');
}

export async function createSession(title: string): Promise<{ session: SessionRow | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { session: null, error: 'Not authenticated' };

  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase.from('sessions').insert({
    title, created_by: userId, join_code: joinCode, status: 'live',
  }).select().maybeSingle();

  if (error) return { session: null, error: error.message };

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  const role = (prof?.role as string) || 'student';
  await supabase.from('session_participants').insert({
    session_id: data!.id, user_id: userId, role_in_session: role,
    can_draw: role === 'teacher' || role === 'admin',
  });

  return { session: data as SessionRow, error: null };
}

export async function joinSessionByCode(code: string): Promise<{ session: SessionRow | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { session: null, error: 'Not authenticated' };

  const { data: session, error } = await supabase.from('sessions').select().eq('join_code', code.toUpperCase()).maybeSingle();
  if (error || !session) return { session: null, error: 'No session found with that join code.' };
  if (session.status === 'ended') return { session: null, error: 'This session has ended.' };

  const { data: existing } = await supabase.from('session_participants').select('id').eq('session_id', session.id).eq('user_id', userId).maybeSingle();
  if (!existing) {
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    const role = (prof?.role as string) || 'student';
    const { error: pErr } = await supabase.from('session_participants').insert({
      session_id: session.id, user_id: userId, role_in_session: role, can_draw: false,
    });
    if (pErr) return { session: null, error: pErr.message };
  }

  return { session: session as SessionRow, error: null };
}

export async function fetchMySessions(): Promise<{ sessions: SessionRow[]; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { sessions: [], error: 'Not authenticated' };

  const { data: created, error: cErr } = await supabase.from('sessions').select().eq('created_by', userId).order('created_at', { ascending: false });
  if (cErr) return { sessions: [], error: cErr.message };

  const { data: parts, error: pErr } = await supabase.from('session_participants').select('session_id').eq('user_id', userId);
  if (pErr) return { sessions: [], error: pErr.message };

  const createdIds = new Set((created || []).map((s) => s.id));
  const partSessionIds = (parts || []).map((p) => p.session_id).filter((sid) => !createdIds.has(sid));
  let joined: SessionRow[] = [];
  if (partSessionIds.length) {
    const { data: j } = await supabase.from('sessions').select().in('id', partSessionIds).order('created_at', { ascending: false });
    joined = (j || []) as SessionRow[];
  }

  return { sessions: [...(created || []), ...joined] as SessionRow[], error: null };
}

export async function endSession(sessionId: string): Promise<string | null> {
  const { error } = await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId);
  return error?.message || null;
}

export async function leaveSession(sessionId: string, userId: string): Promise<string | null> {
  const { error } = await supabase.from('session_participants').update({ left_at: new Date().toISOString() }).eq('session_id', sessionId).eq('user_id', userId);
  return error?.message || null;
}

export function useMySessions() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { sessions: data, error } = await fetchMySessions();
    if (error) setError(error); else { setSessions(data); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase.channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
