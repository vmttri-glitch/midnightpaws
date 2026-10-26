import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { GameState, PlayerData, DailyChallenge, STORE_ITEMS } from './types';
import CatRoom from './components/CatRoom';
import CatGallery from './components/CatGallery';
import Store from './components/Store';
import GameCanvas from './components/GameCanvas';
import GameOver from './components/GameOver';
import Achievements from './components/Achievements';
import { audio } from './utils/audio';

const CHALLENGES = [
  { type: 'DISTANCE_NO_JUMP', target: 500, reward: 200, desc: 'Run 500m without jumping' },
  { type: 'COLLECT_YARN', target: 20, reward: 150, desc: 'Collect 20 fish in one run' },
  { type: 'JUMP_COUNT', target: 30, reward: 100, desc: 'Jump 30 times in one run' },
  { type: 'DESTROY_OBSTACLES', target: 5, reward: 250, desc: 'Destroy 5 obstacles in one run' },
  { type: 'SURVIVE_TIME', target: 60, reward: 150, desc: 'Survive for 60 seconds in one run' }
];

function generateDailyChallenge(): DailyChallenge {
  const date = new Date().toISOString().split('T')[0];
  const seed = parseInt(date.replace(/-/g, '')) || 0;
  const challengeTemplate = CHALLENGES[seed % CHALLENGES.length];
  
  return {
    date,
    type: challengeTemplate.type as any,
    target: challengeTemplate.target,
    progress: 0,
    completed: false,
    reward: challengeTemplate.reward,
    desc: challengeTemplate.desc
  };
}

const DEFAULT_DATA: PlayerData = {
  yarns: 1000,
  ownedColors: ['default'],
  ownedAccessories: ['none'],
  currentColor: 'default',
  currentAccessory: 'none',
  activeGear: 'NONE',
  dailyChallenge: generateDailyChallenge(),
  highScores: [],
  stats: { totalDistance: 0, totalYarns: 0, totalObstacles: 0, catFriendship: {} }
};

// Read the save once, synchronously, before anything can write over it
function loadPlayerData(): PlayerData {
  try {
    const saved = localStorage.getItem('midnight_paws_data');
    if (!saved) return DEFAULT_DATA;
    const parsed = JSON.parse(saved);
    // Migration from old colors to new cats. Validate against the real cat list
    // (the old hard-coded list missed 'mafia'/'super' and wiped owned cats on load).
    const validCats = STORE_ITEMS.colors.map(c => c.id);
    if (Array.isArray(parsed.ownedColors)) {
      parsed.ownedColors = parsed.ownedColors.filter((c: string) => validCats.includes(c));
      if (!parsed.ownedColors.includes('default')) parsed.ownedColors.unshift('default');
    }
    if (parsed.currentColor && !validCats.includes(parsed.currentColor)) {
      parsed.currentColor = 'default';
    }
    // Building Tops (stage 2) was added between City and Stadium: anyone who
    // already beat the Mafia boss gets it unlocked.
    if (parsed.stats?.bossDefeated) {
      const maps: string[] = parsed.unlockedMaps || ['City'];
      if (!maps.includes('Rooftop')) maps.push('Rooftop');
      parsed.unlockedMaps = maps;
    }
    // Handle daily challenge reset
    const today = new Date().toISOString().split('T')[0];
    if (!parsed.dailyChallenge || parsed.dailyChallenge.date !== today) {
      parsed.dailyChallenge = generateDailyChallenge();
    }
    return { ...DEFAULT_DATA, ...parsed };
  } catch (e) {
    console.error('Failed to parse save data');
    return DEFAULT_DATA;
  }
}

