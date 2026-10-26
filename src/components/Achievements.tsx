import React from 'react';
import { PlayerData } from '../types';
import { X, Award, Medal, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  playerData: PlayerData;
  onBack: () => void;
}

const ACHIEVEMENTS_LIST = [
  { id: 'dist1', title: 'Novice Runner', desc: 'Run 1,000m total', target: 1000, type: 'totalDistance' },
  { id: 'dist2', title: 'Marathon Cat', desc: 'Run 5,000m total', target: 5000, type: 'totalDistance' },
  { id: 'dist3', title: 'Globe Trotter', desc: 'Run 20,000m total', target: 20000, type: 'totalDistance' },
  { id: 'fish1', title: 'Snack Time', desc: 'Collect 100 fish total', target: 100, type: 'totalYarns' },
  { id: 'fish2', title: 'Fish Hoarder', desc: 'Collect 500 fish total', target: 500, type: 'totalYarns' },
  { id: 'fish3', title: 'Ocean Master', desc: 'Collect 2,000 fish total', target: 2000, type: 'totalYarns' },
  { id: 'obs1', title: 'Clumsy', desc: 'Destroy 20 obstacles', target: 20, type: 'totalObstacles' },
  { id: 'obs2', title: 'Bulldozer', desc: 'Destroy 100 obstacles', target: 100, type: 'totalObstacles' },
  { id: 'obs3', title: 'Unstoppable', desc: 'Destroy 500 obstacles', target: 500, type: 'totalObstacles' },
];

export default function Achievements({ playerData, onBack }: Props) {
  const stats = playerData.stats || { totalDistance: 0, totalYarns: 0, totalObstacles: 0 };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col font-mono relative overflow-hidden text-slate-200">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <Award size={28} className="text-purple-400" />
          <h2 className="text-2xl font-black uppercase tracking-widest text-white">Achievements</h2>
        </div>
        <button 
          onClick={onBack}
          className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <X size={24} className="text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-24 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACHIEVEMENTS_LIST.map((ach) => {
            // @ts-ignore
            const progress = stats[ach.type] || 0;
            const completed = progress >= ach.target;
            const progressPercent = Math.min(100, (progress / ach.target) * 100);

            return (
              <motion.div 
                key={ach.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${completed ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-slate-800'} flex gap-4 items-center`}
              >
                <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${completed ? 'bg-purple-500/20' : 'bg-slate-800'}`}>
                  {completed ? <Medal size={24} className="text-purple-400" /> : <Award size={24} className="text-slate-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-bold uppercase tracking-wider text-sm ${completed ? 'text-white' : 'text-slate-400'}`}>
                      {ach.title}
                    </h3>
                    {completed && <CheckCircle size={16} className="text-purple-400" />}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{ach.desc}</p>
                  
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${completed ? 'bg-purple-400' : 'bg-slate-600'}`} 
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 min-w-[50px] text-right">
                      {Math.floor(progress)} / {ach.target}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
