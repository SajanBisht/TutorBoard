import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '@/lib/auth';
import { Colors, Typography, Spacing, Radius } from '@/lib/theme';
import type { UserRole } from '@/lib/types';
import { Mail, Lock, User, ArrowRight } from 'lucide-react-native';

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Student', value: 'student' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Admin', value: 'admin' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Please fill all fields. Password must be at least 6 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await signUp(email.trim(), password, name.trim(), role);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.replace('/(tabs)/lobby');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join TutorBoard as a student, teacher, or admin</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <User size={20} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={Colors.light.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrap}>
            <Mail size={20} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.light.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.inputWrap}>
            <Lock size={20} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={Colors.light.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              onSubmitEditing={handleRegister}
            />
          </View>

          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>I am a...</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleBtn,
                    role === r.value && styles.roleBtnActive,
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <Text
                    style={[
                      styles.roleBtnText,
                      role === r.value && styles.roleBtnTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
            {!loading && <ArrowRight size={18} color="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.headline,
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    height: '100%',
  },
  roleSection: {
    gap: Spacing.sm,
  },
  roleLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  roleBtnTextActive: {
    color: '#fff',
  },
  errorText: {
    color: Colors.error,
    ...Typography.body,
  },
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkBtn: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  linkText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  linkTextBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
