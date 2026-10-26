import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { PlayerData, STORE_ITEMS } from '../types';
import { ArrowLeft, Fish } from 'lucide-react';
import { drawCat } from '../utils/drawCat';
import { motion } from 'motion/react';

interface Props {
  onBack: () => void;
  playerData: PlayerData;
  setPlayerData: Dispatch<SetStateAction<PlayerData>>;
}




function MiniCat({ colorId, playerData }: { colorId: string, playerData: any }) {
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
      ctx.clearRect(0, 0, 48, 48);
      const fakeCat = { catType: colorId, abilityTimer: 0, wingsTimer: 0, goldenBoostTimer: 0 };
      const pd = colorId === playerData.currentColor ? playerData : { ...playerData, currentAccessory: 'none' };
      drawCat(ctx, frames, fakeCat, 12, 28, 24, 24, true, pd, 'STANDING');
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [colorId, playerData]);
  return <canvas ref={canvasRef} width={48} height={48} className="mx-auto block" />;
}

function MiniAccessory({ accessoryId, playerData }: { accessoryId: string, playerData: any }) {
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
      ctx.clearRect(0, 0, 48, 48);
      const fakeCat = { catType: playerData.currentColor, abilityTimer: 0, wingsTimer: 0, goldenBoostTimer: 0 };
      const pd = { ...playerData, currentAccessory: accessoryId };
      drawCat(ctx, frames, fakeCat, 12, 28, 24, 24, true, pd, 'STANDING');
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [accessoryId, playerData]);
  return <canvas ref={canvasRef} width={48} height={48} className="mx-auto block" />;
}

