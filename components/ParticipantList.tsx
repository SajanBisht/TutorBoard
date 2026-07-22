import { View, Text, TouchableOpacity, StyleSheet, FlatList, Switch } from 'react-native';
import type { SessionParticipant, HandRaise } from '@/lib/types';
import { Colors, Typography, Spacing, Radius } from '@/lib/theme';
import { Hand, Check, X } from 'lucide-react-native';

interface ParticipantListProps {
  participants: SessionParticipant[];
  handRaises: HandRaise[];
  isCreator: boolean;
  currentUserId: string;
  onToggleDraw: (userId: string, canDraw: boolean) => void;
  onResolveHandRaise: (handRaiseId: string, status: 'resolved' | 'dismissed', grantDraw?: boolean) => void;
}

export function ParticipantList({
  participants,
  handRaises,
  isCreator,
  currentUserId,
  onToggleDraw,
  onResolveHandRaise,
}: ParticipantListProps) {
  const roleColor: Record<string, string> = {
    admin: Colors.error,
    teacher: Colors.accent,
    student: Colors.info,
  };

  const renderParticipant = ({ item }: { item: SessionParticipant }) => {
    const name = item.profile?.name ?? 'Unknown';
    const initials = name.charAt(0).toUpperCase();
    const isMe = item.user_id === currentUserId;
    const hasHandRaised = handRaises.some((h) => h.user_id === item.user_id);

    return (
      <View style={styles.participantRow}>
        <View style={[styles.avatar, { backgroundColor: `${roleColor[item.role_in_session]}30` }]}>
          <Text style={[styles.avatarText, { color: roleColor[item.role_in_session] }]}>{initials}</Text>
        </View>
        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {isMe && <Text style={styles.youTag}>You</Text>}
            {hasHandRaised && <Hand size={14} color={Colors.accent} />}
          </View>
          <Text style={styles.role}>{item.role_in_session}</Text>
        </View>
        {isCreator && item.role_in_session === 'student' && (
          <Switch
            value={item.can_draw}
            onValueChange={(val) => onToggleDraw(item.user_id, val)}
            trackColor={{ false: Colors.light.border, true: Colors.primary }}
          />
        )}
        {isCreator && !item.can_draw && item.role_in_session !== 'student' && (
          <Text style={styles.alwaysDraw}>Always</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {handRaises.length > 0 && isCreator && (
        <View style={styles.handRaiseSection}>
          <Text style={styles.sectionLabel}>Hand Raised</Text>
          {handRaises.map((hr) => (
            <View key={hr.id} style={styles.handRaiseRow}>
              <Hand size={16} color={Colors.accent} />
              <Text style={styles.handRaiseName}>{hr.profile?.name ?? 'Student'}</Text>
              <TouchableOpacity
                style={styles.grantBtn}
                onPress={() => onResolveHandRaise(hr.id, 'resolved', true)}
              >
                <Check size={14} color="#fff" />
                <Text style={styles.grantBtnText}>Grant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => onResolveHandRaise(hr.id, 'dismissed')}
              >
                <X size={14} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>Participants ({participants.length})</Text>
      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipant}
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  participantInfo: {
    flex: 1,
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    ...Typography.body,
    color: Colors.light.text,
    fontWeight: '500',
    flex: 1,
  },
  youTag: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  role: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textTransform: 'capitalize',
  },
  alwaysDraw: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontStyle: 'italic',
  },
  handRaiseSection: {
    backgroundColor: `${Colors.accent}10`,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  handRaiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  handRaiseName: {
    ...Typography.body,
    color: Colors.light.text,
    fontWeight: '500',
    flex: 1,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  grantBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  dismissBtn: {
    padding: 4,
  },
});
