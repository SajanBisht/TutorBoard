export type Role = 'admin' | 'teacher' | 'student';
export type SessionStatus = 'scheduled' | 'live' | 'ended';
export type RoleInSession = 'admin' | 'teacher' | 'student';
export type PresenceStatus = 'joined' | 'left' | 'drawing' | 'idle';
export type BoardEventType = 'stroke' | 'text' | 'erase' | 'permission' | 'presence' | 'clear';
export type MessageType = 'text' | 'image' | 'file' | 'video' | 'sticker';
export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface SessionRow {
  id: string;
  title: string;
  created_by: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
  ended_at: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  user_id: string;
  role_in_session: RoleInSession;
  can_draw: boolean;
  joined_at: string;
  left_at: string | null;
  profile?: Profile;
}

export interface BoardEventRow {
  id: string;
  session_id: string;
  user_id: string;
  event_type: BoardEventType;
  payload: Record<string, any>;
  sequence_number: number;
  created_at: string;
}

export interface Point { x: number; y: number; }

export interface GroupRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_by: string;
  avatar_url: string | null;
  created_at: string;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  profile?: Profile;
}

export interface MessageRow {
  id: string;
  group_id: string;
  user_id: string;
  content: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_name: string | null;
  media_size: number | null;
  created_at: string;
  profile?: Profile;
}

export interface GroupWithMeta extends GroupRow {
  memberCount?: number;
  isMember?: boolean;
  ownerName?: string;
}
