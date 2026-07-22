import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface PeerState {
  userId: string;
  name?: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connected: boolean;
}

interface UseVideoCallArgs {
  sessionId: string;
  userId: string | undefined;
  userName: string | undefined;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVideoCall({ sessionId, userId, userName }: UseVideoCallArgs) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'active' | 'denied'>('idle');

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string | undefined>(userId);
  userIdRef.current = userId;

  const updatePeer = useCallback((uid: string, patch: Partial<PeerState>) => {
    setPeers((prev) => {
      const next = new Map(prev);
      const existing = next.get(uid) || { userId: uid, stream: null, audioEnabled: true, videoEnabled: true, connected: false };
      next.set(uid, { ...existing, ...patch });
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((remoteUid: string): RTCPeerConnection => {
    const existing = peerConnections.current.get(remoteUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'signal',
          target: remoteUid,
          from: userIdRef.current,
          payload: { type: 'ice', data: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      updatePeer(remoteUid, { stream, connected: true });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        updatePeer(remoteUid, { connected: false });
      } else if (pc.connectionState === 'connected') {
        updatePeer(remoteUid, { connected: true });
      }
    };

    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((track) => {
        pc.addTrack(track, ls);
      });
    }

    peerConnections.current.set(remoteUid, pc);
    return pc;
  }, [updatePeer]);

  const handleSignal = useCallback(async (msg: any) => {
    if (!msg || msg.from === userIdRef.current) return;

    if (msg.type === 'join') {
      updatePeer(msg.from, { userId: msg.from, name: msg.name, connected: false });
      const pc = createPeerConnection(msg.from);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: 'signal',
          target: msg.from,
          from: userIdRef.current,
          payload: { type: 'offer', data: offer },
        });
      } catch (e) { console.warn('offer error', e); }
    } else if (msg.type === 'signal') {
      if (msg.target !== userIdRef.current) return;
      const pc = createPeerConnection(msg.from);
      const p = msg.payload;
      try {
        if (p.type === 'offer') {
          await pc.setRemoteDescription(p.data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channelRef.current?.send({
            type: 'signal',
            target: msg.from,
            from: userIdRef.current,
            payload: { type: 'answer', data: answer },
          });
        } else if (p.type === 'answer') {
          await pc.setRemoteDescription(p.data);
        } else if (p.type === 'ice') {
          await pc.addIceCandidate(p.data);
        }
      } catch (e) { console.warn('signal error', e); }
    } else if (msg.type === 'leave') {
      const pc = peerConnections.current.get(msg.from);
      if (pc) {
        pc.close();
        peerConnections.current.delete(msg.from);
      }
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(msg.from);
        return next;
      });
    }
  }, [createPeerConnection, updatePeer]);

  const startCamera = useCallback(async () => {
    if (!userId) return;
    setStatus('requesting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicEnabled(true);
      setCamEnabled(true);
      setStatus('active');

      const channel = supabase.channel(`webrtc:${sessionId}`, {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });

      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload);
      });

      channel.subscribe((stat) => {
        if (stat === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'join', from: userId, name: userName } });
        }
      });

      window.addEventListener('beforeunload', () => {
        channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'leave', from: userId } });
      });
    } catch (e: any) {
      console.warn('camera error', e);
      if (e.name === 'NotAllowedError') {
        setStatus('denied');
        setError('Camera and microphone access was denied. Please allow access in your browser settings.');
      } else {
        setStatus('idle');
        setError(e.message || 'Failed to access camera/microphone.');
      }
    }
  }, [userId, sessionId, userName, handleSignal]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicEnabled((prev) => !prev);
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamEnabled((prev) => !prev);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setScreenStream(stream);
      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.onended = () => {
        setScreenStream(null);
        peerConnections.current.forEach((pc) => {
          const senders = pc.getSenders();
          const ls = localStreamRef.current;
          const camTrack = ls?.getVideoTracks()[0];
          if (camTrack) {
            const sender = senders.find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          }
        });
      };
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      return true;
    } catch (e: any) {
      console.warn('screen share error', e);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    const ls = localStreamRef.current;
    const camTrack = ls?.getVideoTracks()[0];
    if (camTrack) {
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      });
    }
  }, [screenStream]);

  const endCall = useCallback(() => {
    if (channelRef.current && userId) {
      channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'leave', from: userId } });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setScreenStream(null);
    setPeers(new Map());
    setStatus('idle');
  }, [userId, screenStream]);

  useEffect(() => {
    return () => {
      if (channelRef.current && userId) {
        channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'leave', from: userId } });
        supabase.removeChannel(channelRef.current);
      }
      peerConnections.current.forEach((pc) => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [userId]);

  return {
    localStream,
    peers,
    micEnabled,
    camEnabled,
    screenStream,
    error,
    status,
    startCamera,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    endCall,
  };
}
