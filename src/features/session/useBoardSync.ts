import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BoardEventRow, ParticipantRow, Profile, SessionRow } from '../../lib/types';

export interface BoardItem {
  id: string;
  type: 'stroke' | 'text';
  userId: string;
  color?: string;
  width?: number;
  points?: { x: number; y: number }[];
  content?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  complete?: boolean;
  sequenceNumber: number;
  createdAt: string;
}

interface UseBoardSyncArgs {
  sessionId: string;
  userId: string | undefined;
  profile: Profile | null;
}

export function useBoardSync({ sessionId, userId, profile }: UseBoardSyncArgs) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [presence, setPresence] = useState<Record<string, 'joined' | 'left' | 'drawing' | 'idle'>>({});
  const [session, setSession] = useState<SessionRow | null>(null);
  const [myCanDraw, setMyCanDraw] = useState<boolean>(false);
  const seqRef = useRef<number>(0);

  const applyEvent = useCallback((row: BoardEventRow) => {
    if (row.sequence_number <= seqRef.current) return;
    seqRef.current = Math.max(seqRef.current, row.sequence_number);
    if (row.event_type === 'stroke') {
      const p = row.payload as any;
      setItems((prev) => {
        const existing = prev.find((it) => it.id === p.strokeId);
        if (existing) return prev.map((it) => it.id === p.strokeId ? { ...it, points: p.points, complete: p.complete } : it);
        return [...prev, { id: p.strokeId, type: 'stroke', userId: row.user_id, color: p.color, width: p.width, points: p.points, complete: p.complete, sequenceNumber: row.sequence_number, createdAt: row.created_at }];
      });
    } else if (row.event_type === 'text') {
      const p = row.payload as any;
      setItems((prev) => {
        const existing = prev.find((it) => it.id === p.textId);
        if (existing) return prev.map((it) => it.id === p.textId ? { ...it, content: p.content, x: p.x, y: p.y, fontSize: p.fontSize } : it);
        return [...prev, { id: p.textId, type: 'text', userId: row.user_id, content: p.content, x: p.x, y: p.y, fontSize: p.fontSize, sequenceNumber: row.sequence_number, createdAt: row.created_at }];
      });
    } else if (row.event_type === 'erase') {
      const p = row.payload as any;
      setItems((prev) => prev.filter((it) => it.id !== p.targetId));
    } else if (row.event_type === 'clear') {
      setItems([]);
    } else if (row.event_type === 'permission') {
      const p = row.payload as any;
      setParticipants((prev) => prev.map((part) => part.user_id === p.targetUserId ? { ...part, can_draw: p.canDraw } : part));
    } else if (row.event_type === 'presence') {
      const p = row.payload as any;
      setPresence((prev) => ({ ...prev, [p.userId]: p.status }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      const { data: sess, error: sErr } = await supabase.from('sessions').select().eq('id', sessionId).maybeSingle();
      if (cancelled) return;
      if (sErr || !sess) { setError(sErr?.message || 'Session not found.'); setLoading(false); return; }
      setSession(sess as SessionRow);
      const { data: parts, error: pErr } = await supabase.from('session_participants').select('id, session_id, user_id, role_in_session, can_draw, joined_at, left_at').eq('session_id', sessionId);
      if (cancelled) return;
      if (pErr) { setError(pErr.message); setLoading(false); return; }
      const userIds = (parts || []).map((p) => p.user_id);
      let profileMap: Record<string, Profile> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name, username, email, role, created_at').in('id', userIds);
        (profs || []).forEach((p) => { profileMap[p.id] = p as Profile; });
      }
      const partsWithProfiles = (parts || []).map((p) => ({ ...p, profile: profileMap[p.user_id] })) as ParticipantRow[];
      if (cancelled) return;
      setParticipants(partsWithProfiles);
      const { data: events, error: eErr } = await supabase.from('board_events').select().eq('session_id', sessionId).order('sequence_number', { ascending: true });
      if (cancelled) return;
      if (eErr) { setError(eErr.message); setLoading(false); return; }
      (events || []).forEach((e) => applyEvent(e as BoardEventRow));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, applyEvent]);

  useEffect(() => {
    setConnected(false);
    const channel = supabase
      .channel(`board:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_events', filter: `session_id=eq.${sessionId}` }, (payload) => {
        setConnected(true);
        applyEvent(payload.new as BoardEventRow);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const updated = payload.new as ParticipantRow;
        setParticipants((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const added = payload.new as ParticipantRow;
        supabase.from('profiles').select('id, name, username, email, role, created_at').eq('id', added.user_id).maybeSingle()
          .then(({ data }) => {
            setParticipants((prev) => prev.some((p) => p.id === added.id) ? prev : [...prev, { ...added, profile: data as Profile | undefined }]);
          });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnected(false);
      });
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, applyEvent]);

  useEffect(() => {
    if (!userId || !profile) return;
    const me = participants.find((p) => p.user_id === userId);
    if (me) setMyCanDraw(me.can_draw || me.role_in_session === 'teacher' || me.role_in_session === 'admin');
    else if (profile.role === 'admin' || profile.role === 'teacher') setMyCanDraw(true);
    else setMyCanDraw(false);
  }, [participants, userId, profile]);

  useEffect(() => {
    if (!userId) return;
    emitEvent(sessionId, userId, 'presence', { userId, status: 'joined' });
    return () => { emitEvent(sessionId, userId, 'presence', { userId, status: 'left' }); };
  }, [sessionId, userId]);

  return { items, loading, error, connected, participants, presence, session, myCanDraw, setItems };
}

export async function emitEvent(
  sessionId: string, userId: string,
  eventType: 'stroke' | 'text' | 'erase' | 'permission' | 'presence' | 'clear',
  payload: Record<string, any>
) {
  const { error } = await supabase.from('board_events').insert({ session_id: sessionId, user_id: userId, event_type: eventType, payload });
  if (error) console.warn('emitEvent error', eventType, error.message);
  return error;
}

export async function setParticipantCanDraw(sessionId: string, userId: string, canDraw: boolean, actorId: string) {
  const { error } = await supabase.from('session_participants').update({ can_draw: canDraw }).eq('session_id', sessionId).eq('user_id', userId);
  if (error) return error.message;
  await emitEvent(sessionId, actorId, 'permission', { targetUserId: userId, canDraw });
  return null;
}
