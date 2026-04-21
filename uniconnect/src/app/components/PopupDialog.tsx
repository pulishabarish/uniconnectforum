import React from 'react';
import { TriangleAlert } from 'lucide-react';

interface PopupDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const PopupDialog: React.FC<PopupDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_100%)] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 ring-1 ring-blue-200">
              <TriangleAlert size={22} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">UniConnect</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-base font-semibold leading-7 text-blue-950">
                {message}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {cancelLabel && onCancel && (
              <button
                onClick={onCancel}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {cancelLabel}
              </button>
            )}
            <button
              onClick={onConfirm}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