export default function App() {
  // Boss replay is requested via ?boss=... (from Boss Archives / Gallery). It applies to
  // that replay only: the URL is cleaned right away and the replay is cleared on
  // returning to the menu, so later normal runs use the selected map.
  const [bossReplay, setBossReplay] = useState<'mafia' | 'ninja' | 'athlete' | null>(() => {
    const b = new URLSearchParams(window.location.search).get('boss');
    return b === 'mafia' || b === 'ninja' || b === 'athlete' ? b : null;
  });
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const [gameState, setGameState] = useState<GameState>(bossReplay ? 'PLAYING' : 'MENU');
  const [playerData, setPlayerData] = useState<PlayerData>(loadPlayerData);
  const [lastScore, setLastScore] = useState(0);
  const [lastRun, setLastRun] = useState({ fish: 0, best: 0, isNewBest: false, challengeReward: 0 });
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Android back button: pause during a run, close screens/modals elsewhere, exit from the room
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', () => {
      const gs = gameStateRef.current;
      if (gs === 'PLAYING') window.dispatchEvent(new Event('mp-toggle-pause'));
      else if (gs === 'MENU') window.dispatchEvent(new Event('mp-menu-back'));
      else { setBossReplay(null); setGameState('MENU'); }
    });
    return () => { sub.then(h => h.remove()); };
  }, []);

  // Going to the background: silence audio and pause the run; resuming waits for the player
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        audio.suspend();
        window.dispatchEvent(new Event('mp-pause'));
      } else if (gameStateRef.current !== 'PLAYING') {
        // During a run the game stays paused (and quiet) until the player taps Resume
        audio.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);


  // Dev-only shortcut: typing 'tri' unlocks everything (stripped from release builds)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 5) keyBuffer = keyBuffer.slice(-5);
      
      if (keyBuffer.includes('tri')) {
        setPlayerData(prev => ({
          ...prev,
          yarns: 999999,
          ownedColors: STORE_ITEMS.colors.map(c => c.id),
          ownedAccessories: STORE_ITEMS.accessories.map(a => a.id),
          unlockedRooms: ['Bedroom', 'Livingroom', 'Bathroom', 'Balcony', 'Kitchen'],
          unlockedMaps: ['City', 'Rooftop', 'Stadium'],
          stats: {
            ...prev.stats,
            bossDefeated: true,
            rooftopBossDefeated: true,
            stadiumBossDefeated: true,
            totalDistance: prev.stats?.totalDistance || 0,
            totalYarns: prev.stats?.totalYarns || 0,
            totalObstacles: prev.stats?.totalObstacles || 0,
            cannonUnlocked: true
          }
        }));
        keyBuffer = '';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem('midnight_paws_data', JSON.stringify(playerData));
  }, [playerData]);

  const handleGameOver = (score: number, collectedYarns: number, jumps: number, destroyed: number, frames: number) => {
    setLastScore(score);
    const prevBest = Math.max(0, ...(playerData.highScores || []).map(h => h.score));
    setLastRun({ fish: collectedYarns, best: prevBest, isNewBest: score > prevBest && score > 0, challengeReward: 0 });
    
    // Evaluate Challenge
    let newChallenge = playerData.dailyChallenge ? { ...playerData.dailyChallenge } : generateDailyChallenge();
    let challengeCompletedNow = false;
    
    if (!newChallenge.completed) {
      if (newChallenge.type === 'DISTANCE_NO_JUMP') {
        if (jumps === 0 && score >= newChallenge.target) {
          newChallenge.progress = newChallenge.target;
          newChallenge.completed = true;
          challengeCompletedNow = true;
        } else if (jumps === 0) {
          newChallenge.progress = Math.max(newChallenge.progress, score);
        }
      } else if (newChallenge.type === 'COLLECT_YARN') {
        if (collectedYarns >= newChallenge.target) {
          newChallenge.progress = newChallenge.target;
          newChallenge.completed = true;
          challengeCompletedNow = true;
        } else {
          newChallenge.progress = Math.max(newChallenge.progress, collectedYarns);
        }
      } else if (newChallenge.type === 'JUMP_COUNT') {
        if (jumps >= newChallenge.target) {
          newChallenge.progress = newChallenge.target;
          newChallenge.completed = true;
          challengeCompletedNow = true;
        } else {
          newChallenge.progress = Math.max(newChallenge.progress, jumps);
        }
      } else if (newChallenge.type === 'DESTROY_OBSTACLES') {
        if (destroyed >= newChallenge.target) {
          newChallenge.progress = newChallenge.target;
          newChallenge.completed = true;
          challengeCompletedNow = true;
        } else {
          newChallenge.progress = Math.max(newChallenge.progress, destroyed);
        }
      } else if (newChallenge.type === 'SURVIVE_TIME') {
        const seconds = Math.floor(frames / 60);
        if (seconds >= newChallenge.target) {
          newChallenge.progress = newChallenge.target;
          newChallenge.completed = true;
          challengeCompletedNow = true;
        } else {
          newChallenge.progress = Math.max(newChallenge.progress, seconds);
        }
      }
    }
    
    const reward = challengeCompletedNow ? newChallenge.reward : 0;
    if (reward) setLastRun(prev => ({ ...prev, challengeReward: reward }));

    setPlayerData(prev => {
      const currentStats = prev.stats || { totalDistance: 0, totalYarns: 0, totalObstacles: 0 };
      const newStats = {
        totalDistance: currentStats.totalDistance + Math.floor(score),
        totalYarns: currentStats.totalYarns + collectedYarns,
        totalObstacles: currentStats.totalObstacles + destroyed,
        catFriendship: {
          ...(currentStats.catFriendship || {}),
          [prev.currentColor]: (currentStats.catFriendship?.[prev.currentColor] || 0) + 10 + Math.floor(score / 100)
        }
      };
      const newHighScores = [...(prev.highScores || [])];
      newHighScores.push({ name: 'YOU', score: score, date: new Date().toISOString().split('T')[0] });
      newHighScores.sort((a, b) => b.score - a.score);
      newHighScores.splice(5);

      return { 
        ...prev, 
        yarns: prev.yarns + collectedYarns + reward,
        activeGear: 'NONE', // Consume gear after run
        dailyChallenge: newChallenge,
        highScores: newHighScores,
        // Persist lifetime stats (previously computed but never saved, so achievements never progressed)
        stats: { ...currentStats, ...newStats }
      };
    });
    setGameState('GAMEOVER');
  };

  return (
    <div className="w-full h-[100dvh] bg-slate-950 flex flex-col items-center justify-center font-mono overflow-hidden safe-area-top safe-area-bottom">
      <div className="relative w-full max-w-[800px] h-full flex flex-col bg-slate-950 items-center justify-center overflow-hidden">
        {gameState === 'MENU' && (
          <CatRoom 
            onPlay={() => setGameState('PLAYING')} 
            onStore={() => setGameState('STORE')} 
            onGallery={() => setGameState('GALLERY')}
            onLeaderboard={() => setGameState('LEADERBOARD')}
            onAchievements={() => setGameState('ACHIEVEMENTS')}
            playerData={playerData}
            setPlayerData={setPlayerData}
          />
        )}
        
        {gameState === 'GALLERY' && (
          <CatGallery
            onBack={() => setGameState('MENU')}
            playerData={playerData}
          />
        )}
        
        {gameState === 'ACHIEVEMENTS' && (
          <Achievements
            onBack={() => setGameState('MENU')}
            playerData={playerData}
          />
        )}

        {gameState === 'STORE' && (
          <Store 
            onBack={() => setGameState('MENU')} 
            playerData={playerData}
            setPlayerData={setPlayerData}
          />
        )}

        {gameState === 'PLAYING' && (
          <GameCanvas 
            playerData={playerData}
            onGameOver={handleGameOver}
            setPlayerData={setPlayerData}
            startBoss={bossReplay}
          />
        )}

        {gameState === 'GAMEOVER' && (
          <GameOver 
            score={lastScore}
            fish={lastRun.fish}
            best={lastRun.best}
            isNewBest={lastRun.isNewBest}
            challengeReward={lastRun.challengeReward}
            playerData={playerData}
            onMenu={() => { setBossReplay(null); setGameState('MENU'); }}
            onRestart={() => setGameState('PLAYING')}
          />
        )}
      </div>
    </div>
  );
}
