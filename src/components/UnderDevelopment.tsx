import { motion } from 'motion/react';
import { ArrowLeft, Hammer } from 'lucide-react';

interface Props {
  // What the player tried to open, e.g. "Global Ranks" or "Stage 4"
  title: string;
  onBack: () => void;
  backLabel?: string;
  // Optional second action (e.g. "Keep Running" after the last boss)
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// Shown for content that isn't built yet, always with a way back.
export default function UnderDevelopment({ title, onBack, backLabel = 'Back', secondaryLabel, onSecondary }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 font-mono"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
          <Hammer size={28} className="text-amber-400" />
        </div>
        <h2 className="mb-2 text-xl font-black uppercase tracking-widest text-white">{title}</h2>
        <p className="mb-6 text-sm text-slate-300">The content is under development</p>
        <div className="flex flex-col gap-2">
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-black uppercase tracking-widest text-slate-950 active:bg-amber-400"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={onBack}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold uppercase tracking-widest text-slate-100 active:bg-slate-700"
          >
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
