import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { Pen, Type, Eraser, Minus, Lock, Highlighter } from 'lucide-react-native';

interface ToolbarProps {
  canDraw: boolean;
  tool: 'pen' | 'text' | 'eraser' | 'laser';
  setTool: (tool: 'pen' | 'text' | 'eraser' | 'laser') => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  onClear: () => void;
}

const TOOLS = [
  { id: 'pen', label: 'Pen', icon: Pen },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'laser', label: 'Laser', icon: Highlighter },
] as const;

export function Toolbar({
  canDraw,
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onClear,
}: ToolbarProps) {
  return (
    <View style={[styles.container, !canDraw && styles.disabled]}>
      {canDraw ? (
        <>
          <View style={styles.toolRow}>
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.toolBtn, active && styles.toolBtnActive]}
                  onPress={() => setTool(t.id)}
                  accessibilityLabel={t.label}
                >
                  <Icon size={20} color={active ? '#fff' : Colors.light.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.colorRow}>
            {['#1A1A1A', '#D32F2F', '#F5A623', '#2E7D32', '#2196F3', '#7B1FA2'].map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, color === c && styles.colorDotActive, { backgroundColor: c }]}
                onPress={() => setColor(c)}
                accessibilityLabel={`Color ${c}`}
              />
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.widthRow}>
            <Minus size={14} color={Colors.light.textTertiary} />
            <TouchableOpacity
              style={[styles.widthDot, strokeWidth === 2 && styles.widthDotActive]}
              onPress={() => setStrokeWidth(2)}
            />
            <TouchableOpacity
              style={[styles.widthDot, strokeWidth === 4 && styles.widthDotActive, { width: 16, height: 16 }]}
              onPress={() => setStrokeWidth(4)}
            />
            <TouchableOpacity
              style={[styles.widthDot, strokeWidth === 8 && styles.widthDotActive, { width: 22, height: 22 }]}
              onPress={() => setStrokeWidth(8)}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.clearBtn}
            onPress={onClear}
            accessibilityLabel="Clear board"
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.lockedWrap}>
          <Lock size={18} color={Colors.light.textTertiary} />
          <Text style={styles.lockedText}>Waiting for teacher to grant access</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    alignSelf: 'center',
  } as ViewStyle,
  disabled: {
    opacity: 0.5,
  } as ViewStyle,
  toolRow: {
    flexDirection: 'row',
    gap: 4,
  } as ViewStyle,
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  toolBtnActive: {
    backgroundColor: Colors.primary,
  } as ViewStyle,
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  } as ViewStyle,
  colorRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  } as ViewStyle,
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  } as ViewStyle,
  colorDotActive: {
    borderColor: Colors.light.text,
  } as ViewStyle,
  widthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  widthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.text,
    borderWidth: 2,
    borderColor: 'transparent',
  } as ViewStyle,
  widthDotActive: {
    borderColor: Colors.primary,
  } as ViewStyle,
  clearBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  } as ViewStyle,
  clearText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.error,
  } as ViewStyle,
  lockedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  } as ViewStyle,
  lockedText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontWeight: '500',
  } as ViewStyle,
});
