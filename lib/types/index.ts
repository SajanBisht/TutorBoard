export type UserRole = 'admin' | 'teacher' | 'student';
export type SessionStatus = 'scheduled' | 'live' | 'ended';
export type EventType = 'stroke' | 'text' | 'erase' | 'clear' | 'laser' | 'spotlight' | 'spotlight_clear';
export type HandRaiseStatus = 'pending' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  created_by: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
  ended_at: string | null;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role_in_session: UserRole;
  can_draw: boolean;
  joined_at: string;
  left_at: string | null;
  profile?: Profile;
}

export interface BoardEvent {
  id: string;
  session_id: string;
  user_id: string;
  event_type: EventType;
  payload: EventPayload;
  sequence_number: number;
  created_at: string;
}

export type EventPayload =
  | StrokePayload
  | TextPayload
  | ErasePayload
  | ClearPayload
  | LaserPayload
  | SpotlightPayload;

export interface StrokePayload {
  strokeId: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  complete?: boolean;
}

export interface TextPayload {
  textId: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export interface ErasePayload {
  targetId: string;
}

export interface ClearPayload {
  target?: 'all' | 'strokes' | 'text';
}

export interface LaserPayload {
  x: number;
  y: number;
  laserId: string;
}

export interface SpotlightPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HandRaise {
  id: string;
  session_id: string;
  user_id: string;
  status: HandRaiseStatus;
  created_at: string;
  resolved_at: string | null;
  profile?: Profile;
}

export interface Reaction {
  id: string;
  session_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}
