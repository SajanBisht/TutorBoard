interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="tb-btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} className={danger ? 'tb-btn-danger' : 'tb-btn-primary'}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
