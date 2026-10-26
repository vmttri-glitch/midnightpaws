
// Running Cat Canvas
import { drawCat } from '../utils/drawCat';

function RunningCat({ catType, color, playerData }: { catType: string, color: string, playerData: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let frames = 0;
    let animationId: number;
    
    const render = () => {
      frames++;
      ctx.clearRect(0, 0, 100, 100);
      
      const isGrounded = false; // We can set it to false to make it look like jumping/running
      // Or true to make it bounce
      const fakeCat = { catType, abilityTimer: 0, wingsTimer: 0, goldenBoostTimer: 0 };
      const fakePlayerData = catType === playerData.currentColor ? playerData : { currentAccessory: 'none' } as any;
      
      // We pass state='PLAYING' or something so it bounces
      drawCat(ctx, frames, fakeCat, 30, 40, 40, 40, true, fakePlayerData, 'PLAYING');
      
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [catType, color]);
  
  return <canvas ref={canvasRef} width={100} height={100} className="w-full h-full object-contain" />;
}

import React, { useEffect, useRef } from 'react';
import { PlayerData, STORE_ITEMS } from '../types';
import { ChevronLeft, Lock, Trophy, Fish, Shield, Feather, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface CatGalleryProps {
  onBack: () => void;
  playerData: PlayerData;
}

export default function CatGallery({ onBack, playerData }: CatGalleryProps) {
  return (
    <div className="w-full h-full bg-slate-950 flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center text-slate-400 hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
        >
          <ChevronLeft size={20} /> Back to Room
        </button>
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">Cat Gallery</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-20">

        {/* Boss Battles */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
            <span className="w-1.5 h-5 bg-red-500"></span>
            <h3 className="text-xl font-bold text-slate-300 uppercase tracking-widest">Boss Replays</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex flex-col items-center text-center">
                <div className="w-24 h-24 mb-4"><RunningCat catType="mafia" color="#334155" playerData={playerData} /></div>
                <div className="font-bold text-slate-200 text-lg mb-2">Mafia Cat (City)</div>
                {playerData.stats?.bossDefeated ? (
                    <button 
                       onClick={() => window.location.href = '?boss=mafia'}
                       className="px-6 py-2 mt-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs"
                    >Replay Boss</button>
                ) : (
                    <span className="text-slate-500 text-xs font-bold uppercase mt-2">Locked (Defeat in City)</span>
                )}
            </div>
            
            <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex flex-col items-center text-center">
                <div className="w-24 h-24 mb-4"><RunningCat catType="ninja" color="#1a1a1a" playerData={playerData} /></div>
                <div className="font-bold text-slate-200 text-lg mb-2">Ninja Cat (Building Tops)</div>
                {playerData.stats?.rooftopBossDefeated ? (
                    <button 
                       onClick={() => window.location.href = '?boss=ninja'}
                       className="px-6 py-2 mt-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs"
                    >Replay Boss</button>
                ) : (
                    <span className="text-slate-500 text-xs font-bold uppercase mt-2">Locked (Defeat on Building Tops)</span>
                )}
            </div>

            <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex flex-col items-center text-center">
                <div className="w-24 h-24 mb-4"><RunningCat catType="athlete" color="#facc15" playerData={playerData} /></div>
                <div className="font-bold text-slate-200 text-lg mb-2">Athlete Cat (Stadium)</div>
                {playerData.stats?.stadiumBossDefeated ? (
                    <button 
                       onClick={() => window.location.href = '?boss=athlete'}
                       className="px-6 py-2 mt-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs"
                    >Replay Boss</button>
                ) : (
                    <span className="text-slate-500 text-xs font-bold uppercase mt-2">Locked (Defeat in Stadium)</span>
                )}
            </div>
          </div>
        </section>

        {playerData.stats?.bossDefeated && (
           <div className="mb-10">
              <h3 className="text-xl font-bold text-yellow-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Trophies</h3>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-xl border bg-yellow-900/20 border-yellow-700/50 flex gap-6 items-center relative overflow-hidden"
              >
                <div className="absolute -right-10 -top-10 opacity-10">
                  <Trophy size={150} />
                </div>
                <div className="w-24 h-24 rounded-lg flex items-center justify-center shrink-0 shadow-inner bg-slate-900 relative">
                  <RunningCat catType="mafia" color="#334155" playerData={playerData} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={20} className="text-yellow-400" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Defeated the Mafia Boss</h3>
                  </div>
                  <p className="text-sm text-slate-400">You survived the midnight city and defeated the Mafia Boss at 10,000m!</p>
                  <p className="text-xs text-yellow-500 font-bold mt-2">REWARD: Building Tops Unlocked</p>
                </div>
              </motion.div>
           </div>
        )}

        <h3 className="text-xl font-bold text-slate-300 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Cat Collection</h3>

        {STORE_ITEMS.colors.map((cat, idx) => {
          const isOwned = playerData.ownedColors.includes(cat.id);
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={cat.id}
              className={`p-4 rounded-xl border ${isOwned ? 'bg-slate-900 border-slate-700' : 'bg-slate-950/50 border-slate-800 opacity-60'} flex gap-6 items-center`}
            >
              {/* Cat Avatar/Color preview */}
              <div 
                className="w-24 h-24 rounded-lg flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden"
                style={{ backgroundColor: isOwned ? '#1e293b' : '#0f172a' }}
              >
                {!isOwned && (
                  <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center z-10">
                    <Lock size={32} className="text-slate-500" />
                  </div>
                )}
                <RunningCat catType={cat.id} color={cat.color} playerData={playerData} />
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`text-xl font-black uppercase tracking-wider ${isOwned ? 'text-white' : 'text-slate-500'}`}>
                    {cat.name}
                  </h3>
                  {isOwned && (
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-500/30">
                      Collected
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${isOwned ? 'text-slate-300' : 'text-slate-600'}`}>
                  {cat.desc}
                </p>
              </div>
            </motion.div>
          );
        })}

      <div className="mt-8 mb-4 border-b border-slate-800 pb-2">
        <h3 className="text-xl font-bold text-slate-300 uppercase tracking-widest">Items & Power-ups</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-20">
        {[
          { name: "Fish", color: "#60a5fa", desc: "Currency. Collect to buy things!" },
          { name: "Golden Fish", color: "#f97316", desc: "Speed boost & invincibility!", lockedText: playerData.stats?.bossDefeated ? "" : "Beat the Mafia Cat to unlock" },
          { name: "Shield", color: "#22c55e", desc: "Protects from one hit." },
          { name: "Wings", color: "#ffffff", desc: "Hold jump to fly!" },
          { name: "Time Slow", color: "#a855f7", desc: "Slows down obstacles.", lockedText: playerData.stats?.bossDefeated ? "" : "Beat the Mafia Cat to unlock" },
          { name: "Fish Cannon", color: "#ef4444", desc: "Shoots fish at enemies!", lockedText: playerData.stats?.stadiumBossDefeated ? "" : "Beat the Athlete Cat to unlock" }
        ].map((item: { name: string; color: string; desc: string; lockedText?: string }) => (
          <div key={item.name} className={`p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col items-center text-center ${item.lockedText ? "opacity-60" : ""}`}>
             <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ backgroundColor: item.color + '33', border: '2px solid ' + item.color }}>
                {/* Mockup icons for gallery */}
                {item.name === 'Fish' && <Fish size={32} style={{ color: item.color }} />}
   {item.name === 'Golden Fish' && <Fish size={32} style={{ color: item.color }} />}
   {item.name === 'Shield' && <Shield size={32} style={{ color: item.color }} />}
   {item.name === 'Wings' && <Feather size={32} style={{ color: item.color }} />}
   {item.name === 'Time Slow' && <Clock size={32} style={{ color: item.color }} />}
   {item.name === 'Fish Cannon' && <Zap size={32} style={{ color: item.color }} />}
             </div>
             <div className="font-bold text-slate-200 mb-1">{item.name}</div>
             <div className="text-xs text-slate-500">{item.desc}</div>
             {item.lockedText && <div className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400"><Lock size={10} /> {item.lockedText}</div>}
          </div>
        ))}
      </div>

      </div>
    </div>
  );
}
