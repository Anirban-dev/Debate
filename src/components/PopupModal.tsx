import React from 'react';
import { AlertTriangle, ShieldAlert, LogOut, CheckCircle2, Info, X } from 'lucide-react';

export interface ModalData {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  buttonText?: string;
  onConfirm?: () => void;
}

interface PopupModalProps {
  data: ModalData | null;
  onClose: () => void;
}

export const PopupModal: React.FC<PopupModalProps> = ({ data, onClose }) => {
  if (!data || !data.isOpen) return null;

  const { title, message, type = 'info', buttonText = 'Understood', onConfirm } = data;

  let iconHeader = <Info className="w-7 h-7 text-blue-400" />;
  let badgeClass = "bg-blue-950 text-blue-300 border-blue-800";
  let buttonClass = "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40";
  let borderHeaderClass = "border-blue-500/30";

  if (type === 'error') {
    iconHeader = <ShieldAlert className="w-7 h-7 text-red-400" />;
    badgeClass = "bg-red-950 text-red-300 border-red-800";
    buttonClass = "bg-red-600 hover:bg-red-500 shadow-red-900/40";
    borderHeaderClass = "border-red-500/30";
  } else if (type === 'warning') {
    iconHeader = <AlertTriangle className="w-7 h-7 text-amber-400" />;
    badgeClass = "bg-amber-950 text-amber-300 border-amber-800";
    buttonClass = "bg-amber-600 hover:bg-amber-500 shadow-amber-900/40";
    borderHeaderClass = "border-amber-500/30";
  } else if (type === 'success') {
    iconHeader = <CheckCircle2 className="w-7 h-7 text-emerald-400" />;
    badgeClass = "bg-emerald-950 text-emerald-300 border-emerald-800";
    buttonClass = "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40";
    borderHeaderClass = "border-emerald-500/30";
  }

  const handleAction = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-md bg-slate-900/95 border ${borderHeaderClass} rounded-2xl shadow-2xl p-6 overflow-hidden space-y-5 animate-in zoom-in-95 duration-200`}>
        
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${badgeClass}`}>
              {iconHeader}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-wide">
                {title}
              </h3>
              <span className={`inline-block mt-0.5 text-[10px] font-mono font-bold px-2 py-0.2 rounded border uppercase ${badgeClass}`}>
                {type} Notice
              </span>
            </div>
          </div>

          <button
            onClick={handleAction}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Content */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          {message}
        </p>

        {/* Action Button */}
        <button
          onClick={handleAction}
          className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${buttonClass}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};
