import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Modal, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, Spacing, Radius } from '@/lib/theme';
import type { Session } from '@/lib/types';
import { Plus, KeyRound, Copy, ChevronRight, Radio, Calendar, CheckCircle2, XCircle } from 'lucide-react-native';

export default function LobbyScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdSession, setCreatedSession] = useState<Session | null>(null);

  const canCreate = profile?.role === 'admin' || profile?.role === 'teacher';

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .or(`created_by.eq.${profile?.id},id.in.(select session_id from session_participants where user_id eq '${profile?.id}')`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSessions(data as Session[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => {
    if (profile) loadSessions();
  }, [profile, loadSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions();
  }, [loadSessions]);

  const handleJoin = async () => {
    if (joinCode.trim().length !== 6) {
      setJoinError('Enter a 6-character join code.');
      return;
    }
    setJoinError(null);
    setJoining(true);

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('join_code', joinCode.trim().toUpperCase())
      .maybeSingle();

    if (sessionError || !session) {
      setJoinError('No session found with that code.');
      setJoining(false);
      return;
    }

    const { error: partError } = await supabase
      .from('session_participants')
      .insert({
        session_id: (session as Session).id,
        user_id: profile!.id,
        role_in_session: profile!.role,
      });

    if (partError && partError.code !== '23505') {
      setJoinError(partError.message);
      setJoining(false);
      return;
    }

    setJoining(false);
    setJoinCode('');
    router.push(`/session/${(session as Session).id}`);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        title: newTitle.trim(),
        created_by: profile!.id,
        status: 'scheduled',
      })
      .select('*')
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setCreating(false);
      return;
    }

    await supabase.from('session_participants').insert({
      session_id: (data as Session).id,
      user_id: profile!.id,
      role_in_session: profile!.role,
      can_draw: true,
    });

    setCreatedSession(data as Session);
    setCreating(false);
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
  };

  const closeCreateModal = () => {
    setCreateModalVisible(false);
    setNewTitle('');
    setCreatedSession(null);
    loadSessions();
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      scheduled: { bg: Colors.light.surfaceVariant, text: Colors.light.textSecondary, icon: Calendar },
      live: { bg: `${Colors.accent}20`, text: Colors.accent, icon: Radio },
      ended: { bg: `${Colors.light.textTertiary}20`, text: Colors.light.textTertiary, icon: CheckCircle2 },
    };
    const { bg, text, icon: Icon } = config[status] ?? config.scheduled;
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Icon size={11} color={text} />
        <Text style={[styles.badgeText, { color: text }]}>{status}</Text>
      </View>
    );
  };

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => router.push(`/session/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.sessionCardHeader}>
        <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
        {statusBadge(item.status)}
      </View>
      {canCreate && (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Join code:</Text>
          <Text style={styles.codeValue}>{item.join_code}</Text>
        </View>
      )}
      <ChevronRight size={18} color={Colors.light.textTertiary} style={styles.chevron} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Sessions</Text>
        <Text style={styles.screenSubtitle}>Welcome back, {profile?.name}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.joinSection}>
          <Text style={styles.sectionLabel}>Join a Session</Text>
          <View style={styles.joinRow}>
            <View style={styles.joinInputWrap}>
              <KeyRound size={18} color={Colors.light.textTertiary} />
              <TextInput
                style={styles.joinInput}
                placeholder="6-digit code"
                placeholderTextColor={Colors.light.textTertiary}
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.joinBtn, joining && styles.btnDisabled]}
              onPress={handleJoin}
              disabled={joining}
            >
              <Text style={styles.joinBtnText}>{joining ? '...' : 'Join'}</Text>
            </TouchableOpacity>
          </View>
          {joinError && <Text style={styles.errorText}>{joinError}</Text>}
        </View>

        {canCreate && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create New Session</Text>
          </TouchableOpacity>
        )}

        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Your Sessions</Text>
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={renderSession}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtitle}>
                  {canCreate
                    ? 'Create a new session or join one with a code.'
                    : 'Join a session using a 6-digit code from your teacher.'}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
          />
        </View>
      </View>

      <Modal visible={createModalVisible} animationType="fade" transparent onRequestClose={closeCreateModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {createdSession ? (
              <>
                <Text style={styles.modalTitle}>Session Created!</Text>
                <Text style={styles.modalSubtitle}>Share this code with your students:</Text>
                <View style={styles.codeDisplay}>
                  <Text style={styles.codeDisplayText}>{createdSession.join_code}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => handleCopyCode(createdSession.join_code)}
                >
                  <Copy size={18} color={Colors.primary} />
                  <Text style={styles.copyBtnText}>Copy Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    closeCreateModal();
                    router.push(`/session/${createdSession.id}`);
                  }}
                >
                  <Text style={styles.primaryBtnText}>Enter Session</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Create Session</Text>
                <View style={styles.modalInputWrap}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Session title (e.g. Algebra Review)"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, creating && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text style={styles.primaryBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeCreateModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.bg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + Spacing.sm,
    paddingBottom: Spacing.md,
  },
  screenTitle: {
    ...Typography.headline,
    color: Colors.light.text,
  },
  screenSubtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  joinSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  joinRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  joinInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  joinInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  createBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.primary}10`,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  createBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  listSection: {
    flex: 1,
    gap: Spacing.sm,
  },
  sessionCard: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    position: 'relative',
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sessionTitle: {
    ...Typography.subtitle,
    color: Colors.light.text,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  codeLabel: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
  },
  codeValue: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  chevron: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    marginTop: -9,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.subtitle,
    color: Colors.light.textSecondary,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    maxWidth: 250,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.bg,
  },
  errorText: {
    color: Colors.error,
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.md,
  },
  modalTitle: {
    ...Typography.title,
    color: Colors.light.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  modalInputWrap: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  modalInput: {
    fontSize: 15,
    color: Colors.light.text,
  },
  codeDisplay: {
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  codeDisplayText: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
    color: Colors.primary,
  },
  copyBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  copyBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
  },
});
