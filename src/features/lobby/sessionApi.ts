import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, SessionRow, SessionStatus } from '../../lib/types';

export interface SessionWithHost extends SessionRow {
  hostName?: string;
  participantCount?: number;
}

const UNAMBIGUOUS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += UNAMBIGUOUS[Math.floor(Math.random() * UNAMBIGUOUS.length)];
  return s;
}

export async function createSession(title: string, userId: string, role: 'admin' | 'teacher' | 'student') {
  let joinCode = genCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase.from('sessions').select('id').eq('join_code', joinCode).maybeSingle();
    if (!existing) break;
    joinCode = genCode();
  }
  const { data: sess, error } = await supabase.from('sessions').insert({ title, created_by: userId, join_code: joinCode, status: 'live' }).select().single();
  if (error) return { data: null, error: error.message };
  const session = sess as SessionRow;
  const { error: pErr } = await supabase.from('session_participants').insert({ session_id: session.id, user_id: userId, role_in_session: role, can_draw: true });
  if (pErr) return { data: session, error: pErr.message };
  return { data: session, error: null };
}

export async function joinSessionByCode(code: string, userId: string, role: 'admin' | 'teacher' | 'student') {
  const { data: sess, error } = await supabase.from('sessions').select().eq('join_code', code.toUpperCase().trim()).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!sess) return { data: null, error: 'No session found with that join code.' };
  const session = sess as SessionRow;
  const { data: existing } = await supabase.from('session_participants').select('id').eq('session_id', session.id).eq('user_id', userId).maybeSingle();
  if (!existing) {
    await supabase.from('session_participants').insert({ session_id: session.id, user_id: userId, role_in_session: role, can_draw: false });
  }
  return { data: session, error: null };
}

export async function fetchMySessions(userId: string): Promise<{ data: SessionWithHost[] | null; error: string | null }> {
  const { data: created, error: cErr } = await supabase.from('sessions').select().eq('created_by', userId).order('created_at', { ascending: false });
  if (cErr) return { data: null, error: cErr.message };
  const { data: parts, error: pErr } = await supabase.from('session_participants').select('session_id').eq('user_id', userId);
  if (pErr) return { data: null, error: pErr.message };
  const partIds = (parts || []).map((p) => p.session_id);
  let joined: SessionRow[] = [];
  if (partIds.length) {
    const { data: js, error: jErr } = await supabase.from('sessions').select().in('id', partIds).neq('created_by', userId).order('created_at', { ascending: false });
    if (jErr) return { data: null, error: jErr.message };
    joined = (js || []) as SessionRow[];
  }
  const merged: SessionWithHost[] = [...((created || []) as SessionRow[]), ...joined];
  const ids = merged.map((s) => s.id);
  let hostMap: Record<string, string> = {};
  let countMap: Record<string, number> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', merged.map((s) => s.created_by));
    (profs || []).forEach((p) => { hostMap[p.id] = p.name; });
    const { data: counts } = await supabase.from('session_participants').select('session_id').in('session_id', ids);
    (counts || []).forEach((c) => { countMap[c.session_id] = (countMap[c.session_id] || 0) + 1; });
  }
  return { data: merged.map((s) => ({ ...s, hostName: hostMap[s.created_by], participantCount: countMap[s.id] || 0 })), error: null };
}

export async function fetchAllSessions(): Promise<{ data: SessionWithHost[] | null; error: string | null }> {
  const { data, error } = await supabase.from('sessions').select().order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  const sessions = (data || []) as SessionRow[];
  const hostIds = [...new Set(sessions.map((s) => s.created_by))];
  let hostMap: Record<string, string> = {};
  let countMap: Record<string, number> = {};
  if (hostIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', hostIds);
    (profs || []).forEach((p) => { hostMap[p.id] = p.name; });
  }
  if (sessions.length) {
    const { data: counts } = await supabase.from('session_participants').select('session_id').in('session_id', sessions.map((s) => s.id));
    (counts || []).forEach((c) => { countMap[c.session_id] = (countMap[c.session_id] || 0) + 1; });
  }
  return { data: sessions.map((s) => ({ ...s, hostName: hostMap[s.created_by], participantCount: countMap[s.id] || 0 })), error: null };
}

export async function fetchAllUsers(): Promise<{ data: Profile[] | null; error: string | null }> {
  const { data, error } = await supabase.from('profiles').select('id, name, username, email, role, created_at').order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as Profile[], error: null };
}

export async function endSession(sessionId: string) {
  const { error } = await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId);
  return error?.message || null;
}

export async function setSessionStatus(sessionId: string, status: SessionStatus) {
  const endedAt = status === 'ended' ? new Date().toISOString() : null;
  const { error } = await supabase.from('sessions').update({ status, ended_at: endedAt }).eq('id', sessionId);
  return error?.message || null;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  return { error: error?.message || null };
}

export async function leaveSession(sessionId: string, userId: string) {
  const { error } = await supabase.from('session_participants').delete().eq('session_id', sessionId).eq('user_id', userId);
  return error?.message || null;
}

export function canCreateSession(profile: Profile | null): boolean {
  return !!profile && (profile.role === 'admin' || profile.role === 'teacher');
}

export function useMySessions(userId: string | undefined) {
  const [sessions, setSessions] = useState<SessionWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data, error } = await fetchMySessions(userId);
    if (error) setError(error); else setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [userId]);

  return { sessions, loading, error, reload };
}
