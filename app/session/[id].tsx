import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSession } from '@/lib/useSession';
import { useAuth } from '@/lib/auth';
import { Colors, Typography, Spacing, Radius } from '@/lib/theme';
import { WhiteboardCanvas } from '@/components/WhiteboardCanvas';
import { Toolbar } from '@/components/Toolbar';
import { ParticipantList } from '@/components/ParticipantList';
import { ReactionOverlay, REACTION_EMOJIS } from '@/components/ReactionOverlay';
import {
  ArrowLeft,
  Users,
  Hand,
  Smile,
  MoreVertical,
  X,
  History,
  Play,
  Pause,
  Rewind,
  FastForward,
} from 'lucide-react-native';

type Tool = 'pen' | 'text' | 'eraser' | 'laser';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const session = useSession(id);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1A1A1A');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [textModal, setTextModal] = useState<{ x: number; y: number } | null>(null);
  const [textContent, setTextContent] = useState('');
  const [laserPoints, setLaserPoints] = useState<{ id: string; x: number; y: number }[]>([]);
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const canvasRef = useRef<View | null>(null);
  const laserClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear laser points after a short delay
  useEffect(() => {
    if (laserPoints.length > 0) {
      if (laserClearTimer.current) clearTimeout(laserClearTimer.current);
      laserClearTimer.current = setTimeout(() => {
        setLaserPoints([]);
      }, 800);
    }
  }, [laserPoints]);

  // Replay playback
  useEffect(() => {
    if (replayMode && replayPlaying) {
      replayTimer.current = setInterval(() => {
        setReplayIndex((i) => {
          if (i >= session.events.length - 1) {
            setReplayPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 200);
      return () => {
        if (replayTimer.current) clearInterval(replayTimer.current);
      };
    }
  }, [replayMode, replayPlaying]);

  const handleStroke = useCallback(
    (points: { x: number; y: number }[], complete: boolean, strokeId: string) => {
      session.sendEvent('stroke', { strokeId, color, width: strokeWidth, points, complete });
    },
    [session, color, strokeWidth],
  );

  const handleText = useCallback((x: number, y: number) => {
    setTextModal({ x, y });
    setTextContent('');
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (textContent.trim() && textModal) {
      const textId = `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      session.sendEvent('text', {
        textId,
        content: textContent.trim(),
        x: textModal.x,
        y: textModal.y,
        fontSize: 18,
        color,
      });
    }
    setTextModal(null);
    setTextContent('');
  }, [textContent, textModal, color, session]);

  const handleLaser = useCallback((x: number, y: number) => {
    const laserId = `laser_${Date.now()}`;
    setLaserPoints((prev) => [...prev.slice(-3), { id: laserId, x, y }]);
    session.sendEvent('laser', { x, y, laserId });
  }, [session]);

  const handleErase = useCallback((targetId: string) => {
    session.sendEvent('erase', { targetId });
  }, [session]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Board', 'This will erase all strokes and text for everyone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => session.sendEvent('clear', { target: 'all' }) },
    ]);
  }, [session]);

  const handleEndSession = useCallback(() => {
    Alert.alert('End Session', 'This will end the session for all participants. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: async () => {
          await session.endSession();
          router.replace('/(tabs)/lobby');
        },
      },
    ]);
  }, [session, router]);

  const handleSendReaction = useCallback((emoji: string) => {
    session.sendReaction(emoji);
    setShowReactions(false);
  }, [session]);

  const handleRaiseHand = useCallback(async () => {
    const ok = await session.raiseHand();
    if (ok) Alert.alert('Hand Raised', 'The teacher will see your hand raised.');
  }, [session]);

  // Filter events for replay
  const displayEvents = replayMode ? session.events.slice(0, replayIndex + 1) : session.events;

  if (session.loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (session.error || !session.session) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{session.error ?? 'Session not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTeacherOrAdmin = session.isCreator || profile?.role === 'admin';
  const screenWidth = Dimensions.get('window').width;
  const isWide = screenWidth >= 900 && Platform.OS === 'web';

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{session.session.title}</Text>
          {session.session.status === 'live' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.topBarRight}>
          {!isTeacherOrAdmin && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleRaiseHand}
              accessibilityLabel="Raise hand"
            >
              <Hand size={20} color={Colors.accent} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowReactions(!showReactions)}
            accessibilityLabel="Reactions"
          >
            <Smile size={20} color={Colors.light.text} />
          </TouchableOpacity>

          {!isWide && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowParticipants(true)}
              accessibilityLabel="Participants"
            >
              <Users size={20} color={Colors.light.text} />
            </TouchableOpacity>
          )}

          {isTeacherOrAdmin && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowMenu(true)}
              accessibilityLabel="More options"
            >
              <MoreVertical size={20} color={Colors.light.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Reaction picker */}
      {showReactions && (
        <View style={styles.reactionPicker}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionBtn}
              onPress={() => handleSendReaction(emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Main content area */}
      <View style={styles.mainContent}>
        {/* Canvas */}
        <View style={styles.canvasArea}>
          <WhiteboardCanvas
            events={displayEvents}
            canDraw={session.canDraw && !replayMode}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            onStroke={handleStroke}
            onText={handleText}
            onLaser={handleLaser}
            onErase={handleErase}
            onClear={handleClear}
            laserPoints={laserPoints}
            canvasRef={canvasRef}
          />

          {/* Toolbar overlay */}
          {!replayMode && (
            <View style={styles.toolbarWrap}>
              <Toolbar
                canDraw={session.canDraw}
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                onClear={handleClear}
              />
            </View>
          )}

          {/* Replay controls */}
          {replayMode && (
            <View style={styles.replayControls}>
              <TouchableOpacity
                style={styles.replayBtn}
                onPress={() => setReplayIndex(0)}
                accessibilityLabel="Rewind to start"
              >
                <Rewind size={18} color={Colors.light.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.replayPlayBtn}
                onPress={() => setReplayPlaying(!replayPlaying)}
                accessibilityLabel={replayPlaying ? 'Pause' : 'Play'}
              >
                {replayPlaying ? (
                  <Pause size={20} color="#fff" />
                ) : (
                  <Play size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.replayBtn}
                onPress={() => setReplayIndex(session.events.length - 1)}
                accessibilityLabel="Skip to end"
              >
                <FastForward size={18} color={Colors.light.text} />
              </TouchableOpacity>
              <Text style={styles.replayProgress}>
                {replayIndex + 1} / {session.events.length}
              </Text>
              <TouchableOpacity
                style={styles.replayCloseBtn}
                onPress={() => {
                  setReplayMode(false);
                  setReplayPlaying(false);
                }}
              >
                <X size={16} color={Colors.light.textSecondary} />
                <Text style={styles.replayCloseText}>Exit Replay</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Side panel for wide screens */}
        {isWide && (
          <View style={styles.sidePanel}>
            <Text style={styles.sidePanelTitle}>Participants</Text>
            <ParticipantList
              participants={session.participants}
              handRaises={session.handRaises}
              isCreator={session.isCreator}
              currentUserId={profile?.id ?? ''}
              onToggleDraw={session.toggleDrawPermission}
              onResolveHandRaise={session.resolveHandRaise}
            />
          </View>
        )}
      </View>

      {/* Reaction overlay */}
      <ReactionOverlay />

      {/* Participants bottom sheet (mobile) */}
      <Modal
        visible={showParticipants}
        animationType="slide"
        transparent
        onRequestClose={() => setShowParticipants(false)}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHandle} />
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Participants</Text>
            <TouchableOpacity onPress={() => setShowParticipants(false)}>
              <X size={22} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
          <ParticipantList
            participants={session.participants}
            handRaises={session.handRaises}
            isCreator={session.isCreator}
            currentUserId={profile?.id ?? ''}
            onToggleDraw={session.toggleDrawPermission}
            onResolveHandRaise={session.resolveHandRaise}
          />
        </View>
      </Modal>

      {/* Text input modal */}
      <Modal
        visible={!!textModal}
        transparent
        animationType="fade"
        onRequestClose={() => setTextModal(null)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.textModalOverlay}>
          <View style={styles.textModal}>
            <Text style={styles.textModalTitle}>Add Text</Text>
            <TextInput
              style={styles.textModalInput}
              value={textContent}
              onChangeText={setTextContent}
              autoFocus
              placeholder="Type here..."
              placeholderTextColor={Colors.light.textTertiary}
              onSubmitEditing={handleTextSubmit}
            />
            <View style={styles.textModalActions}>
              <TouchableOpacity onPress={() => setTextModal(null)}>
                <Text style={styles.textModalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.textModalSubmit} onPress={handleTextSubmit}>
                <Text style={styles.textModalSubmitText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Teacher menu */}
      <Modal
        visible={showMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContent}>
            {session.isCreator && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setReplayMode(true);
                  setReplayIndex(0);
                }}
              >
                <History size={18} color={Colors.light.text} />
                <Text style={styles.menuItemText}>Time Machine (Replay)</Text>
              </TouchableOpacity>
            )}
            {session.isCreator && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={() => {
                  setShowMenu(false);
                  handleEndSession();
                }}
              >
                <X size={18} color={Colors.error} />
                <Text style={[styles.menuItemText, { color: Colors.error }]}>End Session</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.bg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.light.bg,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  errorText: {
    ...Typography.subtitle,
    color: Colors.error,
  },
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sessionTitle: {
    ...Typography.subtitle,
    color: Colors.light.text,
    flexShrink: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  reactionBtn: {
    padding: Spacing.xs,
  borderRadius: Radius.md,
  backgroundColor: Colors.light.surfaceVariant,
  width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
  },
  toolbarWrap: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  replayControls: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'center',
    marginHorizontal: 'auto',
  },
  replayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayProgress: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    paddingHorizontal: Spacing.sm,
  },
  replayCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    marginLeft: Spacing.xs,
  },
  replayCloseText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  sidePanel: {
    width: 280,
    backgroundColor: Colors.light.surface,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sidePanelTitle: {
    ...Typography.subtitle,
    color: Colors.light.text,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '70%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bottomSheetTitle: {
    ...Typography.title,
    color: Colors.light.text,
  },
  textModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.xl,
  },
  textModal: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.md,
  },
  textModalTitle: {
    ...Typography.subtitle,
    color: Colors.light.text,
  },
  textModalInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.light.text,
  },
  textModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    alignItems: 'center',
  },
  textModalCancel: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  textModalSubmit: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  textModalSubmitText: {
    color: '#fff',
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingBottom: Spacing.xxl,
    paddingRight: Spacing.md,
  },
  menuContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    width: 240,
    alignSelf: 'flex-end',
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  menuItemDanger: {},
  menuItemText: {
    ...Typography.body,
    color: Colors.light.text,
    fontWeight: '500',
  },
});
