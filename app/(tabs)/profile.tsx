import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Colors, Typography, Spacing, Radius } from '@/lib/theme';
import { LogOut, Mail, Shield } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const roleColor: Record<string, string> = {
    admin: Colors.error,
    teacher: Colors.accent,
    student: Colors.info,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.name?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.name ?? 'Unknown'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor[profile?.role ?? 'student']}20` }]}>
          <Shield size={14} color={roleColor[profile?.role ?? 'student']} />
          <Text style={[styles.roleText, { color: roleColor[profile?.role ?? 'student'] }]}>
            {profile?.role}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Mail size={20} color={Colors.light.textTertiary} />
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {profile?.id ? profile.id : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>About TutorBoard</Text>
        <Text style={styles.aboutText}>
          A real-time collaborative whiteboard for online tutoring. Teachers run live
          boards, grant students draw access on demand, and replay lessons with event
          sourcing.
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
        <LogOut size={20} color={Colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.bg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + Spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    ...Typography.headline,
    color: Colors.light.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  infoValue: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
    textAlign: 'right',
  },
  aboutCard: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  aboutTitle: {
    ...Typography.subtitle,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  aboutText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    lineHeight: 21,
  },
  signOutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.error}10`,
    borderWidth: 1.5,
    borderColor: `${Colors.error}40`,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  signOutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
