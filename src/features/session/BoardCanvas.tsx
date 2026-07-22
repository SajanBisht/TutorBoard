import { useEffect, useRef, useState, useCallback, PointerEvent as ReactPointerEvent } from 'react';
import { v4 as uuid } from 'uuid';
import { BoardItem } from './useBoardSync';
import { Tool, ToolColor } from './toolbar';

interface BoardCanvasProps {
  items: BoardItem[];
  tool: Tool; color: ToolColor; width: number; canDraw: boolean;
  onStrokeCommit: (strokeId: string, points: { x: number; y: number }[]) => void;
  onTextCommit: (textId: string, content: string, x: number, y: number) => void;
  onErase: (targetId: string) => void;
}

export function BoardCanvas({ items, tool, color, width, canDraw, onStrokeCommit, onTextCommit, onErase }: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentStroke, setCurrentStroke] = useState<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const [textInput, setTextInput] = useState<{ id: string; x: number; y: number; value: string } | null>(null);
  const drawingRef = useRef(false);

  const toLocal = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canDraw) return;
    if (tool === 'pen') {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drawingRef.current = true;
      const p = toLocal(e);
      setCurrentStroke({ id: uuid(), points: [p] });
    } else if (tool === 'text') {
      const p = toLocal(e);
      setTextInput({ id: uuid(), x: p.x, y: p.y, value: '' });
    } else if (tool === 'eraser') {
      const hit = hitTest(items, toLocal(e));
      if (hit) onErase(hit.id);
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!canDraw || tool !== 'pen' || !drawingRef.current || !currentStroke) return;
    const p = toLocal(e);
    setCurrentStroke((s) => (s ? { ...s, points: [...s.points, p] } : s));
  };

  const onPointerUp = () => {
    if (!canDraw || tool !== 'pen' || !drawingRef.current) return;
    drawingRef.current = false;
    if (currentStroke && currentStroke.points.length > 0) {
      onStrokeCommit(currentStroke.id, currentStroke.points);
    }
    setCurrentStroke(null);
  };

  const submitText = useCallback(() => {
    if (!textInput) return;
    if (textInput.value.trim()) onTextCommit(textInput.id, textInput.value.trim(), textInput.x, textInput.y);
    setTextInput(null);
  }, [textInput, onTextCommit]);

  useEffect(() => {
    if (!textInput) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') submitText();
      if (e.key === 'Escape') setTextInput(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [textInput, submitText]);

  const cursor = !canDraw ? 'default' : tool === 'pen' ? 'crosshair' : tool === 'text' ? 'text' : 'cell';

  return (
    <svg ref={svgRef} className="board-surface h-full w-full touch-none"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      style={{ cursor, display: 'block' }}>
      {items.map((it) =>
        it.type === 'stroke' && it.points && it.points.length > 0 ? (
          <polyline key={it.id} points={it.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={it.color || '#1A1A1A'} strokeWidth={it.width || 3} strokeLinecap="round" strokeLinejoin="round" />
        ) : it.type === 'text' ? (
          <foreignObject key={it.id} x={it.x || 0} y={(it.y || 0) - (it.fontSize || 16)} width={400} height={80}>
            <div style={{ fontSize: it.fontSize || 16, fontFamily: 'Inter, sans-serif', color: it.color || '#1A1A1A', lineHeight: 1.3, whiteSpace: 'pre-wrap', pointerEvents: 'none' }}>{it.content}</div>
          </foreignObject>
        ) : null
      )}
      {currentStroke && currentStroke.points.length > 0 && (
        <polyline points={currentStroke.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color.value} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
      )}
      {textInput && (
        <foreignObject x={textInput.x} y={textInput.y - 20} width={320} height={48}>
          <input autoFocus value={textInput.value} onChange={(e) => setTextInput({ ...textInput, value: e.target.value })} onBlur={submitText} placeholder="Type and press Enter"
            className="w-full rounded-md border border-brand-500 bg-white px-2 py-1 text-sm text-ink-800 outline-none shadow-soft dark:bg-ink-700 dark:text-ink-50" style={{ fontSize: 16 }} />
        </foreignObject>
      )}
    </svg>
  );
}

function hitTest(items: BoardItem[], p: { x: number; y: number }): BoardItem | null {
  const threshold = 8;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type === 'stroke' && it.points) {
      for (const pt of it.points) {
        if (Math.abs(pt.x - p.x) <= threshold && Math.abs(pt.y - p.y) <= threshold) return it;
      }
    } else if (it.type === 'text') {
      const w = 200, h = (it.fontSize || 16) * 1.5;
      const ix = it.x || 0, iy = it.y || 0;
      if (p.x >= ix && p.x <= ix + w && p.y >= iy - h && p.y <= iy) return it;
    }
  }
  return null;
}
