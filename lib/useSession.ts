import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { BoardEvent, SessionParticipant, HandRaise, Session, Profile } from '@/lib/types';

interface SessionData {
  session: Session | null;
  participants: SessionParticipant[];
  events: BoardEvent[];
  handRaises: HandRaise[];
  canDraw: boolean;
  isCreator: boolean;
  loading: boolean;
  error: string | null;
}

export function useSession(sessionId: string) {
  const { profile } = useAuth();
  const [data, setData] = useState<SessionData>({
    session: null,
    participants: [],
    events: [],
    handRaises: [],
    canDraw: false,
    isCreator: false,
    loading: true,
    error: null,
  });

  const profileMapRef = useRef<Map<string, Profile>>(new Map());

  // Load initial data
  useEffect(() => {
    if (!sessionId || !profile) return;

    const loadInitial = async () => {
      try {
        const [sessionRes, participantsRes, eventsRes, handRaisesRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
          supabase
            .from('session_participants')
            .select(`
              *,
              profile:profiles(id, name, role, created_at)
            `)
            .eq('session_id', sessionId)
            .order('joined_at', { ascending: true }),
          supabase
            .from('board_events')
            .select('*')
            .eq('session_id', sessionId)
            .order('sequence_number', { ascending: true }),
          supabase
            .from('hand_raises')
            .select(`
              *,
              profile:profiles(id, name, role, created_at)
            `)
            .eq('session_id', sessionId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true }),
        ]);

        if (sessionRes.error || !sessionRes.data) {
          setData((d) => ({ ...d, loading: false, error: 'Session not found.' }));
          return;
        }

        const participants = (participantsRes.data ?? []) as unknown as SessionParticipant[];
        const events = (eventsRes.data ?? []) as BoardEvent[];
        const handRaises = (handRaisesRes.data ?? []) as unknown as HandRaise[];

        // Build profile map
        participants.forEach((p) => {
          if (p.profile) profileMapRef.current.set(p.user_id, p.profile as unknown as Profile);
        });

        const myParticipation = participants.find((p) => p.user_id === profile.id);
        const isCreator = (sessionRes.data as Session).created_by === profile.id;

        setData({
          session: sessionRes.data as Session,
          participants,
          events,
          handRaises,
          canDraw: isCreator || myParticipation?.can_draw || false,
          isCreator,
          loading: false,
          error: null,
        });

        // Set session to live if creator and it's scheduled
        if (isCreator && (sessionRes.data as Session).status === 'scheduled') {
          await supabase.from('sessions').update({ status: 'live' }).eq('id', sessionId);
        }
      } catch (e) {
        setData((d) => ({ ...d, loading: false, error: 'Failed to load session.' }));
      }
    };

    loadInitial();
  }, [sessionId, profile]);

  // Realtime subscriptions
  useEffect(() => {
    if (!sessionId || !profile) return;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'board_events', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newEvent = payload.new as BoardEvent;
          setData((d) => {
            if (d.events.some((e) => e.id === newEvent.id)) return d;
            return { ...d, events: [...d.events, newEvent] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: parts } = await supabase
            .from('session_participants')
            .select(`*, profile:profiles(id, name, role, created_at)`)
            .eq('session_id', sessionId)
            .order('joined_at', { ascending: true });

          if (parts) {
            const participants = parts as unknown as SessionParticipant[];
            participants.forEach((p) => {
              if (p.profile) profileMapRef.current.set(p.user_id, p.profile as unknown as Profile);
            });
            const myPart = participants.find((p) => p.user_id === profile.id);
            setData((d) => ({
              ...d,
              participants,
              canDraw: d.isCreator || myPart?.can_draw || false,
            }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hand_raises', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: hrs } = await supabase
            .from('hand_raises')
            .select(`*, profile:profiles(id, name, role, created_at)`)
            .eq('session_id', sessionId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

          if (hrs) {
            setData((d) => ({ ...d, handRaises: hrs as unknown as HandRaise[] }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const reaction = payload.new as { id: string; emoji: string; user_id: string };
          // Emit a custom event for the reaction overlay to pick up
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('tutorboard:reaction', { detail: reaction }),
            );
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setData((d) => ({ ...d, session: payload.new as Session }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, profile]);

  // Actions
  const sendEvent = useCallback(
    async (eventType: BoardEvent['event_type'], payload: Record<string, any>) => {
      if (!profile || !sessionId) return;
      const { error } = await supabase.from('board_events').insert({
        session_id: sessionId,
        user_id: profile.id,
        event_type: eventType,
        payload,
      });
      if (error) console.warn('sendEvent error:', error.message);
    },
    [profile, sessionId],
  );

  const toggleDrawPermission = useCallback(
    async (userId: string, canDraw: boolean) => {
      const { error } = await supabase
        .from('session_participants')
        .update({ can_draw: canDraw })
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      if (error) console.warn('toggleDraw error:', error.message);
      return !error;
    },
    [sessionId],
  );

  const raiseHand = useCallback(async () => {
    if (!profile) return false;
    const { error } = await supabase.from('hand_raises').insert({
      session_id: sessionId,
      user_id: profile.id,
      status: 'pending',
    });
    return !error;
  }, [profile, sessionId]);

  const resolveHandRaise = useCallback(
    async (handRaiseId: string, status: 'resolved' | 'dismissed', grantDraw = false) => {
      const updates: any = { status, resolved_at: new Date().toISOString() };
      const { error } = await supabase
        .from('hand_raises')
        .update(updates)
        .eq('id', handRaiseId);
      if (error) return false;

      if (grantDraw) {
        const hr = data.handRaises.find((h) => h.id === handRaiseId);
        if (hr) await toggleDrawPermission(hr.user_id, true);
      }
      return true;
    },
    [sessionId, data.handRaises, toggleDrawPermission],
  );

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!profile) return;
      await supabase.from('reactions').insert({
        session_id: sessionId,
        user_id: profile.id,
        emoji,
      });
    },
    [profile, sessionId],
  );

  const endSession = useCallback(async () => {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    return !error;
  }, [sessionId]);

  return {
    ...data,
    sendEvent,
    toggleDrawPermission,
    raiseHand,
    resolveHandRaise,
    sendReaction,
    endSession,
  };
}
