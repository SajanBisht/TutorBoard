import { supabase } from '../../lib/supabase';
import { GroupRow, GroupMemberRow, MessageRow, Profile, GroupWithMeta, MessageType } from '../../lib/types';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'group';
}

export async function createGroup(name: string, description: string, userId: string): Promise<{ data: GroupRow | null; error: string | null }> {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabase.from('groups').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const { data: group, error } = await supabase.from('groups').insert({ name: name.trim(), slug, description: description.trim(), created_by: userId }).select().single();
  if (error) return { data: null, error: error.message };
  const g = group as GroupRow;
  const { error: mErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: userId, role: 'owner' });
  if (mErr) return { data: g, error: mErr.message };
  return { data: g, error: null };
}

export async function joinGroup(groupId: string, userId: string): Promise<{ error: string | null }> {
  const { data: existing } = await supabase.from('group_members').select('id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (existing) return { error: null };
  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' });
  return { error: error?.message || null };
}

export async function leaveGroup(groupId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  return { error: error?.message || null };
}

export async function fetchMyGroups(userId: string): Promise<{ data: GroupWithMeta[] | null; error: string | null }> {
  const { data: memberships, error: mErr } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
  if (mErr) return { data: null, error: mErr.message };
  const ids = (memberships || []).map((m) => m.group_id);
  if (!ids.length) return { data: [], error: null };
  const { data: groups, error: gErr } = await supabase.from('groups').select().in('id', ids).order('created_at', { ascending: false });
  if (gErr) return { data: null, error: gErr.message };
  return { data: await enrichGroups(groups as GroupRow[], userId), error: null };
}

export async function fetchAllGroups(userId: string): Promise<{ data: GroupWithMeta[] | null; error: string | null }> {
  const { data: groups, error } = await supabase.from('groups').select().order('created_at', { ascending: false }).limit(50);
  if (error) return { data: null, error: error.message };
  return { data: await enrichGroups(groups as GroupRow[], userId), error: null };
}

export async function searchGroups(query: string, userId: string): Promise<{ data: GroupWithMeta[] | null; error: string | null }> {
  const q = query.trim();
  if (!q) return fetchAllGroups(userId);
  const cleanSlug = q.replace(/^@/, '').toLowerCase();
  const { data: groups, error } = await supabase.from('groups')
    .select()
    .or(`name.ilike.%${q}%,slug.ilike.%${cleanSlug}%`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { data: null, error: error.message };
  return { data: await enrichGroups(groups as GroupRow[], userId), error: null };
}

export async function searchUsers(usernameQuery: string): Promise<{ data: Profile[] | null; error: string | null }> {
  const q = usernameQuery.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 1) return { data: [], error: null };
  const { data, error } = await supabase.from('profiles')
    .select('id, name, username, email, role, created_at')
    .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(20);
  if (error) return { data: null, error: error.message };
  return { data: data as Profile[], error: null };
}

async function enrichGroups(groups: GroupRow[], userId: string): Promise<GroupWithMeta[]> {
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const ownerIds = [...new Set(groups.map((g) => g.created_by))];
  const [{ data: members }, { data: profs }, { data: myMemberships }] = await Promise.all([
    supabase.from('group_members').select('group_id').in('group_id', ids),
    supabase.from('profiles').select('id, name').in('id', ownerIds),
    supabase.from('group_members').select('group_id').eq('user_id', userId).in('group_id', ids),
  ]);
  const countMap: Record<string, number> = {};
  (members || []).forEach((m) => { countMap[m.group_id] = (countMap[m.group_id] || 0) + 1; });
  const ownerMap: Record<string, string> = {};
  (profs || []).forEach((p) => { ownerMap[p.id] = p.name; });
  const mySet = new Set((myMemberships || []).map((m) => m.group_id));
  return groups.map((g) => ({ ...g, memberCount: countMap[g.id] || 0, ownerName: ownerMap[g.created_by], isMember: mySet.has(g.id) }));
}

export async function fetchGroupMembers(groupId: string): Promise<{ data: GroupMemberRow[] | null; error: string | null }> {
  const { data: members, error } = await supabase.from('group_members').select('id, group_id, user_id, role, joined_at').eq('group_id', groupId);
  if (error) return { data: null, error: error.message };
  const userIds = (members || []).map((m) => m.user_id);
  let profileMap: Record<string, Profile> = {};
  if (userIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name, username, email, role, created_at').in('id', userIds);
    (profs || []).forEach((p) => { profileMap[p.id] = p as Profile; });
  }
  return { data: (members || []).map((m) => ({ ...m, profile: profileMap[m.user_id] })) as GroupMemberRow[], error: null };
}

export async function fetchMessages(groupId: string): Promise<{ data: MessageRow[] | null; error: string | null }> {
  const { data: msgs, error } = await supabase.from('messages').select().eq('group_id', groupId).order('created_at', { ascending: true }).limit(200);
  if (error) return { data: null, error: error.message };
  const userIds = [...new Set((msgs || []).map((m) => m.user_id))];
  let profileMap: Record<string, Profile> = {};
  if (userIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name, username, email, role, created_at').in('id', userIds);
    (profs || []).forEach((p) => { profileMap[p.id] = p as Profile; });
  }
  return { data: (msgs || []).map((m) => ({ ...m, profile: profileMap[m.user_id] })) as MessageRow[], error: null };
}

export async function sendMessage(groupId: string, userId: string, content: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('messages').insert({ group_id: groupId, user_id: userId, content, message_type: 'text' });
  return { error: error?.message || null };
}

export async function sendMediaMessage(
  groupId: string, userId: string,
  messageType: MessageType, file: File
): Promise<{ error: string | null }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${groupId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('group-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) return { error: upErr.message };
  const { data: pub } = supabase.storage.from('group-media').getPublicUrl(path);
  const { error: msgErr } = await supabase.from('messages').insert({
    group_id: groupId, user_id: userId, message_type: messageType,
    media_url: pub.publicUrl, media_name: file.name, media_size: file.size,
    content: null,
  });
  return { error: msgErr?.message || null };
}

export async function deleteMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  return { error: error?.message || null };
}

export function getGroupJoinUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/g/${slug}`;
}