export default function Store({ onBack, playerData, setPlayerData }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const getTotalCapacity = () => {
    const unlocked = playerData.unlockedRooms || ['Bedroom'];
    let cap = 0;
    unlocked.forEach(rId => {
      const r = STORE_ITEMS.rooms?.find(room => room.id === rId);
      if (r) cap += r.capacity;
    });
    return cap;
  };

  const buyColor = (id: string, cost: number) => {
    if (playerData.yarns >= cost && !playerData.ownedColors.includes(id)) {
      if (playerData.ownedColors.length >= getTotalCapacity()) {
        setNotice('Your rooms are full! Buy another room first.');
        return;
      }
      setPlayerData(prev => ({
        ...prev,
        yarns: prev.yarns - cost,
        ownedColors: [...prev.ownedColors, id],
        currentColor: id
      }));
    }
  };

  const buyRoom = (id: string, cost: number) => {
    const unlocked = playerData.unlockedRooms || ['Bedroom'];
    if (playerData.yarns >= cost && !unlocked.includes(id)) {
      setPlayerData(prev => ({
        ...prev,
        yarns: prev.yarns - cost,
        unlockedRooms: [...(prev.unlockedRooms || ['Bedroom']), id]
      }));
    }
  };


  const buyAccessory = (id: string, cost: number) => {
    if (playerData.yarns >= cost && !playerData.ownedAccessories.includes(id)) {
      setPlayerData(prev => ({
        ...prev,
        yarns: prev.yarns - cost,
        ownedAccessories: [...prev.ownedAccessories, id],
        currentAccessory: id
      }));
    }
  };

  const equipColor = (id: string) => {
    setPlayerData(prev => ({ ...prev, currentColor: id }));
  };
  // Gear is a one-run consumable: buy it, it's used up by the next run (one gear at a time)
  const buyGear = (id: string, cost: number) => {
    if (playerData.yarns >= cost && (!playerData.activeGear || playerData.activeGear === 'NONE')) {
      setPlayerData(prev => ({ ...prev, yarns: prev.yarns - cost, activeGear: id as any }));
    }
  };
  const equipAccessory = (id: string) => {
    setPlayerData(prev => ({ ...prev, currentAccessory: id === 'none' ? null : id }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col bg-slate-950 text-slate-100 font-mono overflow-y-auto"
    >
      {/* Night Sky Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_20%,#1e293b_0%,#020617_100%)] pointer-events-none -z-10"></div>

      {/* Header */}
      <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6 flex items-center justify-between z-10">
        <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2 tracking-widest">
          <span className="w-2 h-6 bg-yellow-500"></span>
          EQUIPMENT
        </h2>
        <div className="flex items-center gap-2">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-yellow-500 mr-1 hidden sm:block">Fish Caught</div>
          <Fish className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
          <span className="text-lg sm:text-xl font-bold text-yellow-400">{playerData.yarns}</span>
        </div>
      </div>

      {notice && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-xl border border-amber-500/50 bg-slate-900/95 px-4 py-3 text-center text-sm font-bold text-amber-300 shadow-xl">
          {notice}
        </div>
      )}

      <div className="p-6 space-y-8 pb-20 max-w-4xl mx-auto w-full">
        
        {/* Cats */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
            <span className="w-1.5 h-5 bg-blue-500"></span>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cat Collection</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {STORE_ITEMS.colors.map(item => {
              const owned = playerData.ownedColors.includes(item.id);
              const equipped = playerData.currentColor === item.id;
              const isMafia = item.id === 'mafia';
              const locked = isMafia && !playerData.stats?.bossDefeated;
              
              return (
                <div key={item.id} className={`p-4 rounded-lg border flex flex-col items-center justify-between text-center ${equipped ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}>
                  <div>
                    <div className="w-12 h-12 mb-3 mx-auto flex items-center justify-center"><MiniCat colorId={item.id} playerData={playerData} /></div>
                    <div className="font-bold text-slate-200 text-sm mb-1">{item.name}</div>
                    <div className="text-slate-400 text-xs mb-4">{item.desc}</div>
                  </div>
                  {locked ? (
                    <button disabled className="w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded bg-slate-800 text-slate-500 border border-slate-700">Locked</button>
                  ) : owned ? (
                    <button 
                      onClick={() => equipColor(item.id)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded ${equipped ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      {equipped ? 'ACTIVE' : 'EQUIP'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => buyColor(item.id, item.cost)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex justify-center items-center gap-1 rounded ${playerData.yarns >= item.cost ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <span>{item.cost} FISH</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        
        {/* Rooms */}
        <section className="mb-8">
          <div className="flex justify-between items-end border-b border-slate-700 pb-2 mb-4">
            <h3 className="text-xl font-bold tracking-wider text-slate-200">ROOMS</h3>
            <div className="text-xs text-slate-400">Total Capacity: {getTotalCapacity()} cats</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {STORE_ITEMS.rooms?.map(item => {
              const unlocked = (playerData.unlockedRooms || ['Bedroom']).includes(item.id);
              
              return (
                <div key={item.id} className={`p-4 rounded-lg border flex flex-col items-center justify-between text-center ${unlocked ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}>
                  <div>
                    <div className="font-bold text-slate-200 mb-1">{item.name}</div>
                    <div className="text-slate-400 text-xs mb-2">Capacity: {item.capacity} Cats</div>
                    <div className="text-slate-500 text-xs mb-4">{item.desc}</div>
                  </div>
                  {unlocked ? (
                    <button disabled className="w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded bg-slate-800 text-slate-500 border border-slate-700">UNLOCKED</button>
                  ) : (
                    <button 
                      onClick={() => buyRoom(item.id, item.cost)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex justify-center items-center gap-1 rounded ${playerData.yarns >= item.cost ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <span>{item.cost} FISH</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Accessories */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
            <span className="w-1.5 h-5 bg-purple-500"></span>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Accessories</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STORE_ITEMS.accessories.map(item => {
              const owned = playerData.ownedAccessories.includes(item.id);
              const equipped = playerData.currentAccessory === item.id;
              
              return (
                <div key={item.id} className={`p-4 rounded-lg border flex flex-col items-center ${equipped ? 'border-purple-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}>
                  <div className="w-12 h-12 mb-2 mx-auto flex items-center justify-center"><MiniAccessory accessoryId={item.id} playerData={playerData} /></div><span className="font-bold text-slate-300 text-xs mb-4 text-center h-8 flex items-center justify-center">{item.name}</span>
                  {owned ? (
                    <button 
                      onClick={() => equipAccessory(item.id)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded ${equipped ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      {equipped ? 'ACTIVE' : 'EQUIP'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => buyAccessory(item.id, item.cost)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex justify-center items-center gap-1 rounded ${playerData.yarns >= item.cost ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <span>{item.cost} FISH</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      
        {/* Traits & Gears */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
            <span className="w-1.5 h-5 bg-green-500"></span>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Gear · lasts one run</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {STORE_ITEMS.gears.filter(item => item.id !== 'NONE').map(item => {
              const equipped = playerData.activeGear === item.id;
              const otherActive = !!playerData.activeGear && playerData.activeGear !== 'NONE' && !equipped;
              
              return (
                <div key={item.id} className={`p-4 rounded-lg border flex flex-col items-center justify-between text-center ${equipped ? 'border-green-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}>
                  <div>
                    <div className="font-bold text-slate-200 text-sm mb-1">{item.name}</div>
                    {item.description && <div className="text-slate-400 text-xs mb-4">{item.description}</div>}
                  </div>
                  {equipped ? (
                    <button disabled className="w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded bg-green-500 text-white">Ready for next run</button>
                  ) : otherActive ? (
                    <button disabled className="w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded bg-slate-800 text-slate-500 border border-slate-700">One gear per run</button>
                  ) : (
                    <button 
                      onClick={() => buyGear(item.id, item.cost)}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex justify-center items-center gap-1 rounded ${playerData.yarns >= item.cost ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <span>{item.cost} FISH</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
