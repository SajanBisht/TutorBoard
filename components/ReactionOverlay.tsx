import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing } from '@/lib/theme';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

const REACTION_EMOJIS = ['👍', '👏', '❓', '🎉', '💡'];

export function ReactionOverlay() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; emoji: string; user_id: string };
      const x = Math.random() * 60 + 20;
      const opacity = new Animated.Value(1);
      const translateY = new Animated.Value(0);

      const reaction: FloatingReaction = {
        id: detail.id + Date.now(),
        emoji: detail.emoji,
        x,
        y: 80,
        opacity,
        translateY,
      };

      setReactions((prev) => [...prev, reaction]);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('tutorboard:reaction', handler);
      return () => window.removeEventListener('tutorboard:reaction', handler);
    }
  }, []);

  if (reactions.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r) => (
        <Animated.View
          key={r.id}
          style={[
            styles.reaction,
            { left: `${r.x}%`, top: r.y, opacity: r.opacity, transform: [{ translateY: r.translateY }] },
          ]}
        >
          <Text style={styles.emoji}>{r.emoji}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

export { REACTION_EMOJIS };

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  reaction: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 28,
  },
});
