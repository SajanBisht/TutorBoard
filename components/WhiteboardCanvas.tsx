import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent, Platform, ViewStyle } from 'react-native';
import Svg, { Path, G, Text as SvgText, Rect, Circle } from 'react-native-svg';
import type { BoardEvent } from '@/lib/types';
import { Colors, Palette } from '@/lib/theme';

interface WhiteboardCanvasProps {
  events: BoardEvent[];
  canDraw: boolean;
  tool: 'pen' | 'text' | 'eraser' | 'laser';
  color: string;
  strokeWidth: number;
  onStroke: (points: { x: number; y: number }[], complete: boolean, strokeId: string) => void;
  onText: (x: number, y: number) => void;
  onLaser: (x: number, y: number) => void;
  onErase: (targetId: string) => void;
  onClear?: () => void;
  onTextTap?: (textId: string) => void;
  spotlight?: { x: number; y: number; width: number; height: number } | null;
  laserPoints: { id: string; x: number; y: number }[];
  canvasRef?: React.RefObject<View | null>;
}

interface ActiveStroke {
  strokeId: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export function WhiteboardCanvas({
  events,
  canDraw,
  tool,
  color,
  strokeWidth,
  onStroke,
  onText,
  onLaser,
  onErase,
  onTextTap,
  spotlight,
  laserPoints,
  canvasRef,
}: WhiteboardCanvasProps) {
  const [activeStroke, setActiveStroke] = useState<ActiveStroke | null>(null);
  const [layout, setLayout] = useState({ width: 800, height: 600 });
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const strokeIdRef = useRef('');
  const lastLaserRef = useRef(0);

  // Build a path string from points
  const buildPath = useCallback((points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
    }
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }, []);

  // Extract completed strokes and texts from events
  const completedStrokes: BoardEvent[] = [];
  const completedTexts: BoardEvent[] = [];
  const erasedIds = new Set<string>();

  events.forEach((e) => {
    const payload = e.payload as any;
    if (e.event_type === 'erase' && payload.targetId) {
      erasedIds.add(payload.targetId);
    }
  });

  events.forEach((e) => {
    const payload = e.payload as any;
    if (e.event_type === 'stroke' && !erasedIds.has(payload.strokeId)) {
      completedStrokes.push(e);
    } else if (e.event_type === 'text' && !erasedIds.has(payload.textId)) {
      completedTexts.push(e);
    }
  });

  // Pan responder for drawing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canDraw && (tool === 'pen' || tool === 'eraser' || tool === 'laser' || tool === 'text'),
      onMoveShouldSetPanResponder: () => canDraw && (tool === 'pen' || tool === 'eraser' || tool === 'laser'),
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (tool === 'text') {
          onText(x, y);
          return;
        }

        if (tool === 'laser') {
          onLaser(x, y);
          return;
        }

        if (tool === 'eraser') {
          const hit = findNearestStroke(x, y, completedStrokes);
          if (hit) onErase((hit.payload as any).strokeId);
          return;
        }

        // Pen: start new stroke
        strokeIdRef.current = `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setActiveStroke({
          strokeId: strokeIdRef.current,
          color,
          width: strokeWidth,
          points: [{ x, y }],
        });
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (tool === 'laser') {
          const now = Date.now();
          if (now - lastLaserRef.current > 50) {
            lastLaserRef.current = now;
            onLaser(x, y);
          }
          return;
        }

        if (tool === 'pen' && activeStroke) {
          setActiveStroke((s) => {
            if (!s) return s;
            return { ...s, points: [...s.points, { x, y }] };
          });
        }
      },
      onPanResponderRelease: () => {
        if (tool === 'pen' && activeStroke) {
          onStroke(activeStroke.points, true, activeStroke.strokeId);
          setActiveStroke(null);
        }
      },
    }),
  ).current;

  // Flush in-progress stroke points periodically
  useEffect(() => {
    if (activeStroke && activeStroke.points.length > 0) {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = setInterval(() => {
        if (activeStroke.points.length > 0) {
          onStroke([...activeStroke.points], false, activeStroke.strokeId);
        }
      }, 40);
    } else {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    }

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [activeStroke, onStroke]);

  const findNearestStroke = (x: number, y: number, strokes: BoardEvent[]): BoardEvent | null => {
    const threshold = 20;
    for (const s of strokes) {
      const pts = (s.payload as any).points || [];
      for (const p of pts) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) return s;
      }
    }
    return null;
  };

  return (
    <View
      ref={canvasRef}
      style={styles.container}
      onLayout={(e) => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      {...panResponder.panHandlers}
    >
      <View style={styles.canvasBg} />

      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <G>
          {/* Completed strokes */}
          {completedStrokes.map((s) => {
            const p = s.payload as any;
            return (
            <Path
              key={s.id}
              d={buildPath(p.points || [])}
              stroke={p.color}
              strokeWidth={p.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            );
          })}

          {/* Active (in-progress) stroke */}
          {activeStroke && activeStroke.points.length > 0 && (
            <Path
              d={buildPath(activeStroke.points)}
              stroke={activeStroke.color}
              strokeWidth={activeStroke.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Completed texts */}
          {completedTexts.map((t) => {
            const p = t.payload as any;
            return (
            <SvgText
              key={t.id}
              x={p.x}
              y={p.y + p.fontSize}
              fontSize={p.fontSize}
              fill={p.color || '#1A1A1A'}
              fontFamily="sans-serif"
              onPress={() => onTextTap?.(p.textId)}
            >
              {p.content}
            </SvgText>
            );
          })}

          {/* Laser pointers */}
          {laserPoints.map((lp) => (
            <G key={lp.id}>
              <Circle cx={lp.x} cy={lp.y} r={14} fill={Colors.error} opacity={0.2} />
              <Circle cx={lp.x} cy={lp.y} r={6} fill={Colors.error} opacity={0.7} />
              <Circle cx={lp.x} cy={lp.y} r={3} fill="#fff" />
            </G>
          ))}

          {/* Spotlight */}
          {spotlight && (
            <Rect
              x={spotlight.x}
              y={spotlight.y}
              width={spotlight.width}
              height={spotlight.height}
              fill="none"
              stroke={Colors.accent}
              strokeWidth={2}
              strokeDasharray="8 4"
              rx={4}
            />
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvasBg,
  } as ViewStyle,
  canvasBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.canvasBg,
  } as ViewStyle,
});
