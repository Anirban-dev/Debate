import React from 'react';
import { Flame, X, CheckCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'roast' | 'info' | 'success' | 'warning';
  title?: string;
}

interface RoastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const RoastNotification: React.FC<RoastNotificationProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const type = toast.type || (toast.message.includes('🔥') || toast.message.includes('roast') ? 'roast' : 'info');

        let bgStyle = "bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-950/80";
        let Icon = Info;
        let iconColor = "text-blue-400";
        let badgeText = "Notification";

        if (type === 'roast') {
          bgStyle = "bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-purple-950/95 border-amber-500/80 text-amber-100 shadow-amber-950/60";
          Icon = Flame;
          iconColor = "text-amber-400 animate-bounce";
          badgeText = "🔥 Hot Roast";
        } else if (type === 'warning') {
          bgStyle = "bg-amber-950/95 border-amber-600/80 text-amber-100 shadow-amber-950/60";
          Icon = AlertTriangle;
          iconColor = "text-amber-400";
          badgeText = "Notice";
        } else if (type === 'success') {
          bgStyle = "bg-emerald-950/95 border-emerald-600/80 text-emerald-100 shadow-emerald-950/60";
          Icon = CheckCircle;
          iconColor = "text-emerald-400";
          badgeText = "Success";
        } else {
          bgStyle = "bg-slate-900/95 border-blue-600/60 text-slate-100 shadow-slate-950/80";
          Icon = Sparkles;
          iconColor = "text-blue-400";
          badgeText = "Update";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ${bgStyle}`}
          >
            <div className={`p-2 rounded-xl bg-slate-950/60 border border-white/10 shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80 font-mono">
                  {toast.title || badgeText}
                </span>
              </div>
              <p className="text-xs font-medium leading-relaxed break-words">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
