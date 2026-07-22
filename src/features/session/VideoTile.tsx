import { useEffect, useRef } from 'react';
import { Avatar } from '../../components/Avatar';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  micEnabled?: boolean;
  camEnabled?: boolean;
  speaking?: boolean;
  className?: string;
}

export function VideoTile({ stream, name, isLocal, micEnabled = true, camEnabled = true, speaking, className = '' }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative overflow-hidden rounded-xl border-2 bg-ink-800 transition ${speaking ? 'border-brand-500' : 'border-transparent'} ${className}`}>
      {stream && camEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ink-700">
          <Avatar name={name} size={48} />
        </div>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5">
        {!micEnabled && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
        )}
        <span className="text-[11px] font-medium text-white">{isLocal ? 'You' : name}</span>
      </div>
    </div>
  );
}
