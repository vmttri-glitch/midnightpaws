import { useEffect, useRef } from 'react';
import { RotateCcw, Home, Fish, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { PlayerData } from '../types';
import { drawCat } from '../utils/drawCat';

interface Props {
  score: number;
  fish: number;
  best: number;
  isNewBest: boolean;
  challengeReward?: number;
  playerData: PlayerData;
  onMenu: () => void;
  onRestart: () => void;
}

// Full-screen animated backdrop: night skyline with the player's cat asleep on a rooftop
function GameOverScene({ playerData }: { playerData: PlayerData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let frames = 0;
    const prng = (n: number) => { const x = Math.sin(n * 999.99) * 10000; return x - Math.floor(x); };

    const render = () => {
      frames++;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#01030c');
      sky.addColorStop(0.6, '#0b1233');
      sky.addColorStop(1, '#231a4a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 90; i++) {
        ctx.globalAlpha = 0.25 + 0.6 * (Math.sin(frames * 0.03 + i) + 1) / 2;
        ctx.fillRect(prng(i) * W, prng(i + 50) * H * 0.7, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // moon
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = 'rgba(253, 224, 71, 0.6)';
      ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(W * 0.78, H * 0.14, Math.min(W, H) * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // skyline (slow drift)
      const drift = frames * 0.15;
      const drawSkyline = (baseY: number, color: string, scale: number, seed: number, speed: number) => {
        ctx.fillStyle = color;
        const bw = 46 * scale;
        const off = (drift * speed) % bw;
        for (let i = -1; i < W / bw + 2; i++) {
          const idx = i + Math.floor((drift * speed) / bw);
          const bh = (60 + prng(idx * 3.7 + seed) * 150) * scale;
          const x = i * bw - off;
          ctx.fillRect(x, baseY - bh, bw - 4, bh + H);
          ctx.fillStyle = 'rgba(253, 224, 71, 0.18)';
          for (let wy = baseY - bh + 10; wy < baseY - 8; wy += 16 * scale) {
            if (prng(idx * 7.1 + wy) > 0.55) ctx.fillRect(x + 6, wy, 8 * scale, 6 * scale);
            if (prng(idx * 5.3 + wy) > 0.55) ctx.fillRect(x + bw - 18, wy, 8 * scale, 6 * scale);
          }
          ctx.fillStyle = color;
        }
      };
      drawSkyline(H * 0.78, '#0f1530', 1, 1, 0.3);
      drawSkyline(H * 0.86, '#0a0f24', 1.3, 2, 0.6);

      // rooftop ledge
      const roofY = H * 0.86;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, roofY, W, H - roofY);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, roofY, W, 8);

      // sleeping cat + Zzz
      const catSize = Math.max(56, Math.min(W, H) * 0.14);
      const cx = W * 0.5 - catSize / 2;
      ctx.save();
      ctx.translate(cx, roofY - catSize);
      ctx.scale(catSize / 60, catSize / 60);
      drawCat(ctx, frames, { catType: playerData.currentColor, stunTimer: 0, abilityTimer: 0, jumps: 0, vy: 0 }, 0, 0, 60, 60, true, playerData, 'SLEEPING');
      ctx.restore();
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const tt = ((frames * 0.6 + i * 40) % 120) / 120;
        ctx.globalAlpha = Math.sin(tt * Math.PI);
        ctx.font = `bold ${12 + tt * 14}px monospace`;
        ctx.fillText('z', W * 0.5 + catSize * 0.3 + tt * 30, roofY - catSize - tt * 60);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [playerData]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function GameOver({ score, fish, best, isNewBest, challengeReward = 0, playerData, onMenu, onRestart }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 text-slate-100 font-mono z-50 overflow-hidden"
    >
      <GameOverScene playerData={playerData} />

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-start pt-[12vh] px-6 pb-[22vh]">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] mb-2"
        >
          The night catches up...
        </motion.div>

        <motion.h2
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl font-black text-red-500 mb-6 tracking-widest text-center"
          style={{ textShadow: '4px 4px 0px #020617, 0 0 40px rgba(239,68,68,0.45)' }}
        >
          GAME OVER
        </motion.h2>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="relative bg-slate-950/70 backdrop-blur-md border border-white/10 px-6 py-5 rounded-2xl flex flex-col items-center w-full max-w-[320px] shadow-2xl"
        >
          {isNewBest && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.6 }}
              className="absolute -top-3 right-4 flex items-center gap-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-lg shadow-amber-500/40"
            >
              <Crown size={12} /> New Best!
            </motion.div>
          )}
          <span className="text-slate-400 font-bold uppercase tracking-[0.2em] mb-1 text-xs">Distance</span>
          <span className="text-5xl font-black text-white tabular-nums">{score}<span className="text-2xl text-slate-400 ml-1">m</span></span>
          <div className="w-full grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Fish</span>
              <span className="flex items-center gap-1 text-xl font-bold text-yellow-400"><Fish size={16} /> +{fish}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Best</span>
              <span className="text-xl font-bold text-slate-200 tabular-nums">{Math.max(best, score)}m</span>
            </div>
          </div>
          {challengeReward > 0 && (
            <div className="w-full mt-3 pt-3 border-t border-white/10 text-center text-xs font-bold uppercase tracking-widest text-emerald-400">
              Daily challenge complete! +{challengeReward} fish
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex gap-4 mt-6"
        >
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onMenu}
            className="flex flex-col items-center justify-center w-28 sm:w-32 py-4 bg-slate-800/90 active:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl transition-colors backdrop-blur-sm"
          >
            <Home size={26} className="mb-2" />
            <span className="font-bold text-xs uppercase tracking-[0.15em]">Menu</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onRestart}
            className="flex flex-col items-center justify-center w-40 sm:w-48 py-4 bg-amber-500 active:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-lg shadow-amber-500/30"
          >
            <RotateCcw size={26} className="mb-2" />
            <span className="font-black text-lg uppercase tracking-tight">Retry</span>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
