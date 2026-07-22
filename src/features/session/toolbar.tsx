export type Tool = 'pen' | 'text' | 'eraser';
export interface ToolColor { name: string; value: string; }

export const COLORS: ToolColor[] = [
  { name: 'Ink', value: '#1A1A1A' },
  { name: 'Indigo', value: '#3B4FE0' },
  { name: 'Amber', value: '#F5A623' },
  { name: 'Green', value: '#2E7D32' },
  { name: 'Red', value: '#D32F2F' },
  { name: 'Blue', value: '#1976D2' },
];

interface ToolbarProps {
  tool: Tool; setTool: (t: Tool) => void;
  color: ToolColor; setColor: (c: ToolColor) => void;
  width: number; setWidth: (w: number) => void;
  canDraw: boolean; onClear: () => void;
}

export function Toolbar({ tool, setTool, color, setColor, width, setWidth, canDraw, onClear }: ToolbarProps) {
  return (
    <div className="pointer-events-auto relative">
      <div className={`flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-1.5 shadow-float transition dark:border-ink-700 dark:bg-ink-700 ${!canDraw ? 'opacity-40' : ''}`}>
        <ToolButton active={tool === 'pen'} onClick={() => canDraw && setTool('pen')} disabled={!canDraw} label="Pen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
        </ToolButton>
        <ToolButton active={tool === 'text'} onClick={() => canDraw && setTool('text')} disabled={!canDraw} label="Text">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
        </ToolButton>
        <ToolButton active={tool === 'eraser'} onClick={() => canDraw && setTool('eraser')} disabled={!canDraw} label="Eraser">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l7 7a2 2 0 0 1 0 3l-3 3" /><path d="M15 5l5 5" /></svg>
        </ToolButton>
        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-600" />
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button key={c.value} onClick={() => canDraw && setColor(c)} disabled={!canDraw} aria-label={c.name}
              className={`h-6 w-6 rounded-full border-2 transition ${color.value === c.value ? 'border-ink-800 dark:border-ink-100 scale-110' : 'border-transparent'} ${!canDraw ? 'cursor-not-allowed' : 'hover:scale-110'}`}
              style={{ backgroundColor: c.value }} />
          ))}
        </div>
        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-600" />
        <div className="flex items-center gap-2 px-1">
          <input type="range" min={1} max={20} value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={!canDraw} className="w-20 accent-brand-500" aria-label="Stroke width" />
          <span className="w-6 text-center text-[11px] tabular-nums text-ink-500 dark:text-ink-300">{width}</span>
        </div>
        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-600" />
        <ToolButton active={false} onClick={() => canDraw && onClear()} disabled={!canDraw} label="Clear board">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
        </ToolButton>
      </div>
      {!canDraw && (
        <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-700 px-2 py-1 text-[11px] text-white shadow-soft dark:bg-ink-900">
          <span className="inline-flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Waiting for teacher to grant access
          </span>
        </div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, disabled, label, children }: { active: boolean; onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-full transition ${active ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-600'} ${disabled ? 'cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
}
