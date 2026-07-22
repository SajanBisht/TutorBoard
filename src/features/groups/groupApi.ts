import { supabase } from '../../lib/supabase';
import { GroupRow, GroupWithMeta, MessageRow, Profile } from '../../lib/types';

export async function createGroup(name: string, description: string): Promise<{ group: GroupRow | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { group: null, error: 'Not authenticated' };

  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 6);
  const { data, error } = await supabase.from('groups').insert({
    name: name.trim(), slug, description: description.trim(), created_by: userId,
  }).select().maybeSingle();
  if (error) return { group: null, error: error.message };

  await supabase.from('group_members').insert({ group_id: data!.id, user_id: userId, role: 'owner' });
  return { group: data as GroupRow, error: null };
}

export async function joinGroup(slug: string): Promise<{ group: GroupRow | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { group: null, error: 'Not authenticated' };

  const { data: group, error } = await supabase.from('groups').select().eq('slug', slug).maybeSingle();
  if (error || !group) return { group: null, error: 'Group not found.' };

  const { data: existing } = await supabase.from('group_members').select('id').eq('group_id', group.id).eq('user_id', userId).maybeSingle();
  if (!existing) {
    const { error: mErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: userId, role: 'member' });
    if (mErr) return { group: null, error: mErr.message };
  }
  return { group: group as GroupRow, error: null };
}

export async function searchGroups(query: string): Promise<GroupWithMeta[]> {
  if (!query.trim()) return [];
  const { data } = await supabase.from('groups').select().or(`name.ilike.%${query}%,slug.ilike.%${query}%`).limit(20);
  return (data || []) as GroupWithMeta[];
}

export async function searchUsers(query: string): Promise<Profile[]> {
  if (!query.trim()) return [];
  const clean = query.replace(/^@/, '');
  const { data } = await supabase.from('profiles').select('id, name, username, email, role, created_at').ilike('username', `%${clean}%`).limit(20);
  return (data || []) as Profile[];
}

export async function fetchMyGroups(): Promise<GroupWithMeta[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data: members } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
  const groupIds = (members || []).map((m) => m.group_id);
  if (!groupIds.length) return [];

  const { data: groups } = await supabase.from('groups').select().in('id', groupIds).order('created_at', { ascending: false });
  return (groups || []) as GroupWithMeta[];
}

export async function fetchMessages(groupId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase.from('messages')
    .select('id, group_id, user_id, content, message_type, media_url, media_name, media_size, created_at')
    .eq('group_id', groupId).order('created_at', { ascending: true }).limit(200);
  if (error) return [];

  const messages = (data || []) as MessageRow[];
  const userIds = [...new Set(messages.map((m) => m.user_id))];
  if (userIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name, username, email, role, created_at').in('id', userIds);
    const profMap: Record<string, Profile> = {};
    (profs || []).forEach((p) => { profMap[p.id] = p as Profile; });
    messages.forEach((m) => { m.profile = profMap[m.user_id]; });
  }
  return messages;
}

export async function sendMessage(groupId: string, content: string): Promise<string | null> {
  const { error } = await supabase.from('messages').insert({ group_id: groupId, content: content.trim(), message_type: 'text' });
  return error?.message || null;
}

export async function sendMediaMessage(groupId: string, file: File, type: 'image' | 'file' | 'video'): Promise<string | null> {
  const path = `groups/${groupId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('group-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) return upErr.message;
  const { data: pub } = supabase.storage.from('group-media').getPublicUrl(path);
  const { error } = await supabase.from('messages').insert({
    group_id: groupId, message_type: type, media_url: pub.publicUrl, media_name: file.name, media_size: file.size, content: null,
  });
  return error?.message || null;
}

export function getGroupJoinUrl(slug: string): string {
  return `${window.location.origin}/groups/${slug}`;
}

export async function fetchGroupById(id: string): Promise<GroupRow | null> {
  const { data } = await supabase.from('groups').select().eq('id', id).maybeSingle();
  return data as GroupRow | null;
}
