import { useRef, useEffect, useState, Dispatch, SetStateAction } from 'react';
import { PlayerData, STORE_ITEMS } from '../types';
import { audio } from '../utils/audio';
import { Zap, Sword, Wand2, Ghost, Shield, Feather, Fish, Pause, Play, LogOut } from 'lucide-react';
import UnderDevelopment from './UnderDevelopment';

interface Props {
  startBoss?: 'mafia' | 'ninja' | 'athlete' | null;
  playerData: PlayerData;
  setPlayerData: Dispatch<SetStateAction<PlayerData>>;
  onGameOver: (score: number, yarns: number, jumps: number, destroyed: number, frames: number) => void;
}

const WIDTH = 800;
const HEIGHT = 800;
const GROUND_Y = 600;
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const BASE_SPEED = 6;
const MAX_SPEED = 12;
// Bat Wings gear: seconds of flight at the start of the run
const GEAR_WINGS_FRAMES = 20 * 60;
// Javelin obstacle flight (Stadium): falls from the sky and sticks in the track
const JAVELIN_VY0 = 5;
const JAVELIN_GRAVITY = 0.35;
const JAVELIN_DRIFT = 2;
const DEATH_ANIM_FRAMES = 80;
// Night City: how far the street extends above the running line (cat runs mid-street)
const CITY_LIFT = 150;
// Building Tops: how far below our roofline the Night City backdrop sits
const ROOFTOP_CITY_DROP = 140;
// City -> Building Tops fire-escape stairs, and fade length for area changes
const STAIR_STEPS = 12;
const STAIR_W = 30;
const STAIR_H = 25;
const TRANSITION_FADE_FRAMES = 40;
// Ninja ambushers stay harmless (flashing) this long before attacking
const NINJA_TELEGRAPH_FRAMES = 40;
// Boss tutorial: how long the 'how to beat' card shows, and when the starter power-up is sent in
const BOSS_TUTORIAL_FRAMES = 200;
const BOSS_STARTER_SPAWN_FRAME = 40;
// First-encounter callouts: earliest a tap can dismiss one, and when it closes by itself
const CALLOUT_MIN_FRAMES = 30;
const CALLOUT_MAX_FRAMES = 150;
// Breathing room around tips: calm (no spawns) after one closes, and minimum gap before the next new thing
const CALLOUT_CALM_FRAMES = 150;
const CALLOUT_SPACING_FRAMES = 480;
// Athlete boss: volley kick flight, and the hurdler sprint rhythm
const VOLLEY_FLIGHT_FRAMES = 55;
const VOLLEY_GRAVITY = 0.45;
const SPRINT_SPEED = 10;
const SPRINT_STRIDE = 30;       // frames per leap + run cycle (~300px)
const SPRINT_LEAP = 20;         // frames of each cycle spent in the air
const SPRINT_LEAP_HEIGHT = 95;  // high enough to clear a cat standing still
// Stadium: how far the track extends above the running line, and lane width
const STADIUM_LIFT = 90;
const LANE_H = 45;

// First boss is the gentler introduction; the Stadium boss is the real test.
const BOSS_HP = { mafia: 80, ninja: 100, athlete: 120 } as const;
// Which boss guards each area, and the area each boss replay takes place in
const AREA_BOSS: Record<string, 'mafia' | 'ninja' | 'athlete'> = { City: 'mafia', Rooftop: 'ninja', Stadium: 'athlete' };
const BOSS_AREA = { mafia: 'City', ninja: 'Rooftop', athlete: 'Stadium' } as const;
// Distance into an area (City from 0, Stadium from where you entered it) before its boss appears
const BOSS_DISTANCE = 10000;
// How long pickups last when grabbed during a boss fight (normal runs use longer timers)
const BOSS_FIGHT_INVINCIBLE_FRAMES = 300;
const BOSS_FIGHT_CANNON_FRAMES = 300;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'circle' | 'sparkle' | 'confetti';
}

interface Entity {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'OBSTACLE_CAR' | 'OBSTACLE_BIRD' | 'OBSTACLE_BOX' | 'OBSTACLE_TRASH' | 'OBSTACLE_HYDRANT' | 'OBSTACLE_SIGN' | 'OBSTACLE_BICYCLE' | 'OBSTACLE_CONSTRUCTION' | 'OBSTACLE_RUNNER' | 'OBSTACLE_AIRPLANE' | 'OBSTACLE_BAT' | 'OBSTACLE_HURDLE' | 'OBSTACLE_FOOTBALL' | 'OBSTACLE_DUMBBELL' | 'OBSTACLE_TENNIS_BALL' | 'OBSTACLE_WATER_BOTTLE' | 'FISH' | 'GOLDEN_FISH' | 'POWERUP_SHIELD' | 'POWERUP_WINGS' | 'POWERUP_TIME' | 'POWERUP_CANNON' | 'CANNON_FISH' | 'SHURIKEN' | 'FIREBALL' | 'BOSS_BULLET' | 'BOSS_MINION' | 'OBSTACLE_SOCCER_BALL' | 'OBSTACLE_SPOTLIGHT' | 'OBSTACLE_STAR' | 'BOSS_ZIGZAG_BALL' | 'BOSS_FOOTBALL_PICKUP' | 'PLAYER_FOOTBALL' | 'OBSTACLE_CONES' | 'OBSTACLE_JAVELIN' | 'OBSTACLE_MASCOT' | 'OBSTACLE_BASKETBALL' | 'OBSTACLE_GAP' | 'OBSTACLE_AC_UNIT' | 'OBSTACLE_VENT' | 'OBSTACLE_DISH' | 'NINJA_AMBUSH' | 'BOSS_SHURIKEN' | 'BOSS_VOLLEY_BALL';
  markedForDeletion: boolean;
  crashed?: boolean;
  color?: string;
  speedMultiplier?: number;
  isDestroyed?: boolean;
  vx?: number;
  vy?: number;
  rotation?: number;
  rotSpeed?: number;
  speed?: number;
  catType?: string;
  spawnX?: number;
  spawnY?: number;
  targetY?: number;
  targetX?: number;
  landed?: boolean;
  // Boss bullet/henchman knocked back toward the boss; damages it only if it connects
  deflected?: boolean;
  bounces?: number;
  // Ninja ambusher state (Building Tops)
  phase?: 'APPEAR' | 'ATTACK';
  timer?: number;
  variant?: 'DASH' | 'THROW' | 'DROP';
  isClone?: boolean;
  // Starter power-up handed out during a boss tutorial (drawn with an "EAT ME!" marker)
  tutorial?: boolean;
}

export default function GameCanvas({ playerData, setPlayerData, onGameOver, startBoss }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [paused, setPausedUI] = useState(false);
  const [showStage4, setShowStage4] = useState(false);

  // Pause/resume the run (world freezes, sound goes quiet). Ignored once the cat is down.
  const setGamePaused = (p: boolean) => {
    const s = state.current;
    if (s.isGameOver || s.cat.dead) p = false;
    if (s.paused === p) return;
    s.paused = p;
    s.input.jump = false;
    s.input.prevJump = true; // the tap that resumes shouldn't also jump
    setPausedUI(p);
    if (p) audio.suspend(); else audio.resume();
  };
  // End the run early (from the pause menu or the end-of-content prompt): results screen as usual
  const finishRun = () => {
    const s = state.current;
    setShowStage4(false);
    setPausedUI(false);
    s.paused = false;
    audio.resume();
    s.isGameOver = true;
  };
  // Leaving the run for any reason stops the boss theme
  useEffect(() => () => audio.stopBossMusic(), []);
  const scoreRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const yarnsRef = useRef<HTMLDivElement>(null);
  const abilityHintRef = useRef<HTMLDivElement>(null);
  const boostContainerRef = useRef<HTMLDivElement>(null);
  const boostRef = useRef<HTMLDivElement>(null);
  const wingsContainerRef = useRef<HTMLDivElement>(null);
  const wingsRef = useRef<HTMLDivElement>(null);
  const abilityContainerRef = useRef<HTMLDivElement>(null);
  const abilityRef = useRef<HTMLDivElement>(null);
  const abilityBtnRef = useRef<HTMLButtonElement>(null);
  const abilityBtnTextRef = useRef<HTMLSpanElement>(null);
  const requestRef = useRef<number>();
  
  // Game State Refs (to avoid re-renders during loop)
  const state = useRef({
    frames: 0,
    score: 0,
    speed: BASE_SPEED,
    yarnsCollected: 0,
    isGameOver: false,
    combo: 0,
    comboTimer: 0,
    map: (startBoss ? BOSS_AREA[startBoss] : (playerData.currentMap || 'City')) as string,
    mapTransitionTimer: 0,
    stadiumZone: undefined as number | undefined,
    // First-encounter callouts: which things the player has already been shown, and the active one
    seenIntros: new Set<string>(playerData.seenIntros || []),
    // Breathing room: no regular spawns until this frame (after a tip, and at the start of a run)
    calmUntil: CALLOUT_CALM_FRAMES,
    lastIntroFrame: -100000,
    // Player pause (pause button, Android back, app sent to background) or the end-of-content prompt
    paused: false,
    callout: null as null | { key: string; title: string; sub: string; t: number; ent: Entity | null; boss: boolean; tapHeld: boolean },
    // Score at which this run entered the Stadium (0 if the run started there)
    areaEntryScore: 0,
    deflectTipShown: false,
    // Bosses beaten during this run (each boss appears once per run)
    bossesBeaten: { mafia: false, ninja: false, athlete: false },
    // Scripted scene change between areas (stairs up to the rooftops, or a fade)
    transition: null as null | { kind: 'STAIRS' | 'FADE'; target: string; t: number; phase: 'CLIMB' | 'FADE_OUT'; stairX0: number },
    // Frames until the next ninja ambush on the rooftops
    ambushTimer: 240,
    // The game world is always 800x800. On tall screens the canvas grows taller
    // and the extra space is filled with more sky above and more ground below,
    // instead of black letterbox bars. `hud` is how much of the top the HUD covers.
    view: { h: HEIGHT, top: 0, bottom: 0, hud: 0 },
    
    // Player
    cat: {
      x: 100,
      y: GROUND_Y - 40,
      w: 40,
      h: 40,
      vy: 0,
      isGrounded: true,
      hasShield: playerData.activeGear === 'DOG_GUARD',
      isFlyingGear: false,
      goldenBoostTimer: 0,
      wingsTimer: playerData.activeGear === 'WINGS' ? GEAR_WINGS_FRAMES : 0, // Bat Wings gear: a head start of flight
      timeSlowTimer: 0,
      fishCannonTimer: 0,
      catType: playerData.currentColor,
      mana: playerData.currentColor === 'wizard' ? 100 : 0,
      superHealth: playerData.currentColor === 'super' ? 100 : 0,
      abilityTimer: 0,
      abilityCooldown: 0,
      lives: playerData.currentColor === 'strong' ? 2 : 1,
      stunTimer: 0,
      dead: false,
      jumps: 0,
      mafiaMinionTimer: 0,
      deathStarted: false,
      fellInGap: false,
    },
    
    // Input
    input: {
      jump: false,
      prevJump: false,
      ability: false,
    },
    
    // Stats for challenges
    stats: {
      totalJumps: 0,
      obstaclesDestroyed: 0,
    },
    
    entities: [] as Entity[],
    particles: [] as Particle[],
    
    // Parallax background x positions
    boss: {
      type: (startBoss || 'mafia') as 'mafia' | 'ninja' | 'athlete',
      active: false,
      defeated: false,
      hp: 100,
      maxHp: 100,
      x: 1200,
      y: 0,
      // Same size as the player cat: beating a boss unlocks it as a playable cat
      w: 40,
      h: 40,
      state: 'ENTER',
      timer: 0,
      attackPhase: 0,
      hasMinion: false,
      minionRespawnTimer: 0,
      targetY: 0,
      hidden: false, // ninja boss vanishes in smoke between some attacks
      vy: 0,
      landed: false,
      landTime: 0,
      sprintPhase: 0,
      dropTimer: 0,
      dropCount: 0,
    },
    bg: {
      sky: 0,
      cityFar: 0,
      cityNear: 0,
      road: 0,
    },
    
    // Weather
    weather: {
      type: 'NONE' as 'NONE' | 'RAIN' | 'FOG',
      intensity: 0,
      raindrops: Array.from({ length: 100 }, () => ({
        x: Math.random() * 800,
        y: Math.random() * 400,
        speed: 10 + Math.random() * 10,
        len: 10 + Math.random() * 15,
      })),
    }
  });

  // Handle Input
  useEffect(() => {
    if (startBoss) {
      state.current.boss.active = true;
      state.current.boss.type = startBoss;
      state.current.boss.maxHp = BOSS_HP[startBoss];
      state.current.boss.hp = state.current.boss.maxHp;
      state.current.boss.x = 800 + 100; // WIDTH + 100
      state.current.boss.y = GROUND_Y - state.current.boss.h;
      state.current.boss.state = 'ENTER';
      state.current.boss.timer = 0;
      state.current.boss.attackPhase = 0;
      state.current.score = 10000; // ensure boss logic doesn't re-trigger
      
      // Start music early
      setTimeout(() => {
        try {
          audio.init();
          audio.playBossAlert();
          audio.startBossMusic();
        } catch(e) {}
      }, 500);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        state.current.input.jump = true;
        audio.init();
      }
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'ArrowRight') {
        state.current.input.ability = true;
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) setGamePaused(!state.current.paused);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        state.current.input.jump = false;
      }
      if (e.code === 'KeyE' || e.code === 'Enter') {
        state.current.input.ability = false;
      }
    };
    
    let touchStartX = 0;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => { 
      // Taps on on-screen buttons (pause, menus) shouldn't make the cat jump
      if ((e.target as HTMLElement)?.closest?.('button')) return;

      touchStartX = e.touches[0].clientX;

      touchStartY = e.touches[0].clientY;

      state.current.input.jump = true; 

      audio.init();

    };

    const handleTouchMove = (e: TouchEvent) => { 

      if (!touchStartX) return;

      const dx = e.touches[0].clientX - touchStartX;

      const dy = e.touches[0].clientY - touchStartY;

      if (dx > 50 && Math.abs(dy) < 50) {

        state.current.input.ability = true;

        touchStartX = 0;

      }

    };

    const handleTouchEnd = () => { 

      state.current.input.jump = false; 

      state.current.input.ability = false;

      touchStartX = 0;

    };



    // Mouse clicks jump on desktop (touch has its own handlers above)
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if ((e.target as HTMLElement)?.closest?.('button')) return;
      state.current.input.jump = true;
      audio.init();
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      state.current.input.jump = false;
    };
    window.addEventListener('pointerdown', handlePointerDown);
    const onTogglePause = () => setGamePaused(!state.current.paused);
    const onPause = () => setGamePaused(true);
    window.addEventListener('mp-toggle-pause', onTogglePause);
    window.addEventListener('mp-pause', onPause);
    window.addEventListener('pointerup', handlePointerUp);

    window.addEventListener('keydown', handleKeyDown);

    window.addEventListener('keyup', handleKeyUp);

    window.addEventListener('touchstart', handleTouchStart);

    window.addEventListener('touchmove', handleTouchMove);

    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('mp-toggle-pause', onTogglePause);
      window.removeEventListener('mp-pause', onPause);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Fit the canvas to the screen: keep the 800-wide world, extend height to match
  // the device aspect ratio so there are no letterbox bars on phones.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const fit = () => {
      const cw = stage.clientWidth;
      const ch = stage.clientHeight;
      if (!cw || !ch) return;
      const h = Math.min(2400, Math.max(HEIGHT, Math.round(WIDTH * ch / cw)));
      const extra = h - HEIGHT;
      // Canvas CSS pixels -> logical pixels
      const scale = h / ch;
      const hud = (hudRef.current?.offsetHeight || 0) * scale;
      // Put enough of the extra space on top to clear the HUD, split the rest
      const top = Math.min(extra, Math.max(Math.round(extra * 0.5), Math.round(hud - 30)));
      const v = state.current.view;
      v.h = h; v.top = Math.max(0, top); v.bottom = extra - v.top; v.hud = hud;
      if (canvas.height !== h) canvas.height = h;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Main Game Loop
  useEffect(() => {
    // Dev-only handle for debugging/tuning from the console (stripped from production builds)
    if (import.meta.env.DEV) (window as any).__mpState = state.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper drawing functions
    const drawCat = (ctx: CanvasRenderingContext2D, catObj: any, x: number, y: number, w: number, h: number, isGrounded: boolean, facingLeft: boolean = false) => {
      const s = state.current;
      const cat = catObj;
      const colorObj = STORE_ITEMS.colors.find(c => c.id === cat.catType);
      const color = colorObj ? colorObj.color : '#f97316'; // orange default
      
      ctx.save();
      
      if (cat.catType === 'ghost' && cat.abilityTimer > 0) {
        ctx.globalAlpha = 0.5;
      }
      
      const bounce = isGrounded && cat.stunTimer === 0 ? Math.abs(Math.sin(s.frames * 0.3)) * 3 : 0;
      
      ctx.translate(x + w/2, y + h - bounce); // origin at bottom center
      if (facingLeft) ctx.scale(-1, 1);

      // Invincible aura: glowing orange ring behind the cat
      if (cat.goldenBoostTimer > 0) {
        const t = s.frames;
        // Blink during the last 1.5s so the player knows it's about to end
        const ending = cat.goldenBoostTimer < 90 && Math.floor(t / 5) % 2 === 0;
        const pulse = Math.sin(t * 0.25) * 3;
        const R = Math.max(w, h) * 0.85 + pulse;
        const cy = -h / 2;
        ctx.save();
        ctx.globalAlpha = ending ? 0.35 : 1;
        ctx.globalCompositeOperation = 'lighter';
        // Soft outer halo
        const halo = ctx.createRadialGradient(0, cy, R * 0.6, 0, cy, R * 2.1);
        halo.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
        halo.addColorStop(0.45, 'rgba(249, 115, 22, 0.25)');
        halo.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, cy, R * 2.1, 0, Math.PI * 2); ctx.fill();
        // Faint inner fill so the cat reads as "inside" the bubble
        ctx.fillStyle = 'rgba(253, 186, 116, 0.12)';
        ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.fill();
        // Bright ring with heavy glow
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.stroke();
        // Orbiting sparks
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#fde68a';
        for (let i = 0; i < 4; i++) {
          const a = t * 0.12 + (i * Math.PI) / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * R, cy + Math.sin(a) * R, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      if (cat.catType === 'ninja' && !isGrounded && cat.vy <= 0 && cat.jumps >= 2) {
         ctx.translate(0, -h/2);
         ctx.rotate(s.frames * 0.5);
         ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
         ctx.beginPath();
         ctx.arc(0, 0, Math.max(w, h), 0, Math.PI*2);
         ctx.fill();
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.lineWidth = 4;
         ctx.beginPath();
         ctx.arc(0, 0, Math.max(w, h) + 4, 0, Math.PI);
         ctx.stroke();
         ctx.translate(0, h/2);
      }

      
      if (cat.stunTimer > 0) {
        ctx.rotate(cat.dead ? (isGrounded ? Math.PI / 2 : Math.min(Math.PI / 2, (DEATH_ANIM_FRAMES - cat.stunTimer) * 0.12)) : Math.sin(s.frames * 0.5) * 0.2); // lie down if dead, wobble if stunned
        
        // dizzy stars
        if (!cat.dead) {
          for(let i=0; i<3; i++) {
             const angle = s.frames * 0.1 + (i * Math.PI * 2 / 3);
             const sx = Math.cos(angle) * 15;
             const sy = -h - 10 + Math.sin(angle) * 5;
             ctx.fillStyle = '#fbbf24';
             ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill();
          }
        }
      }
      if (cat.catType === 'strong') {
        ctx.scale(1.2, 1.2);
      }
      

      if (cat.catType === 'mafia') {
         const hX = w/4;
         const hY = -h + 10;
         
         // Fedora
         ctx.fillStyle = '#0f172a';
         ctx.beginPath(); ctx.ellipse(hX + 5, hY - 15, w/2 + 5, 4, 0, 0, Math.PI*2); ctx.fill(); // brim
         ctx.fillRect(hX + 5 - w/2 + 5, hY - 35, w - 10, 20); // crown
         ctx.fillStyle = '#facc15'; // hat band
         ctx.fillRect(hX + 5 - w/2 + 5, hY - 19, w - 10, 4);

         // Sunglasses
         ctx.fillStyle = '#020617';
         ctx.fillRect(hX + 5, hY - 5, 12, 6);
         ctx.fillRect(hX + 18, hY - 5, 12, 6);

         // Cigar
         ctx.fillStyle = '#78350f';
         ctx.fillRect(hX + 15, hY + 5, 12, 3);
         ctx.fillStyle = '#ef4444';
         ctx.fillRect(hX + 27, hY + 5, 2, 3);
         
         // Smoke
         ctx.fillStyle = 'rgba(255,255,255,0.4)';
         ctx.beginPath(); ctx.arc(hX + 30 + Math.sin(s.frames * 0.1)*2, hY, 2, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(hX + 32 + Math.cos(s.frames * 0.1)*3, hY - 4, 3, 0, Math.PI*2); ctx.fill();
      }
      
      // If it's a minion, give them sunglasses too to make them "more mafia"
      if (cat.isMinion) {
         const hX = w/4;
         const hY = -h + 10;
         ctx.fillStyle = '#020617';
         ctx.fillRect(hX + 5, hY - 5, 12, 6);
         ctx.fillRect(hX + 18, hY - 5, 12, 6);
         ctx.strokeStyle = '#020617'; ctx.lineWidth = 1;
         ctx.beginPath(); ctx.moveTo(hX + 17, hY - 2); ctx.lineTo(hX + 18, hY - 2); ctx.stroke();
      }


      if (cat.catType === 'wizard') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-w/2, -h - 20, w, 4);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-w/2, -h - 20, w * (Math.max(0, cat.mana || 0) / 100), 4);
      }
      if (cat.catType === 'super' && cat.superHealth > 0) {
        ctx.scale(1.3, 1.3);
      }
      
      // Magic aura behind
      if (cat.catType === "ninja" && cat.abilityTimer > 0) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
        ctx.beginPath(); ctx.arc(0, -h/2, w * 1.2, 0, Math.PI * 2); ctx.fill();
        if (cat.abilityTimer > 105) {
          // Sword slash effect
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-w, -h); ctx.lineTo(w*3, -h/4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-w, -h/4); ctx.lineTo(w*3, -h); ctx.stroke();
        }
      }
      if (cat.catType === "wizard" && cat.abilityTimer > 0) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 20 + Math.sin(s.frames * 0.5) * 10;
        ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(1200, -h/2); ctx.stroke();
        ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(1200, -h/2); ctx.stroke();
      }
      
      // Tail
      if (cat.catType !== 'ghost') {
        const tailAngle = isGrounded ? Math.sin(s.frames * 0.2) * 15 - 10 : -30;
        
        const drawTail = (angleOffset) => {
          ctx.save();
          ctx.translate(-w/2 + 5, -8);
          ctx.rotate((tailAngle + angleOffset) * Math.PI / 180);
          ctx.fillStyle = color;
          ctx.beginPath();
          // cute curvy tail
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-20, -10, -15, -20);
          ctx.quadraticCurveTo(-10, -25, -5, -20);
          ctx.quadraticCurveTo(-10, -5, 5, 0);
          ctx.fill();
          ctx.restore();
        };

        drawTail(0);
        if (cat.catType === 'strong' && cat.lives > 1) {
          drawTail(20);
        }
      }
      
      // Legs (Paws)
      if (cat.catType !== 'ghost') {
        ctx.fillStyle = color;
        if (isGrounded) {
          const legOffset1 = Math.sin(s.frames * 0.6) * 3;
          const legOffset2 = Math.cos(s.frames * 0.6) * 3;
          // Back leg
          ctx.beginPath(); ctx.roundRect(-w/2 + 8, -6, 8, 6 + legOffset1, 4); ctx.fill();
          // Front leg
          ctx.beginPath(); ctx.roundRect(w/2 - 16, -6, 8, 6 + legOffset2, 4); ctx.fill();
        } else {
          // Jumping paws
          ctx.beginPath(); ctx.roundRect(-w/2 + 5, -10, 8, 8, 4); ctx.fill();
          ctx.beginPath(); ctx.roundRect(w/2 - 12, -6, 10, 6, 4); ctx.fill();
        }
        if (cat.catType === 'athlete') {
          ctx.fillStyle = '#ef4444'; // red sneakers
          if (isGrounded) {
            const legOffset1 = Math.sin(s.frames * 0.6) * 3;
            const legOffset2 = Math.cos(s.frames * 0.6) * 3;
            ctx.beginPath(); ctx.roundRect(-w/2 + 6, -3 + legOffset1, 12, 5, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(w/2 - 18, -3 + legOffset2, 12, 5, 3); ctx.fill();
          } else {
            ctx.beginPath(); ctx.roundRect(-w/2 + 3, -4, 12, 5, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(w/2 - 14, 0, 12, 5, 3); ctx.fill();
          }
        }
      }
    
      // Body
      ctx.fillStyle = color;
      if (cat.catType === 'ghost') {
        ctx.beginPath();
        ctx.moveTo(-w/2, -h + 10);
        ctx.lineTo(w/2, -h + 10);
        ctx.lineTo(w/2, 0);
        for(let i=0; i<3; i++) {
           ctx.quadraticCurveTo(w/2 - (i+0.5)*(w/3), 5, w/2 - (i+1)*(w/3), 0);
        }
        ctx.lineTo(-w/2, -h + 10);
        ctx.fill();
      
      } else {
        ctx.beginPath();
        // chubby rounded body
        ctx.ellipse(0, -h/2 + 5, w/2, h/2 - 5, 0, 0, Math.PI*2);
        ctx.fill();
        
        if (cat.catType === 'super' && cat.superHealth > 0) {
           // Draw muscular arms
           ctx.fillStyle = color;
           ctx.strokeStyle = '#22c55e';
           ctx.lineWidth = 2;
           // Left arm (bicep)
           ctx.beginPath();
           ctx.ellipse(-w/2 - 2, -h/2 + 2, 14, 12, -0.2, 0, Math.PI*2);
           ctx.fill(); ctx.stroke();
           // Right arm (bicep)
           ctx.beginPath();
           ctx.ellipse(w/2 + 2, -h/2 + 2, 14, 12, 0.2, 0, Math.PI*2);
           ctx.fill(); ctx.stroke();
           
           // Abs (6-pack)
           ctx.lineWidth = 1.5;
           ctx.beginPath();
           ctx.moveTo(-6, -h/2); ctx.lineTo(-6, -h/2 + 12);
           ctx.moveTo(6, -h/2); ctx.lineTo(6, -h/2 + 12);
           ctx.moveTo(-10, -h/2 + 4); ctx.lineTo(10, -h/2 + 4);
           ctx.moveTo(-10, -h/2 + 8); ctx.lineTo(10, -h/2 + 8);
           ctx.moveTo(0, -h/2 - 2); ctx.lineTo(0, -h/2 + 12); // Center line
           ctx.stroke();
        }
      }
      
      

      ctx.fillStyle = color;
      if (cat.catType === 'mafia') {
         ctx.fillStyle = '#1e293b'; 
         ctx.beginPath(); ctx.ellipse(0, -h/2 + 5, w/2 + 2, h/3, 0, 0, Math.PI*2); ctx.fill(); // suit body
         
         // Pinstripes
         ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
         for(let i = -w/2 + 4; i < w/2; i += 4) {
             ctx.beginPath(); ctx.moveTo(i, -h + 15); ctx.lineTo(i, -10); ctx.stroke();
         }

         ctx.fillStyle = '#f8fafc'; // shirt
         ctx.beginPath(); ctx.moveTo(-8, -h + 10); ctx.lineTo(8, -h + 10); ctx.lineTo(0, -h/2); ctx.fill();
         ctx.fillStyle = '#ef4444'; // tie
         ctx.beginPath(); ctx.moveTo(-3, -h + 10); ctx.lineTo(3, -h + 10); ctx.lineTo(0, -h/2 + 2); ctx.fill();
      }


      // Patterns (Body)
      if (cat.catType === 'calico') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(-w/4, -h/2 + 5, 8, 12, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.ellipse(w/4, -h/2 + 8, 10, 8, -0.2, 0, Math.PI*2); ctx.fill();
      } else if (cat.catType === 'tabby') {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-w/4, -h + 15); ctx.lineTo(-w/4 - 2, -h + 25);
        ctx.moveTo(0, -h + 12); ctx.lineTo(0, -h + 28);
        ctx.moveTo(w/4, -h + 15); ctx.lineTo(w/4 + 2, -h + 25);
        ctx.stroke();
      } else if (cat.catType === 'wizard') {
        ctx.fillStyle = '#6b21a8';
        ctx.beginPath(); ctx.ellipse(0, -h/2 + 5, w/2 + 2, h/2 - 3, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.arc(0, -h/2 + 5, 4, 0, Math.PI*2); ctx.fill();
      }
      
      // Head
      ctx.fillStyle = color;
      ctx.beginPath();
      // cute big round head
      ctx.ellipse(w/4, -h + 10, 20, 18, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Patterns (Head)
      if (cat.catType === 'calico') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.ellipse(w/4 + 5, -h + 15, 12, 10, 0, 0, Math.PI*2); ctx.fill();
      }
      
      // Ears
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(w/4 - 15, -h + 2); ctx.quadraticCurveTo(w/4 - 20, -h - 10, w/4 - 8, -h - 5); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w/4 + 5, -h - 5); ctx.quadraticCurveTo(w/4 + 15, -h - 10, w/4 + 12, -h + 2); ctx.fill();
      
      // Inner Ears
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.moveTo(w/4 - 12, -h + 1); ctx.quadraticCurveTo(w/4 - 15, -h - 6, w/4 - 8, -h - 3); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w/4 + 4, -h - 3); ctx.quadraticCurveTo(w/4 + 10, -h - 6, w/4 + 9, -h + 1); ctx.fill();
      
      // Eyes (Cute Anime Style)
      const eyeColor = (cat.catType === 'ghost' || cat.catType === 'ninja') ? '#fff' : '#0f172a';
      ctx.fillStyle = eyeColor;
      
      if (cat.catType === 'ninja') {
         // Angry ninja eyes
         ctx.beginPath(); ctx.ellipse(w/4 + 2, -h + 8, 4, 3, -0.3, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.ellipse(w/4 + 14, -h + 8, 4, 3, 0.3, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#ef4444'; // Red pupils
         ctx.beginPath(); ctx.arc(w/4 + 2, -h + 8, 1.5, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(w/4 + 14, -h + 8, 1.5, 0, Math.PI*2); ctx.fill();
         // Headband
         ctx.fillStyle = '#ef4444';
         ctx.beginPath(); ctx.roundRect(w/4 - 18, -h - 2, 36, 6, 3); ctx.fill();
         ctx.beginPath(); ctx.moveTo(w/4 - 15, -h + 1); ctx.lineTo(w/4 - 30, -h + 5); ctx.lineTo(w/4 - 25, -h - 5); ctx.fill();
      } else {
         // Cute round eyes
         ctx.beginPath(); ctx.arc(w/4 + 4, -h + 10, 3.5, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(w/4 + 14, -h + 10, 3.5, 0, Math.PI*2); ctx.fill();
         // Eye Highlights
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.arc(w/4 + 3, -h + 9, 1.2, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(w/4 + 13, -h + 9, 1.2, 0, Math.PI*2); ctx.fill();
      }

      if (cat.catType === 'athlete') {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.roundRect(w/4 - 18, -h, 36, 6, 3); ctx.fill();
      }
      
      // Nose and Mouth
      ctx.fillStyle = '#f472b6'; // pink nose
      ctx.beginPath(); ctx.arc(w/4 + 9, -h + 14, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w/4 + 9, -h + 15.5); ctx.quadraticCurveTo(w/4 + 6, -h + 18, w/4 + 4, -h + 16); ctx.stroke();

      // --- ACCESSORIES ---
      const headX = w/4;
      const headY = -h + 10;
      // Only draw accessory if it's the main cat or player data is passed properly
      // For inline drawCat, playerData is available from scope!
      
  if (playerData.currentAccessory === 'red_collar') {
    ctx.fillStyle = '#ef4444'; 
    ctx.beginPath(); ctx.roundRect(headX - 12, headY + 14, 24, 4, 2); ctx.fill();
    ctx.fillStyle = '#fbbf24'; 
    ctx.beginPath(); ctx.arc(headX, headY + 18, 3, 0, Math.PI*2); ctx.fill();
  } else if (playerData.currentAccessory === 'sunglasses') {
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(headX + 1, headY - 2, 8, 6, 2); ctx.fill(); 
    ctx.beginPath(); ctx.roundRect(headX + 10, headY - 2, 8, 6, 2); ctx.fill();
    ctx.fillRect(headX - 8, headY - 1, 10, 2); 
    ctx.fillRect(headX + 18, headY - 1, 6, 2); 
  } else if (playerData.currentAccessory === 'top_hat') {
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(headX - 15, headY - 15, 30, 4, 2); ctx.fill();
    ctx.fillRect(headX - 10, headY - 35, 20, 20);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(headX - 10, headY - 20, 20, 5);
  } else if (playerData.currentAccessory === 'crown') {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.moveTo(headX - 12, headY - 10);
    ctx.lineTo(headX - 15, headY - 25);
    ctx.lineTo(headX - 5, headY - 15);
    ctx.lineTo(headX, headY - 28);
    ctx.lineTo(headX + 5, headY - 15);
    ctx.lineTo(headX + 15, headY - 25);
    ctx.lineTo(headX + 12, headY - 10);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(headX, headY - 15, 2, 0, Math.PI*2); ctx.fill();
  } else if (playerData.currentAccessory === 'scarf') {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.roundRect(headX - 14, headY + 12, 28, 8, 3); ctx.fill();
    ctx.fillRect(headX - 10, headY + 16, 8, 15);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(headX - 8, headY + 28, 4, 4); // fringe
  } else if (playerData.currentAccessory === 'bowtie') {
    ctx.fillStyle = '#e11d48';
    ctx.beginPath(); ctx.moveTo(headX, headY + 16);
    ctx.lineTo(headX - 8, headY + 12);
    ctx.lineTo(headX - 8, headY + 20);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(headX, headY + 16);
    ctx.lineTo(headX + 8, headY + 12);
    ctx.lineTo(headX + 8, headY + 20);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(headX, headY + 16, 2, 0, Math.PI*2); ctx.fill();
  } else if (playerData.currentAccessory === 'headphones') {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(headX, headY, 14, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.roundRect(headX - 18, headY - 5, 6, 12, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(headX + 12, headY - 5, 6, 12, 2); ctx.fill();
  }

      ctx.beginPath(); ctx.moveTo(w/4 + 9, -h + 15.5); ctx.quadraticCurveTo(w/4 + 12, -h + 18, w/4 + 14, -h + 16); ctx.stroke();
      
      // Whiskers
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.moveTo(w/4 - 2, -h + 12); ctx.lineTo(w/4 - 10, -h + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/4 - 2, -h + 15); ctx.lineTo(w/4 - 10, -h + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/4 + 20, -h + 12); ctx.lineTo(w/4 + 28, -h + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/4 + 20, -h + 15); ctx.lineTo(w/4 + 28, -h + 16); ctx.stroke();
      
      // Accessories
      if (cat.catType === 'ninja' && !isGrounded && cat.vy <= 0 && cat.jumps >= 2) {
        ctx.save();
        ctx.translate(w/2, -h/2);
        ctx.rotate(Math.PI/4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-2, -30, 4, 30); // blade
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-6, 0, 12, 4); // guard
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-2, 4, 4, 10); // handle
        ctx.restore();
      }

      if (cat.catType === 'wizard') {
        ctx.fillStyle = '#6b21a8';
        ctx.beginPath(); ctx.moveTo(w/4 - 25, -h - 2); ctx.lineTo(w/4 + 25, -h - 2); ctx.lineTo(w/4, -h - 30); ctx.fill();
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(w/4 - 22, -h - 2); ctx.lineTo(w/4 + 22, -h - 2); ctx.stroke();
      }
      
      if (playerData.currentAccessory === 'red_collar') {
        ctx.fillStyle = '#ef4444'; 
        ctx.beginPath(); ctx.roundRect(w/4 - 12, -h + 24, 24, 4, 2); ctx.fill();
        ctx.fillStyle = '#fbbf24'; // bell
        ctx.beginPath(); ctx.arc(w/4, -h + 28, 3, 0, Math.PI*2); ctx.fill();
      } else if (playerData.currentAccessory === 'sunglasses') {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.roundRect(w/4 + 1, -h + 8, 8, 6, 2); ctx.fill(); // left lens
        ctx.beginPath(); ctx.roundRect(w/4 + 10, -h + 8, 8, 6, 2); ctx.fill(); // right lens
        ctx.fillRect(w/4 - 8, -h + 9, 10, 2); // left arm
        ctx.fillRect(w/4 + 18, -h + 9, 6, 2); // right arm
      } else if (playerData.currentAccessory === 'top_hat') {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.roundRect(w/4 - 15, -h - 5, 30, 4, 2); ctx.fill();
        ctx.fillRect(w/4 - 10, -h - 25, 20, 20);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w/4 - 10, -h - 10, 20, 5);
      }
      
      if (cat.hasShield && cat.catType !== 'mafia') {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -h/2, w + 10, 0, Math.PI*2); ctx.stroke();
  }
      if (cat.isFlyingGear || cat.wingsTimer > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.lineWidth = 1;
        const flap = Math.sin(s.frames * 0.4) * 15;
        // cute wings
        ctx.beginPath(); ctx.moveTo(-w/2 + 5, -h/2); ctx.quadraticCurveTo(-w/2 - 20, -h/2 - 20 + flap, -w/2 - 30, -h/2 - 5 + flap/2); ctx.quadraticCurveTo(-w/2 - 15, -h/2 + 10, -w/2 + 5, -h/2 + 15); ctx.fill(); ctx.stroke();
      }
      if (cat.catType === 'super' && cat.superHealth > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-w/2, -h - 20, w, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-w/2, -h - 20, w * (Math.max(0, cat.superHealth) / 100), 4);

      }

      if (cat.fishCannonTimer > 0) {
        ctx.save();
        ctx.translate(-5, -h/2); // positioned on cat's back
        if (facingLeft) {
            ctx.scale(-1, 1);
        }
        ctx.fillStyle = '#1e293b'; // dark gray cannon
        ctx.fillRect(-10, -15, 30, 12);
        ctx.fillStyle = '#ef4444'; // red trim
        ctx.fillRect(10, -16, 10, 14);
        ctx.fillStyle = '#f8fafc'; // tip
        ctx.fillRect(20, -14, 5, 10);
        ctx.restore();
      }

      ctx.restore();

    };

    // Stable per-window lighting. `key` must identify the window in the world (building
    // index + row + column), never its screen position, or windows flicker while scrolling.
    // Only `density` of the windows are lit (it's midnight), and very rarely someone
    // switches a light on or off.
    const hash01 = (n: number) => { const v = Math.sin(n * 999.99) * 10000; return v - Math.floor(v); };
    const windowLit = (key: number, frames: number, density: number) => {
      const lit = hash01(key) < density;
      const period = 1500; // each window re-rolls roughly every 25s...
      const epoch = Math.floor((frames + hash01(key * 1.37) * period) / period);
      return hash01(key * 7.13 + epoch * 3.31) < 0.04 ? !lit : lit; // ...with a 4% chance to switch
    };

    // Full-canvas sky, drawn in screen space before the world offset is applied
    const drawSky = (ctx: CanvasRenderingContext2D) => {
      const s = state.current;
      const { h, top } = s.view;
      const horizon = top + GROUND_Y;
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      if (s.map === 'Stadium') {
        g.addColorStop(0, '#020412');
        g.addColorStop(0.55, '#0b1033');
        g.addColorStop(0.85, '#1e1b4b');
        g.addColorStop(1, '#3b2a6b');
      } else if (s.map === 'Rooftop') {
        // Same night sky as the street below (it's the same city), a touch deeper
        g.addColorStop(0, '#01020a');
        g.addColorStop(0.6, '#040818');
        g.addColorStop(0.9, '#0b112a');
        g.addColorStop(1, '#151733');
      } else {
        g.addColorStop(0, '#01030c');
        g.addColorStop(0.6, '#050a1f');
        g.addColorStop(0.9, '#0d1433');
        g.addColorStop(1, '#1a1840');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WIDTH, horizon);
      // Below the horizon the ground layers cover this; fill anyway so nothing is ever transparent
      ctx.fillStyle = s.map === 'Stadium' ? '#1a0505' : '#050814';
      ctx.fillRect(0, horizon, WIDTH, h - horizon);
    };

    // Stage 2 — Building Tops: running across rooftops high above a neon city
    const drawRooftop = (ctx: CanvasRenderingContext2D, VT: number, VB: number, prng: (n: number) => number) => {
      const s = state.current;
      const t = s.frames;

      // ---- 1. The same Night City as Stage 1, seen from above: its buildings rise from
      // below our roof, so only their upper floors show behind the roofline
      ctx.save();
      ctx.translate(0, ROOFTOP_CITY_DROP);
      drawCityBackdrop(ctx, prng);
      ctx.restore();

      // ---- 2. Nearby towers rising above the roofline: beacons, billboards, water towers
      const midX = s.bg.cityNear;
      const tw = 300;
      const tStart = Math.floor(midX / tw);
      for (let i = tStart; i < tStart + Math.ceil(WIDTH / tw) + 2; i++) {
        const x = i * tw - midX;
        const kind = Math.floor(prng(i * 3.91 + 0.2) * 4);
        if (kind === 0 || kind === 1) {
          // Open view: the shared Night City backdrop shows through here
        } else if (kind === 2) {
          // Neon billboard on stilts
          const bTop = GROUND_Y - 230;
          ctx.fillStyle = '#1e1b2e';
          ctx.fillRect(x + 50, bTop + 90, 8, 140);
          ctx.fillRect(x + 190, bTop + 90, 8, 140);
          ctx.fillStyle = '#0b0716';
          ctx.fillRect(x + 20, bTop, 210, 92);
          const signs = [['NEKO', 'RAMEN', '#f472b6'], ['MEOW', 'MART', '#22d3ee'], ['FISH', 'BAR', '#facc15'], ['PURR', 'CLUB', '#a78bfa']];
          const sg = signs[((i % signs.length) + signs.length) % signs.length];
          ctx.save();
          ctx.globalAlpha = 0.5; // steady and dim: it's past midnight
          ctx.shadowColor = sg[2]; ctx.shadowBlur = 8;
          ctx.strokeStyle = sg[2]; ctx.lineWidth = 3;
          ctx.strokeRect(x + 28, bTop + 8, 194, 76);
          ctx.fillStyle = sg[2];
          ctx.font = 'bold 30px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(sg[0], x + 125, bTop + 42);
          ctx.font = 'bold 20px monospace';
          ctx.fillText(sg[1], x + 125, bTop + 72);
          ctx.restore();
        } else {
          // Water tower on legs
          const base = GROUND_Y - 40;
          ctx.strokeStyle = '#3f2e4d'; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x + 60, base); ctx.lineTo(x + 75, base - 90);
          ctx.moveTo(x + 150, base); ctx.lineTo(x + 135, base - 90);
          ctx.moveTo(x + 66, base - 40); ctx.lineTo(x + 144, base - 40);
          ctx.stroke();
          ctx.fillStyle = '#4a2f3a';
          ctx.fillRect(x + 65, base - 170, 80, 85);
          ctx.fillStyle = '#5b3a47';
          for (let k = 0; k < 4; k++) ctx.fillRect(x + 65, base - 160 + k * 20, 80, 3);
          ctx.fillStyle = '#2b1a22';
          ctx.beginPath(); ctx.moveTo(x + 60, base - 170); ctx.lineTo(x + 105, base - 205); ctx.lineTo(x + 150, base - 170); ctx.fill();
        }
      }

      // ---- 3. Rear parapet of our roof (dim, so obstacles stay readable)
      ctx.fillStyle = 'rgba(10, 6, 20, 0.55)';
      ctx.fillRect(0, GROUND_Y - 36, WIDTH, 36);
      ctx.fillStyle = '#2a1d3a';
      ctx.fillRect(0, GROUND_Y - 38, WIDTH, 4);

      // ---- 4. Roof surface and the building face below (scrolls with the run)
      const road = s.bg.road;
      const roofH = 16;
      ctx.fillStyle = '#2b2336';
      ctx.fillRect(0, GROUND_Y, WIDTH, roofH);
      ctx.fillStyle = '#6d5a86';
      ctx.fillRect(0, GROUND_Y, WIDTH, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      const gStep = 23;
      const gs = Math.floor(road / gStep);
      for (let i = gs; i < gs + Math.ceil(WIDTH / gStep) + 2; i++) {
        ctx.fillRect(i * gStep - road + (i * 7) % 11, GROUND_Y + 6 + (i * 5) % 7, 3, 2); // gravel
      }
      const segW = 640;
      const sStart = Math.floor(road / segW);
      const faceTop = GROUND_Y + roofH;
      for (let i = sStart; i < sStart + Math.ceil(WIDTH / segW) + 2; i++) {
        const x = i * segW - road;
        const tones = ['#3b1f2b', '#2f2340', '#3a2a22', '#26263d'];
        ctx.fillStyle = tones[((i % tones.length) + tones.length) % tones.length];
        ctx.fillRect(x, faceTop, segW, VB - faceTop);
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
        for (let by = faceTop + 12; by < VB; by += 12) {
          ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + segW, by); ctx.stroke();
        }
        for (let col = 0, wx = x + 40; wx < x + segW - 40; col++, wx += 80) {
          for (let row = 0, wy = faceTop + 36; wy < VB - 30; row++, wy += 86) {
            const lit = windowLit(i * 2003 + row * 37 + col, t, 0.2);
            ctx.fillStyle = lit ? 'rgba(253, 220, 160, 0.28)' : '#120b18';
            ctx.fillRect(wx, wy, 30, 44);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(wx - 3, wy + 44, 36, 4); // sill
          }
        }
        ctx.fillStyle = '#0c0712';
        ctx.fillRect(x, faceTop, 5, VB - faceTop); // seam between buildings
      }
      const faceShade = ctx.createLinearGradient(0, faceTop, 0, VB);
      faceShade.addColorStop(0, 'rgba(0,0,0,0.15)');
      faceShade.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = faceShade;
      ctx.fillRect(0, faceTop, WIDTH, VB - faceTop);
    };

    // City -> Building Tops: a fire escape scrolls in and the cat climbs it to the roof
    const drawStairsScene = (ctx: CanvasRenderingContext2D) => {
      const s = state.current;
      const tr = s.transition;
      if (!tr || tr.kind !== 'STAIRS') return;
      const VB = HEIGHT + s.view.bottom;
      const sx = tr.stairX0 - s.bg.road;
      const topY = GROUND_Y - STAIR_STEPS * STAIR_H;
      const bx = sx + STAIR_STEPS * STAIR_W;
      if (sx > WIDTH + 20) return;

      // The building the stairs lead onto
      ctx.fillStyle = '#3b1f24';
      ctx.fillRect(bx, topY, WIDTH + 600, VB - topY);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (let by = topY + 14; by < VB; by += 14) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + WIDTH + 600, by); ctx.stroke();
      }
      for (let col = 0, wx = bx + 40; wx < bx + WIDTH + 560; col++, wx += 90) {
        for (let row = 0, wy = topY + 40; wy < VB - 40; row++, wy += 90) {
          const lit = windowLit(7777 + row * 41 + col, s.frames, 0.22);
          ctx.fillStyle = lit ? 'rgba(253, 220, 160, 0.32)' : '#140a0d';
          ctx.fillRect(wx, wy, 34, 46);
        }
      }
      // Roof parapet
      ctx.fillStyle = '#1f1115';
      ctx.fillRect(bx, topY - 10, WIDTH + 600, 12);
      ctx.fillStyle = '#7c3a44';
      ctx.fillRect(bx, topY - 10, WIDTH + 600, 3);
      // Sign pointing up
      ctx.save();
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#f0abfc';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('ROOFTOPS ↑', bx + 60, topY + 30);
      ctx.restore();

      // Fire-escape stairs: dark support under the flight, then treads and a rail
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y); ctx.lineTo(bx, topY); ctx.lineTo(bx, GROUND_Y); ctx.closePath(); ctx.fill();
      for (let i = 0; i < STAIR_STEPS; i++) {
        const x = sx + i * STAIR_W;
        const y = GROUND_Y - (i + 1) * STAIR_H;
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, y, STAIR_W, STAIR_H); // riser block
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x, y, STAIR_W, 4); // tread edge
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + STAIR_W - 3, y + 4, 3, STAIR_H - 4);
      }
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, GROUND_Y - 34); ctx.lineTo(bx, topY - 34); ctx.lineTo(bx + 30, topY - 34); ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = 0; i <= STAIR_STEPS; i += 2) {
        const x = sx + i * STAIR_W;
        const y = GROUND_Y - i * STAIR_H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
      }

      if (tr.phase === 'CLIMB' && tr.t < 150) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, tr.t / 20) * Math.min(1, (150 - tr.t) / 30);
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px monospace';
        ctx.fillStyle = '#f0abfc';
        ctx.shadowColor = '#a21caf'; ctx.shadowBlur = 16;
        ctx.fillText('UP TO THE ROOFTOPS!', WIDTH / 2, 200);
        ctx.restore();
      }
    };

    const drawStadium = (ctx: CanvasRenderingContext2D, VT: number, VB: number, prng: (n: number) => number) => {
      const s = state.current;
      const t = s.frames;

      // Stands, lights and boards are lifted so the track extends above the running line
      ctx.save();
      ctx.translate(0, -STADIUM_LIFT);

      // ---- 1. Upper-tier bowl: roofline silhouette + crowd with camera flashes (slowest layer)
      const bowlX = s.bg.cityFar * 0.5;
      const rimAt = (wx: number) => GROUND_Y - 330 + Math.sin(wx * 0.004) * 18 + Math.sin(wx * 0.011) * 6;
      ctx.fillStyle = '#0a0f24';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= WIDTH + 20; x += 20) ctx.lineTo(x, rimAt(x + bowlX));
      ctx.lineTo(WIDTH + 20, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(165, 180, 252, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= WIDTH + 20; x += 20) {
        if (x === 0) ctx.moveTo(x, rimAt(x + bowlX)); else ctx.lineTo(x, rimAt(x + bowlX));
      }
      ctx.stroke();
      const cell = 14;
      const cStart = Math.floor(bowlX / cell);
      const flashSeed = Math.floor(t / 6);
      for (let i = cStart; i < cStart + Math.ceil(WIDTH / cell) + 1; i++) {
        const cx = i * cell - bowlX;
        const rimY = rimAt(i * cell);
        for (let r = 0; r < 7; r++) {
          const cy = rimY + 22 + r * 17;
          if (cy > GROUND_Y - 185) break;
          const n = prng(i * 7.3 + r * 13.1);
          ctx.fillStyle = n > 0.7 ? '#1e3a8a' : n > 0.4 ? '#4c1d95' : '#1f2937';
          ctx.fillRect(cx, cy, 6, 6);
          if (prng(i * 3.1 + r * 5.7 + flashSeed * 0.37) > 0.994) {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.arc(cx + 3, cy + 3, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx, cy, 6, 6);
          }
        }
      }

      // ---- 2. Floodlight towers (beams drawn later, over the stands)
      const towerX = s.bg.cityFar;
      const towerSpacing = 640;
      const tStart = Math.floor(towerX / towerSpacing);
      const beams: number[] = [];
      for (let i = tStart; i < tStart + Math.ceil(WIDTH / towerSpacing) + 2; i++) {
        const x = i * towerSpacing - towerX + 120;
        const bankY = GROUND_Y - 520;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x - 6, bankY + 40, 12, 360);
        // lattice
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
        for (let ly = bankY + 50; ly < GROUND_Y - 180; ly += 24) {
          ctx.beginPath(); ctx.moveTo(x - 6, ly); ctx.lineTo(x + 6, ly + 12); ctx.stroke();
        }
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 70, bankY, 140, 46);
        for (let bx = 0; bx < 6; bx++) {
          for (let by = 0; by < 2; by++) {
            const lx = x - 58 + bx * 23;
            const ly = bankY + 12 + by * 20;
            ctx.fillStyle = 'rgba(254, 249, 195, 0.35)';
            ctx.beginPath(); ctx.arc(lx, ly, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fefce8';
            ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        beams.push(x, bankY + 46);
      }

      // ---- 3. Lower tier with a crowd doing "the wave"
      const lowX = s.bg.cityNear * 0.7;
      const lowTop = GROUND_Y - 185;
      ctx.fillStyle = '#111831';
      ctx.fillRect(0, lowTop, WIDTH, GROUND_Y - lowTop);
      ctx.fillStyle = '#1b2344';
      for (let r = 0; r < 5; r++) ctx.fillRect(0, lowTop + 12 + r * 26, WIDTH, 3);
      const fanColors = ['#dc2626', '#2563eb', '#facc15', '#16a34a', '#e2e8f0', '#9333ea'];
      const fanCell = 16;
      const fStart = Math.floor(lowX / fanCell);
      for (let i = fStart; i < fStart + Math.ceil(WIDTH / fanCell) + 1; i++) {
        const fx = i * fanCell - lowX;
        const wave = Math.pow(Math.max(0, Math.sin(i * fanCell * 0.006 - t * 0.06)), 10) * 12;
        for (let r = 0; r < 5; r++) {
          const n = prng(i * 11.7 + r * 3.3);
          if (n < 0.12) continue; // empty seat
          const fy = lowTop + r * 26 + 2 - wave - (n > 0.9 ? Math.abs(Math.sin(t * 0.2 + i)) * 3 : 0);
          ctx.fillStyle = fanColors[Math.floor(n * 97) % fanColors.length];
          ctx.fillRect(fx + 2, fy + 6, 10, 9); // shirt
          ctx.fillStyle = n > 0.5 ? '#fcd34d' : '#a16207';
          ctx.beginPath(); ctx.arc(fx + 7, fy + 3, 4, 0, Math.PI * 2); ctx.fill(); // head
          if (wave > 6) { // arms up
            ctx.fillStyle = fanColors[Math.floor(n * 97) % fanColors.length];
            ctx.fillRect(fx + 1, fy - 5, 2, 8); ctx.fillRect(fx + 11, fy - 5, 2, 8);
          }
        }
      }

      // Push the crowd back a little so obstacles in front stay readable
      ctx.fillStyle = 'rgba(8, 12, 32, 0.38)';
      ctx.fillRect(0, lowTop - 14, WIDTH, GROUND_Y - lowTop + 14);

      // ---- 4. Set pieces in front of the stands (mid parallax), varied per slot
      const midX = s.bg.cityNear;
      const pieceSpacing = 560;
      const pStart = Math.floor(midX / pieceSpacing);
      for (let i = pStart; i < pStart + Math.ceil(WIDTH / pieceSpacing) + 2; i++) {
        const x = i * pieceSpacing - midX;
        const kind = Math.floor(prng(i * 1.73 + 0.5) * 5);
        if (kind === 0) {
          // Jumbotron with rotating content
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 90, GROUND_Y - 260, 14, 260);
          ctx.fillRect(x + 256, GROUND_Y - 260, 14, 260);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x + 40, GROUND_Y - 420, 280, 170);
          ctx.fillStyle = '#020617';
          ctx.fillRect(x + 52, GROUND_Y - 408, 256, 146);
          // chasing border lights
          for (let k = 0; k < 20; k++) {
            const on = (k + Math.floor(t / 4)) % 5 === 0;
            ctx.fillStyle = on ? '#fde047' : '#422006';
            ctx.fillRect(x + 44 + k * 14, GROUND_Y - 418, 6, 4);
            ctx.fillRect(x + 44 + k * 14, GROUND_Y - 256, 6, 4);
          }
          const scene = Math.floor((t + i * 90) / 180) % 3;
          ctx.textAlign = 'center';
          if (scene === 0) {
            ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 18px monospace';
            ctx.fillText('DISTANCE', x + 180, GROUND_Y - 370);
            ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 44px monospace';
            ctx.fillText(`${Math.floor(s.score)}m`, x + 180, GROUND_Y - 305);
          } else if (scene === 1) {
            // Big cat face
            const fcx = x + 180, fcy = GROUND_Y - 330;
            ctx.fillStyle = '#f97316';
            ctx.beginPath(); ctx.arc(fcx, fcy, 45, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(fcx - 42, fcy - 15); ctx.lineTo(fcx - 35, fcy - 62); ctx.lineTo(fcx - 10, fcy - 40); ctx.fill();
            ctx.beginPath(); ctx.moveTo(fcx + 42, fcy - 15); ctx.lineTo(fcx + 35, fcy - 62); ctx.lineTo(fcx + 10, fcy - 40); ctx.fill();
            ctx.fillStyle = '#0f172a';
            const blink = Math.floor(t / 10) % 12 === 0;
            if (blink) { ctx.fillRect(fcx - 22, fcy - 8, 14, 3); ctx.fillRect(fcx + 8, fcy - 8, 14, 3); }
            else { ctx.beginPath(); ctx.arc(fcx - 15, fcy - 6, 6, 0, Math.PI * 2); ctx.arc(fcx + 15, fcy - 6, 6, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#f472b6';
            ctx.beginPath(); ctx.arc(fcx, fcy + 8, 4, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.font = 'bold 40px monospace';
            ctx.fillStyle = Math.floor(t / 8) % 2 === 0 ? '#facc15' : '#f43f5e';
            ctx.fillText('GO CAT GO!', x + 180, GROUND_Y - 318);
          }
          ctx.textAlign = 'left';
        } else if (kind === 1) {
          // Goalposts
          ctx.fillStyle = '#facc15';
          ctx.fillRect(x + 176, GROUND_Y - 170, 10, 170);
          ctx.fillRect(x + 90, GROUND_Y - 176, 182, 10);
          ctx.fillRect(x + 90, GROUND_Y - 380, 10, 214);
          ctx.fillRect(x + 262, GROUND_Y - 380, 10, 214);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 88, GROUND_Y - 392, 14, 14);
          ctx.fillRect(x + 260, GROUND_Y - 392, 14, 14);
        } else if (kind === 2) {
          // Waving team flags
          const flagCols = ['#dc2626', '#2563eb', '#facc15', '#16a34a'];
          for (let k = 0; k < 4; k++) {
            const px = x + 40 + k * 80;
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(px, GROUND_Y - 300, 4, 300);
            ctx.fillStyle = flagCols[k];
            ctx.beginPath();
            ctx.moveTo(px + 4, GROUND_Y - 298);
            for (let fx = 0; fx <= 60; fx += 6) ctx.lineTo(px + 4 + fx, GROUND_Y - 298 + Math.sin(fx * 0.12 - t * 0.15 + k) * 5);
            for (let fx = 60; fx >= 0; fx -= 6) ctx.lineTo(px + 4 + fx, GROUND_Y - 258 + Math.sin(fx * 0.12 - t * 0.15 + k) * 5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(px + 32, GROUND_Y - 278 + Math.sin(28 * 0.12 - t * 0.15 + k) * 5, 7, 0, Math.PI * 2); ctx.fill();
          }
        } else if (kind === 3) {
          // Press box with commentators
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x + 40, GROUND_Y - 330, 300, 120);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 40, GROUND_Y - 342, 300, 14);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          for (let k = 0; k < 3; k++) ctx.fillRect(x + 54 + k * 96, GROUND_Y - 316, 82, 70);
          ctx.fillStyle = '#020617';
          for (let k = 0; k < 3; k++) {
            const bob = Math.sin(t * 0.1 + k * 2) * 2;
            ctx.beginPath(); ctx.arc(x + 95 + k * 96, GROUND_Y - 272 + bob, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(x + 82 + k * 96, GROUND_Y - 262 + bob, 26, 16);
          }
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 14px monospace';
          ctx.fillText('● LIVE', x + 280, GROUND_Y - 222);
        } else {
          // Podium + trophy with a glint
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x + 100, GROUND_Y - 70, 60, 70);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(x + 160, GROUND_Y - 105, 60, 105);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(x + 220, GROUND_Y - 50, 60, 50);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('1', x + 190, GROUND_Y - 70);
          ctx.fillText('2', x + 130, GROUND_Y - 35);
          ctx.fillText('3', x + 250, GROUND_Y - 18);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.moveTo(x + 176, GROUND_Y - 150); ctx.lineTo(x + 204, GROUND_Y - 150); ctx.lineTo(x + 196, GROUND_Y - 118); ctx.lineTo(x + 184, GROUND_Y - 118); ctx.fill();
          ctx.fillRect(x + 186, GROUND_Y - 118, 8, 8);
          ctx.fillRect(x + 176, GROUND_Y - 110, 28, 5);
          if (Math.floor(t / 20) % 6 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x + 198, GROUND_Y - 144, 3 + (t % 20) / 5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // ---- 5. Floodlight beams (additive)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < beams.length; b += 2) {
        const bx = beams[b], by = beams[b + 1];
        const sway = Math.sin(t * 0.01 + bx * 0.01) * 60;
        const grad = ctx.createLinearGradient(bx, by, bx + sway, GROUND_Y);
        grad.addColorStop(0, 'rgba(254, 249, 195, 0.16)');
        grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx - 60, by);
        ctx.lineTo(bx + 60, by);
        ctx.lineTo(bx + sway + 230, GROUND_Y);
        ctx.lineTo(bx + sway - 230, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // ---- 6. Trackside LED ad boards (move with the track)
      const road = s.bg.road;
      const adW = 240;
      const ads = ['MIDNIGHT PAWS', 'FISH ENERGY', 'MEOW SPORTS', 'PURR COLA', 'GO CATS!', 'NINE LIVES'];
      const adCols = ['#22d3ee', '#facc15', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];
      const aStart = Math.floor(road / adW);
      for (let i = aStart; i < aStart + Math.ceil(WIDTH / adW) + 2; i++) {
        const ax = i * adW - road;
        const idx = ((i % ads.length) + ads.length) % ads.length;
        ctx.fillStyle = '#070b18';
        ctx.fillRect(ax, GROUND_Y - 30, adW - 4, 26);
        ctx.fillStyle = adCols[idx];
        ctx.globalAlpha = 0.75;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ads[idx], ax + adW / 2, GROUND_Y - 12);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }

      ctx.restore(); // end of lifted stands

      // ---- 7. Running track (scrolls with the road)
      // The track starts above the running line, so the cat and every obstacle are
      // seen against clean red lanes instead of the busy crowd.
      const trackTop = GROUND_Y - STADIUM_LIFT;
      const trackBottom = HEIGHT - 20;
      const trackGrad = ctx.createLinearGradient(0, trackTop, 0, trackBottom);
      trackGrad.addColorStop(0, '#6b1717');
      trackGrad.addColorStop(0.35, '#7a1b1b');
      trackGrad.addColorStop(1, '#4c0f0f');
      ctx.fillStyle = trackGrad;
      ctx.fillRect(0, trackTop, WIDTH, trackBottom - trackTop);
      // lane lines (continuous, parallel to the run direction)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(0, trackTop, WIDTH, 3);
      for (let ly = trackTop + LANE_H; ly < trackBottom - 5; ly += LANE_H) {
        const isRunLine = Math.abs(ly - GROUND_Y) < 1;
        ctx.fillStyle = isRunLine ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
        ctx.fillRect(0, ly - (isRunLine ? 1 : 0), WIDTH, isRunLine ? 3 : 2);
      }
      const laneCount = Math.round((trackBottom - trackTop) / LANE_H);
      // scrolling details: grain ticks, lane numbers, start lines
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      const tick = 90;
      const kStart = Math.floor(road / tick);
      for (let i = kStart; i < kStart + Math.ceil(WIDTH / tick) + 2; i++) {
        const kx = i * tick - road;
        for (let lane = 0; lane < laneCount; lane++) ctx.fillRect(kx + (lane * 23) % 60, trackTop + 20 + lane * LANE_H, 18, 2);
      }
      const markSpacing = 1200;
      const mStart = Math.floor(road / markSpacing);
      for (let i = mStart; i < mStart + 2; i++) {
        const mx = i * markSpacing - road + 300;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(mx, trackTop + 3, 5, trackBottom - trackTop - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = 'bold 26px sans-serif';
        // lane 1 is the inside lane, nearest the infield
        for (let lane = 0; lane < laneCount; lane++) ctx.fillText(String(laneCount - lane), mx + 24, trackTop + 33 + lane * LANE_H);
      }
      // shade under the ad boards
      const shade = ctx.createLinearGradient(0, trackTop, 0, trackTop + 30);
      shade.addColorStop(0, 'rgba(0,0,0,0.45)');
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, trackTop, WIDTH, 30);

      // ---- 8. Curb + infield grass (fills the extra ground on tall screens)
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, trackBottom, WIDTH, 6);
      if (VB > trackBottom + 6) {
        const grassTop = trackBottom + 6;
        const stripe = 70;
        const gStart = Math.floor(road / stripe);
        for (let i = gStart; i < gStart + Math.ceil(WIDTH / stripe) + 2; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#14532d' : '#166534';
          ctx.fillRect(i * stripe - road, grassTop, stripe + 1, VB - grassTop);
        }
        const yard = 420;
        const yStart = Math.floor(road / yard);
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        for (let i = yStart; i < yStart + Math.ceil(WIDTH / yard) + 2; i++) {
          const yx = i * yard - road;
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(yx, grassTop, 4, VB - grassTop);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          const num = 10 * (((i % 5) + 5) % 5 + 1);
          ctx.fillText(`${num}`, yx + 40, grassTop + 70);
        }
        ctx.textAlign = 'left';
        const gShade = ctx.createLinearGradient(0, grassTop, 0, VB);
        gShade.addColorStop(0, 'rgba(0,0,0,0.35)');
        gShade.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = gShade;
        ctx.fillRect(0, grassTop, WIDTH, VB - grassTop);
      }

      // Transition tunnel overlay
      if (s.mapTransitionTimer > 0) {
        const elapsed = s.frames - s.mapTransitionTimer;
        if (elapsed < 100) {
          ctx.fillStyle = `rgba(0,0,0,${1 - elapsed / 100})`;
          ctx.fillRect(0, VT, WIDTH, VB - VT);
        }
      }
    };

    const drawBackground = (ctx: CanvasRenderingContext2D) => {
      const s = state.current;
      // Visible world bounds (world y can go negative above, and past HEIGHT below)
      const VT = -s.view.top;
      const VB = HEIGHT + s.view.bottom;

      const prng = (seed: number) => {
        const x = Math.sin(seed * 999.99) * 10000;
        return x - Math.floor(x);
      };
      
      const STAGE_LENGTH = 2000;
      
      // Start at night (1.0) and stay at night
      let timeOfDay = 1.0; 
      
      let baseHue;
      if (timeOfDay < 0.25) {
        baseHue = 220 + (280 - 220) * (timeOfDay / 0.25);
      } else if (timeOfDay < 0.5) {
        baseHue = 280 + (200 - 280) * ((timeOfDay - 0.25) / 0.25);
      } else if (timeOfDay < 0.75) {
        baseHue = 200 + (20 - 200) * ((timeOfDay - 0.5) / 0.25);
      } else {
        baseHue = 20 + (220 - 20) * ((timeOfDay - 0.75) / 0.25);
      }
      
      // Weather modifier
      const weatherOpacity = s.weather.intensity || 0;
      
      // Stars at night
      if (timeOfDay < 0.3 || timeOfDay > 0.7) {
        let opacity = timeOfDay < 0.3 ? (1 - timeOfDay/0.3) : ((timeOfDay - 0.7)/0.3);
        opacity *= Math.max(0, 1 - (weatherOpacity * 1.5)); // Hide stars when bad weather
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
        const skySpan = GROUND_Y - 120 - VT;
        const starCount = Math.round(50 * skySpan / (GROUND_Y - 120));
        for(let i=0; i<starCount; i++) {
          const starX = prng(i * 10) * WIDTH;
          const starY = VT + prng(i * 11) * skySpan;
          const twinkle = (Math.sin(s.frames * 0.05 + i) + 1) / 2;
          ctx.globalAlpha = opacity * (0.3 + 0.7 * twinkle);
          ctx.beginPath(); ctx.arc(starX, starY, prng(i * 12) * 1.5 + 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      
      // Sun/Moon
      const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
      const sunX = WIDTH / 2 + Math.cos(sunAngle) * (WIDTH / 1.5);
      const sunY = (GROUND_Y + 100) - Math.sin(sunAngle) * (GROUND_Y - 200);
      const moonAngle = (timeOfDay - 0.75) * Math.PI * 2;
      const moonX = WIDTH / 2 + Math.cos(moonAngle) * (WIDTH / 1.5);
      const moonY = (GROUND_Y + 100) - Math.sin(moonAngle) * (GROUND_Y - 200);

      if (sunY < HEIGHT) {
        ctx.fillStyle = '#fef08a'; // Sun
        ctx.shadowBlur = 30; ctx.shadowColor = '#fef08a';
        ctx.beginPath(); ctx.arc(sunX, sunY, 50, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (moonY < HEIGHT) {
        ctx.globalAlpha = Math.max(0, 1 - (weatherOpacity * 1.5));
        ctx.fillStyle = "#fde047"; // Moon
        ctx.shadowBlur = 20; ctx.shadowColor = "rgba(253, 224, 71, 0.6)";
        ctx.beginPath(); ctx.arc(moonX, moonY, 40, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Draw Clouds if bad weather
      if ((s.weather.type === 'RAIN' || s.weather.type === 'FOG') && weatherOpacity > 0) {
         ctx.globalAlpha = weatherOpacity * 0.8;
         ctx.fillStyle = s.weather.type === 'RAIN' ? '#334155' : '#94a3b8';
         for(let c = 0; c < 6; c++) {
            ctx.beginPath(); ctx.arc(150 * c, 50 + Math.sin(c)*20, 80 + Math.cos(c)*30, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(150 * c + 75, 80 + Math.cos(c)*20, 60 + Math.sin(c)*20, 0, Math.PI*2); ctx.fill();
         }
         ctx.globalAlpha = 1;
      }

      if (s.map === 'Stadium') {
          drawStadium(ctx, VT, VB, prng);
          return;
      }
      if (s.map === 'Rooftop') {
          drawRooftop(ctx, VT, VB, prng);
          return;
      }
      
      drawCity(ctx, VB, prng);
    };

    // Night City skyline + districts, shared by the street (Stage 1) and the view from the
    // rooftops (Stage 2, drawn lower), so both stages show the same city.
    const drawCityBackdrop = (ctx: CanvasRenderingContext2D, prng: (n: number) => number) => {
      const s = state.current;
      const t = s.frames;

      // ---- 1. Faint city glow along the horizon
      const glow = ctx.createLinearGradient(0, GROUND_Y - 320, 0, GROUND_Y);
      glow.addColorStop(0, 'rgba(148, 163, 184, 0)');
      glow.addColorStop(1, 'rgba(148, 120, 110, 0.08)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, GROUND_Y - 320, WIDTH, 320);

      // ---- 2. Distant skyline (slowest layer) with blinking aircraft lights
      const farX = s.bg.cityFar * 0.5;
      const fw = 46;
      const fStart = Math.floor(farX / fw);
      for (let i = fStart; i < fStart + Math.ceil(WIDTH / fw) + 2; i++) {
        const x = i * fw - farX;
        const bh = 110 + prng(i * 1.91) * 230;
        const top = GROUND_Y - bh;
        ctx.fillStyle = '#0c1230';
        ctx.fillRect(x, top, fw - 4, bh);
        if (prng(i * 7.7) > 0.85) {
          ctx.fillRect(x + fw / 2 - 4, top - 30, 4, 30); // spire
          if (Math.floor((t + i * 13) / 35) % 2 === 0) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(x + fw / 2 - 2, top - 32, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(253, 230, 138, 0.16)';
        for (let k = 0; k < 8; k++) {
          if (prng(i * 3.3 + k * 1.7) > 0.6) ctx.fillRect(x + 5 + (k % 3) * 12, top + 10 + Math.floor(k / 3) * 22 + prng(i + k) * (bh * 0.5), 3, 4);
        }
      }

      // ---- 3. Districts (mid layer), cycling Downtown -> Park -> Brownstones -> Harbor
      const midX = s.bg.cityNear;
      const slot = 240;
      const DISTRICT_LEN = 2400;
      const mStart = Math.floor(midX / slot);
      for (let i = mStart; i < mStart + Math.ceil(WIDTH / slot) + 2; i++) {
        const x = i * slot - midX;
        const district = Math.floor((i * slot) / DISTRICT_LEN) % 4;
        const r = (n: number) => prng(i * 5.13 + n);

        if (district === 0) {
          // Downtown: glass towers, lit window strips, rooftop neon
          const w = 150 + r(1) * 50;
          const h = 230 + r(2) * 110;
          const top = GROUND_Y - h;
          const tint = ['#131a3a', '#1a1535', '#10233a'][Math.floor(r(3) * 3)];
          ctx.fillStyle = tint;
          ctx.fillRect(x + 10, top, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 10, top, 8, h);
          ctx.fillStyle = 'rgba(253, 230, 170, 0.22)';
          for (let row = 0, wy = top + 16; wy < GROUND_Y - 36; row++, wy += 16) {
            for (let col = 0, wx = x + 22; wx < x + w - 6; col++, wx += 14) {
              if (windowLit(i * 3001 + row * 29 + col, t, 0.3)) ctx.fillRect(wx, wy, 8, 9);
            }
          }
          if (r(4) > 0.7) {
            // A few soft neon signs (kept dim so they don't compete with the gameplay)
            const signs = [['HOTEL', '#f9a8d4'], ['CAFE', '#99f6e4'], ['24H', '#bbf7d0'], ['BAR', '#fde68a']];
            const sg = signs[Math.floor(r(5) * signs.length)];
            ctx.save();
            ctx.globalAlpha = 0.45; // steady, no flicker
            ctx.shadowColor = sg[1]; ctx.shadowBlur = 6;
            ctx.fillStyle = sg[1];
            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sg[0], x + 10 + w / 2, top - 10);
            ctx.restore();
          }
        } else if (district === 1) {
          // Park: layered trees, lamp posts and fireflies
          const tx = x + 60 + r(1) * 80;
          const th = 110 + r(2) * 60;
          ctx.fillStyle = '#2b1d16';
          ctx.fillRect(tx - 6, GROUND_Y - th * 0.55, 12, th * 0.55);
          ctx.fillStyle = '#0b2418';
          ctx.beginPath();
          ctx.arc(tx, GROUND_Y - th, 52, 0, Math.PI * 2);
          ctx.arc(tx - 40, GROUND_Y - th * 0.72, 40, 0, Math.PI * 2);
          ctx.arc(tx + 42, GROUND_Y - th * 0.75, 42, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(74, 222, 128, 0.10)';
          ctx.beginPath(); ctx.arc(tx - 12, GROUND_Y - th - 16, 30, 0, Math.PI * 2); ctx.fill();
          if (i % 2 === 0) {
            const lx = x + 200;
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(lx - 2, GROUND_Y - 120, 4, 120);
            ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
            ctx.beginPath(); ctx.arc(lx, GROUND_Y - 122, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath(); ctx.arc(lx, GROUND_Y - 122, 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#fde047';
          for (let k = 0; k < 3; k++) {
            const fx = x + r(10 + k) * slot + Math.sin(t * 0.03 + k + i) * 12;
            const fy = GROUND_Y - 40 - r(20 + k) * 110 + Math.cos(t * 0.04 + k * 2) * 8;
            ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.07 + k * 3 + i));
            ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (district === 2) {
          // Brownstones: row houses with warm windows, curtains, stoops, fire escapes
          const h = 150 + r(1) * 60;
          const top = GROUND_Y - h;
          const bricks = ['#3a1f1a', '#43261c', '#2f1c24'];
          ctx.fillStyle = bricks[Math.floor(r(2) * 3)];
          ctx.fillRect(x, top, slot - 4, h);
          ctx.fillStyle = '#1c0f0d';
          ctx.fillRect(x - 4, top - 8, slot + 4, 10); // cornice
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              const wx = x + 26 + col * 70, wy = top + 22 + row * 44;
              if (wy > GROUND_Y - 50) continue;
              const lit = r(30 + row * 3 + col) > 0.35;
              ctx.fillStyle = lit ? 'rgba(253, 200, 150, 0.32)' : '#140a09';
              ctx.fillRect(wx, wy, 28, 32);
              if (lit) {
                ctx.fillStyle = 'rgba(60, 20, 30, 0.5)'; // curtain
                ctx.fillRect(wx, wy, 9, 32);
              }
            }
          }
          ctx.fillStyle = '#231312';
          ctx.fillRect(x + slot / 2 - 24, GROUND_Y - 34, 48, 34); // door
          ctx.fillStyle = '#2d1b17';
          for (let k = 0; k < 3; k++) ctx.fillRect(x + slot / 2 - 34 + k * 6, GROUND_Y - 6 - k * 8, 68 - k * 12, 6); // stoop
          if (r(6) > 0.5) {
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let k = 0; k < 3; k++) {
              const fy = top + 56 + k * 44;
              if (fy > GROUND_Y - 40) break;
              ctx.moveTo(x + 150, fy); ctx.lineTo(x + 225, fy);
              ctx.moveTo(x + (k % 2 ? 150 : 225), fy); ctx.lineTo(x + (k % 2 ? 225 : 150), fy + 44);
            }
            ctx.stroke();
          }
          if (r(7) > 0.7) {
            ctx.fillStyle = '#2a1a14';
            ctx.fillRect(x + 40, top - 58, 46, 40);
            ctx.beginPath(); ctx.moveTo(x + 36, top - 58); ctx.lineTo(x + 63, top - 78); ctx.lineTo(x + 90, top - 58); ctx.fill();
            ctx.fillRect(x + 46, top - 18, 4, 12); ctx.fillRect(x + 76, top - 18, 4, 12);
          }
        } else {
          // Harbor: suspension bridge over the water
          const deckY = GROUND_Y - 120;
          if (i % 2 === 0) {
            ctx.fillStyle = '#18203f';
            ctx.fillRect(x + 20, deckY - 200, 16, 200 + 120);
            ctx.fillRect(x + 54, deckY - 200, 16, 200 + 120);
            ctx.fillRect(x + 16, deckY - 150, 58, 10);
            ctx.fillStyle = '#ef4444';
            if (Math.floor((t + i * 9) / 30) % 2 === 0) { ctx.beginPath(); ctx.arc(x + 45, deckY - 206, 3, 0, Math.PI * 2); ctx.fill(); }
          }
          // cable swooping from this slot's pylon to the next one
          const px = i % 2 === 0 ? x + 45 : x + 45 - slot;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px, deckY - 195); ctx.quadraticCurveTo(px + slot, deckY - 20, px + slot * 2, deckY - 195); ctx.stroke();
          ctx.fillStyle = 'rgba(253, 230, 138, 0.4)';
          for (let k = 1; k < 8; k++) {
            const u = k / 8;
            const cx = px + u * slot * 2;
            const cy = (1 - u) * (1 - u) * (deckY - 195) + 2 * (1 - u) * u * (deckY - 20) + u * u * (deckY - 195);
            ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#111733';
          ctx.fillRect(x, deckY, slot, 10); // deck
          const carX = ((t * 3 + i * 97) % (slot + 40)) - 20;
          ctx.fillStyle = 'rgba(248, 113, 113, 0.9)';
          ctx.fillRect(x + carX, deckY + 3, 6, 3);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
          ctx.fillRect(x + slot - carX, deckY + 3, 6, 3);
          // water with shimmering reflections
          const water = ctx.createLinearGradient(0, deckY + 10, 0, GROUND_Y);
          water.addColorStop(0, '#0b1633');
          water.addColorStop(1, '#050a1c');
          ctx.fillStyle = water;
          ctx.fillRect(x, deckY + 10, slot, GROUND_Y - deckY - 10);
          ctx.fillStyle = 'rgba(253, 230, 138, 0.25)';
          for (let k = 0; k < 6; k++) {
            const wy = deckY + 24 + k * 16;
            const wx = x + ((k * 53 + t * 0.6) % slot);
            ctx.fillRect(wx, wy, 18 + (k % 3) * 6, 2);
          }
        }
      }

      // ---- 5. Quiet the whole backdrop: desaturate, then a dark veil (fades out toward the sky)
      const backTop = GROUND_Y - 420;
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
      ctx.fillRect(0, backTop, WIDTH, GROUND_Y - backTop);
      ctx.restore();
      const veil = ctx.createLinearGradient(0, backTop, 0, GROUND_Y);
      veil.addColorStop(0, 'rgba(3, 5, 14, 0)');
      veil.addColorStop(0.35, 'rgba(3, 5, 14, 0.35)');
      veil.addColorStop(1, 'rgba(3, 5, 14, 0.55)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, backTop, WIDTH, GROUND_Y - backTop);

    };

    // Stage 1 — Night City: skyline, four rotating districts, lamps, and a proper street
    const drawCity = (ctx: CanvasRenderingContext2D, VB: number, prng: (n: number) => number) => {
      const s = state.current;
      const t = s.frames;

      // Everything behind the street is lifted so the road extends above the
      // running line: the cat and obstacles run down the middle of the street.
      ctx.save();
      ctx.translate(0, -CITY_LIFT);

      drawCityBackdrop(ctx, prng);

      // ---- 4. Street lamps along the sidewalk with light cones
      const lampX = s.bg.road * 0.9;
      const lampSpacing = 380;
      const lpStart = Math.floor(lampX / lampSpacing);
      for (let i = lpStart; i < lpStart + Math.ceil(WIDTH / lampSpacing) + 2; i++) {
        const lx = i * lampSpacing - lampX + 60;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(lx - 3, GROUND_Y - 190, 6, 170);
        ctx.fillRect(lx - 3, GROUND_Y - 190, 30, 5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const cone = ctx.createLinearGradient(0, GROUND_Y - 184, 0, GROUND_Y);
        cone.addColorStop(0, 'rgba(253, 230, 170, 0.09)');
        cone.addColorStop(1, 'rgba(253, 230, 170, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(lx + 18, GROUND_Y - 184); ctx.lineTo(lx + 30, GROUND_Y - 184);
        ctx.lineTo(lx + 90, GROUND_Y); ctx.lineTo(lx - 40, GROUND_Y);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath(); ctx.arc(lx + 24, GROUND_Y - 183, 5, 0, Math.PI * 2); ctx.fill();
      }

      // Far sidewalk along the back of the street
      const road = s.bg.road;
      ctx.fillStyle = '#10131c';
      ctx.fillRect(0, GROUND_Y - 22, WIDTH, 22);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(0, GROUND_Y - 22, WIDTH, 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.05)';
      const sw = 64;
      const swStart = Math.floor(road / sw);
      for (let i = swStart; i < swStart + Math.ceil(WIDTH / sw) + 2; i++) ctx.fillRect(i * sw - road, GROUND_Y - 22, 2, 22);

      ctx.restore(); // end of lifted backdrop

      // ---- 6. The street. It spans both sides of the running line, so the cat and
      // obstacles are seen against plain dark asphalt. Markings are kept muted.
      const roadTop = GROUND_Y - CITY_LIFT;
      const roadBottom = HEIGHT - 30;
      const asphalt = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
      asphalt.addColorStop(0, '#121419');
      asphalt.addColorStop(1, '#0a0b0f');
      ctx.fillStyle = asphalt;
      ctx.fillRect(0, roadTop, WIDTH, roadBottom - roadTop);
      ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.fillRect(0, roadTop, WIDTH, 3); // far curb
      const curbShade = ctx.createLinearGradient(0, roadTop, 0, roadTop + 24);
      curbShade.addColorStop(0, 'rgba(0,0,0,0.4)');
      curbShade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = curbShade;
      ctx.fillRect(0, roadTop + 3, WIDTH, 24);
      const dash = 70;
      const dStart = Math.floor(road / dash);
      const farLane = roadTop + Math.round((GROUND_Y - roadTop) / 2);
      const nearLane = GROUND_Y + Math.round((roadBottom - GROUND_Y) / 2);
      for (let i = dStart; i < dStart + Math.ceil(WIDTH / dash) + 2; i++) {
        const dx = i * dash - road;
        // double yellow centre line right under the running line
        ctx.fillStyle = 'rgba(202, 160, 60, 0.4)';
        ctx.fillRect(dx, GROUND_Y + 3, 44, 3);
        ctx.fillRect(dx, GROUND_Y + 10, 44, 3);
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(203, 213, 225, 0.16)';
          ctx.fillRect(dx, farLane, 34, 3);
          ctx.fillRect(dx, nearLane, 34, 3);
        }
      }
      const mh = 900;
      const mhStart = Math.floor(road / mh);
      for (let i = mhStart; i < mhStart + 2; i++) {
        const mx = i * mh - road + 420;
        const my = i % 2 === 0 ? GROUND_Y + 55 : roadTop + 40;
        ctx.fillStyle = '#16181f';
        ctx.beginPath(); ctx.ellipse(mx, my, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(mx, my, 20, 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const cw = 2400;
      const cwStart = Math.floor(road / cw);
      for (let i = cwStart; i < cwStart + 2; i++) {
        const cx = i * cw - road + 1200;
        ctx.fillStyle = 'rgba(203, 213, 225, 0.14)';
        for (let k = 0; k < 8; k++) ctx.fillRect(cx + k * 20, roadTop + 12, 11, roadBottom - roadTop - 22);
      }
      if (s.weather.wetness > 0) {
        ctx.fillStyle = `rgba(10, 14, 28, ${0.35 * s.weather.wetness})`;
        ctx.fillRect(0, roadTop, WIDTH, roadBottom - roadTop);
        const sheen = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
        sheen.addColorStop(0, `rgba(255,255,255,${0.08 * s.weather.wetness})`);
        sheen.addColorStop(1, 'transparent');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, roadTop, WIDTH, roadBottom - roadTop);
      }

      // ---- 7. Near curb + sidewalk filling the extra ground on tall screens
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, roadBottom, WIDTH, 10);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, roadBottom, WIDTH, 3);
      if (VB > roadBottom + 10) {
        const walkTop = roadBottom + 10;
        const walk = ctx.createLinearGradient(0, walkTop, 0, VB);
        walk.addColorStop(0, '#111827');
        walk.addColorStop(1, '#05070f');
        ctx.fillStyle = walk;
        ctx.fillRect(0, walkTop, WIDTH, VB - walkTop);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.lineWidth = 2;
        const tile = 80;
        const tStart = Math.floor(road / tile);
        for (let i = tStart; i < tStart + Math.ceil(WIDTH / tile) + 2; i++) {
          const tx = i * tile - road;
          ctx.beginPath(); ctx.moveTo(tx, walkTop); ctx.lineTo(tx - 30, VB); ctx.stroke();
        }
        for (let ty = walkTop + 50; ty < VB; ty += 60) {
          ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(WIDTH, ty); ctx.stroke();
        }
        // pools of lamp light on the near sidewalk
        for (let i = lpStart; i < lpStart + Math.ceil(WIDTH / lampSpacing) + 2; i++) {
          const lx = i * lampSpacing - lampX + 80;
          const pool = ctx.createRadialGradient(lx, walkTop + 40, 5, lx, walkTop + 40, 140);
          pool.addColorStop(0, 'rgba(253, 224, 71, 0.10)');
          pool.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = pool;
          ctx.fillRect(lx - 140, walkTop, 280, Math.min(200, VB - walkTop));
        }
      }
    };
    
    const drawWeather = (ctx: CanvasRenderingContext2D) => {
      const s = state.current;
      if (s.weather.type === 'NONE' || s.weather.intensity <= 0) return;
      
      ctx.save();
      if (s.weather.type === 'RAIN') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * s.weather.intensity})`;
        ctx.lineWidth = 1.5;
        s.weather.raindrops.forEach(drop => {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - drop.len * 0.5, drop.y + drop.len); // angled rain
          ctx.stroke();
          
          drop.x -= (drop.speed * 0.5 + s.speed);
          drop.y += drop.speed;
          
          if (drop.y > HEIGHT + s.view.bottom) {
            drop.y = -s.view.top - drop.len;
            drop.x = Math.random() * WIDTH * 1.5;
          }
        });
      } else if (s.weather.type === 'FOG') {
        const intensity = s.weather.intensity;
        
        // Rolling ground fog (smoke-like)
        for (let i = 0; i < 4; i++) {
           const parallax = 0.5 + i * 0.2; // Different layers move at different speeds
           const worldOffset = (s.bg.floor * parallax) + (s.frames * (1 + i * 0.5));
           const fogSpacing = 500;
           
           const startIdx = Math.floor(worldOffset / fogSpacing);
           
           ctx.fillStyle = `rgba(220, 226, 230, ${(0.08 + i * 0.02) * intensity})`;
           
           for (let j = startIdx; j < startIdx + Math.ceil(WIDTH / fogSpacing) + 2; j++) {
              const fogX = j * fogSpacing - worldOffset;
              
              // Pseudo-random height and wobble
              const wobble = Math.sin(j * 123.45 + s.frames * 0.02) * 20;
              const fogY = GROUND_Y - 10 + wobble;
              const fogW = 400 + (j % 3) * 100;
              const fogH = 80 + (j % 2) * 40;
              
              ctx.beginPath();
              ctx.ellipse(fogX, fogY, fogW/2, fogH/2, 0, 0, Math.PI * 2);
              ctx.fill();
           }
        }
      }
      ctx.restore();
    };


// Boss can only be hurt (or hurt you) while actually fighting — not while
// entering, talking, flashing from a previous hit, or playing its death anim.
function isBossVulnerable(s) {
  const st = s.boss.state;
  return s.boss.active && !s.boss.defeated && !s.boss.hidden && st !== 'HURT' && st !== 'ENTER' && st !== 'DIALOGUE' && st !== 'TUTORIAL' && st !== 'DEFEATED_ANIM';
}

function damageBoss(s, dmg: number, label?: string) {
  s.boss.hp -= dmg;
  s.boss.state = 'HURT';
  s.boss.timer = 0;
  audio.playHit();
  s.particles.push({ x: s.boss.x + s.boss.w / 2, y: s.boss.y - 10, vx: 0, vy: -1.5, life: 45, maxLife: 45, color: '#fca5a5', size: label ? 16 : 18, type: 'TEXT', text: label ? `${label} -${dmg}` : `-${dmg}` });
}

// Puff of smoke used whenever a ninja appears or vanishes
function ninjaPoof(s, x: number, y: number) {
  for (let p = 0; p < 18; p++) {
    s.particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 0.5, life: 28, maxLife: 28, color: p % 3 === 0 ? '#a78bfa' : '#94a3b8', size: Math.random() * 8 + 5 });
  }
}

// Ninja ambusher (Building Tops): appears in smoke, telegraphs, then attacks and vanishes.
//  DASH  - lunges along the roof at the cat (jump over it)
//  THROW - throws a shuriken, low (jump) or high (stay down)
//  DROP  - appears in the air, drops onto the roof, then lunges
function spawnNinja(s, variant: 'DASH' | 'THROW' | 'DROP', x: number, isClone = false) {
  const y = variant === 'DROP' ? 170 : GROUND_Y - 40;
  s.entities.push({ id: Math.random(), type: 'NINJA_AMBUSH', x, y, w: 40, h: 40, markedForDeletion: false, phase: 'APPEAR', timer: 0, variant, isClone, vy: 0 });
  ninjaPoof(s, x + 20, y + 20);
}

function destroyObstacle(ent, s, audio) {
  ent.crashed = true;
  ent.isDestroyed = true;
  s.stats.obstaclesDestroyed++;
  s.combo++;
  s.comboTimer = 180;
  audio.playDestroy();
  
  if (ent.type === 'OBSTACLE_CAR') {
    // Car explosion
    ent.vx = 2; // slow down
    ent.vy = 0;
    ent.rotSpeed = 0;
    ent.rotation = 0;
  } else {
    // Fly away
    ent.vx = 8 + Math.random() * 6;
    ent.vy = -8 - Math.random() * 6;
    ent.rotation = 0;
    ent.rotSpeed = (Math.random() - 0.5) * 0.4;
  }
  if (ent.type.startsWith('BOSS_')) {
    // Knocked back toward the boss. The arc follows the cat's own motion (rising
    // cat = higher lob), so landing a hit takes some aim.
    // Hit it while jumping UP to lob it far; a flat run-in usually falls short.
    ent.deflected = true;
    ent.bounces = 0;
    ent.vx = 8 + Math.random() * 6;
    ent.vy = Math.max(-14, Math.min(-4, -8 - Math.random() * 1.5 + s.cat.vy * 0.45));
    ent.rotSpeed = 0.3;
    if (!s.deflectTipShown) {
      s.deflectTipShown = true;
      s.particles.push({ x: WIDTH / 2, y: 250, vx: 0, vy: -0.2, life: 180, maxLife: 180, color: '#fde047', size: 20, type: 'TEXT', text: 'TIP: JUMP INTO IT TO LOB IT AT THE BOSS!' });
    }
  }
}

    // ---- First-encounter callouts ----
    // The first time the player meets something, the game freezes briefly, spotlights
    // it and points at it with a short tip. Each one shows once (remembered in the save).
    // Similar obstacles share one tip, so each kind of challenge is explained once
    const INTRO_GROUP: Record<string, string> = {
      OBSTACLE_TRASH: 'STATIC', OBSTACLE_BOX: 'STATIC', OBSTACLE_HYDRANT: 'STATIC', OBSTACLE_CONSTRUCTION: 'STATIC',
      OBSTACLE_SIGN: 'STATIC', OBSTACLE_AC_UNIT: 'STATIC', OBSTACLE_VENT: 'STATIC', OBSTACLE_DISH: 'STATIC',
      OBSTACLE_HURDLE: 'STATIC', OBSTACLE_CONES: 'STATIC', OBSTACLE_WATER_BOTTLE: 'STATIC', OBSTACLE_DUMBBELL: 'STATIC',
      OBSTACLE_CAR: 'MOVING', OBSTACLE_BICYCLE: 'MOVING', OBSTACLE_RUNNER: 'MOVING', OBSTACLE_MASCOT: 'MOVING',
      OBSTACLE_BIRD: 'FLYING', OBSTACLE_AIRPLANE: 'FLYING', OBSTACLE_TENNIS_BALL: 'FLYING',
      OBSTACLE_SOCCER_BALL: 'BOUNCY', OBSTACLE_FOOTBALL: 'BOUNCY', OBSTACLE_BASKETBALL: 'BOUNCY',
    };
    const introKey = (type: string) => INTRO_GROUP[type] || type;
    const INTROS: Record<string, [string, string]> = {
      STATIC: ['JUMP OVER IT!', 'Tap to jump. Tap twice for tall ones'],
      MOVING: ["IT'S COMING AT YOU!", 'Moving things are faster: jump early'],
      FLYING: ['FLYING!', 'Stay on the ground, or jump over it'],
      BOUNCY: ['BOUNCING BALL', 'Time your jump with the bounce'],
      OBSTACLE_GAP: ['GAP BETWEEN ROOFS!', "Jump across, or you'll fall"],
      NINJA_AMBUSH: ['NINJA AMBUSH!', 'Jump when it lunges, or stomp its head'],
      BOSS_SHURIKEN: ['SHURIKEN!', 'Jump low ones, stay down for high ones'],
      OBSTACLE_JAVELIN: ['JAVELIN!', 'It lands on the red mark'],
      // Pick-ups
      FISH: ['FISH!', 'Run into fish to collect them'],
      GOLDEN_FISH: ['INVINCIBLE FISH', 'Eat it to smash through anything'],
      POWERUP_SHIELD: ['SHIELD', 'Blocks one hit'],
      POWERUP_WINGS: ['WINGS', 'Hold to fly for a while'],
      POWERUP_TIME: ['SLOW TIME', 'Everything slows down'],
      POWERUP_CANNON: ['FISH CANNON', 'Fires fish at what is ahead'],
      BOSS_FOOTBALL_PICKUP: ['BALL', 'Grab it to kick it at the boss'],
      // Boss attacks
      BOSS_BULLET: ['BULLET!', 'Jump it, or smash it while invincible to send it back'],
      BOSS_MINION: ['HENCHMAN', 'Stomp it to kick it at the boss'],
      BOSS_VOLLEY_BALL: ['VOLLEY!', 'Lands on the red mark, then bounces at you'],
      // Bosses
      BOSS_mafia: ['MAFIA CAT', 'Smash his bullets & henchmen back at him'],
      BOSS_ninja: ['NINJA CAT', 'Block shurikens, stomp clones and his head'],
      BOSS_athlete: ['ATHLETE CAT', 'Kick balls at him, stomp him when he runs low'],
    };
    // Regular spawns = obstacles and pick-ups from the random spawner (not boss attacks or player shots)
    const isRegularSpawn = (e: Entity) =>
      e.type.startsWith('OBSTACLE') || e.type.startsWith('POWERUP') || e.type === 'FISH' || e.type === 'GOLDEN_FISH' || e.type === 'NINJA_AMBUSH';
    const isUnseen = (s: typeof state.current, e: Entity) => { const k = introKey(e.type); return !!INTROS[k] && !s.seenIntros.has(k); };
    // Keep the pace breathable: nothing spawns during a calm window, and a never-seen
    // thing only appears when no other new thing is around and the last tip was a while ago.
    const gateNewSpawns = (s: typeof state.current, from: number) => {
      if (s.entities.length <= from) return;
      const calm = s.frames < s.calmUntil;
      const fresh = s.entities.slice(from);
      s.entities.length = from;
      for (const e of fresh) {
        if (e.tutorial || !isRegularSpawn(e)) { s.entities.push(e); continue; }
        if (calm) continue;
        if (isUnseen(s, e)) {
          const anotherNew = s.entities.some(o => o !== e && !o.markedForDeletion && isUnseen(s, o));
          // Fish are the most basic thing, so they don't wait for the gap between tips
          const tooSoon = e.type !== 'FISH' && s.frames - s.lastIntroFrame < CALLOUT_SPACING_FRAMES;
          if (anotherNew || tooSoon) continue;
        }
        s.entities.push(e);
      }
    };
    const startCallout = (s: typeof state.current, key: string, ent: Entity | null, boss = false) => {
      const [title, sub] = INTROS[key];
      s.callout = { key, title, sub, t: 0, ent, boss, tapHeld: s.input.jump };
      s.lastIntroFrame = s.frames;
      if (ent) {
        // Make it the only thing coming: drop regular obstacles/pick-ups queued up behind it
        for (const e of s.entities) {
          if (e !== ent && e.x > ent.x + ent.w && !e.isDestroyed && isRegularSpawn(e)) e.markedForDeletion = true;
        }
      }
      s.seenIntros.add(key);
      setPlayerData(prev => prev.seenIntros?.includes(key) ? prev : { ...prev, seenIntros: [...(prev.seenIntros || []), key] });
      audio.playPowerup();
    };
    const checkCallouts = (s: typeof state.current) => {
      if (s.callout || s.transition || s.cat.dead) return;
      for (const e of s.entities) {
        if (e.isDestroyed || e.crashed || e.markedForDeletion || e.deflected) continue;
        if (!isUnseen(s, e)) continue;
        const cx = e.x + e.w / 2;
        // Once it's clearly on screen but still far enough ahead to react after the pause
        if (cx < WIDTH - 50 && cx > s.cat.x + 160) { startCallout(s, introKey(e.type), e); return; }
      }
    };
    // Returns true while the world should stay frozen
    const updateCallout = (s: typeof state.current) => {
      const c = s.callout;
      if (!c) return false;
      c.t++;
      const tapped = s.input.jump && !c.tapHeld;
      c.tapHeld = s.input.jump;
      if ((c.t > CALLOUT_MIN_FRAMES && tapped) || c.t > CALLOUT_MAX_FRAMES) {
        s.callout = null;
        s.input.prevJump = s.input.jump; // the tap that dismisses shouldn't also make the cat jump
        s.calmUntil = s.frames + CALLOUT_CALM_FRAMES; // a moment to deal with what was just shown
      }
      return true;
    };
    const drawCallout = (ctx: CanvasRenderingContext2D) => {
      const s = state.current;
      const c = s.callout;
      if (!c) return;
      let tx: number, ty: number, r: number;
      if (c.boss) { tx = s.boss.x + s.boss.w / 2; ty = s.boss.y + s.boss.h / 2; r = 50; }
      else if (c.ent) { tx = c.ent.x + c.ent.w / 2; ty = c.ent.y + Math.min(c.ent.h, 80) / 2; r = Math.min(90, Math.max(c.ent.w, Math.min(c.ent.h, 80)) * 0.75 + 24); }
      else return;
      const fade = Math.min(1, c.t / 8);
      ctx.save();
      // Spotlight: darken everything except a circle around the thing
      ctx.fillStyle = `rgba(0, 0, 0, ${0.62 * fade})`;
      ctx.beginPath();
      ctx.rect(0, -s.view.top, WIDTH, s.view.h);
      ctx.arc(tx, ty, r, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      const pulse = Math.sin(c.t * 0.25) * 4;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tx, ty, r + pulse, 0, Math.PI * 2); ctx.stroke();
      // Label above the thing (or below if there's no room), with an arrow to it
      let below = false;
      let ly = ty - r - 90;
      if (ly < 70 - s.view.top + s.view.hud) { ly = ty + r + 70; below = true; }
      const lx = Math.min(WIDTH - 250, Math.max(250, tx)); // keep the longer lines on screen
      const a0 = below ? ly - 36 : ly + 28;
      const a1 = below ? ty + r + 8 : ty - r - 8;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, a0); ctx.lineTo(tx, a1); ctx.stroke();
      const ang = Math.atan2(a1 - a0, tx - lx);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(tx, a1);
      ctx.lineTo(tx - Math.cos(ang - 0.45) * 14, a1 - Math.sin(ang - 0.45) * 14);
      ctx.lineTo(tx - Math.cos(ang + 0.45) * 14, a1 - Math.sin(ang + 0.45) * 14);
      ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#020617';
      // Shrink a line until it fits the screen width
      const fit = (text: string, size: number) => {
        ctx.font = 'bold ' + size + 'px monospace';
        while (size > 14 && ctx.measureText(text).width > WIDTH - 40) { size--; ctx.font = 'bold ' + size + 'px monospace'; }
      };
      // Centre each line on the arrow, but keep the whole line on screen
      const xFor = (text: string) => { const w = ctx.measureText(text).width; return Math.min(WIDTH - w / 2 - 16, Math.max(w / 2 + 16, lx)); };
      fit(c.title, 42);
      ctx.lineWidth = 8;
      const titleX = xFor(c.title);
      ctx.strokeText(c.title, titleX, ly - 10);
      ctx.fillStyle = '#fde047';
      ctx.fillText(c.title, titleX, ly - 10);
      fit(c.sub, 24);
      ctx.lineWidth = 6;
      const subX = xFor(c.sub);
      ctx.strokeText(c.sub, subX, ly + 22);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(c.sub, subX, ly + 22);
      if (c.t > CALLOUT_MIN_FRAMES) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
        ctx.fillText('TAP TO CONTINUE', lx, below ? ly + 52 : ly - 56);
      }
      ctx.restore();
    };

    const gameLoop = () => {
      const s = state.current;
      const cat = s.cat;

      // While a first-encounter callout is up, the world is frozen (drawing continues)
      const paused = s.paused || updateCallout(s);
      if (!paused) {
      s.frames++;
      // Handle combo
      if (s.comboTimer > 0) {
        s.comboTimer--;
        if (s.comboTimer === 0) s.combo = 0;
      }
      
      const multiplier = s.combo > 0 ? (1 + s.combo * 0.5) : 1;
      if (!s.boss.active) { s.score += (s.speed / BASE_SPEED) * multiplier; }

      // -- UPDATE --
      
      // Weather logic (change weather based on distance) - VERY SLOW TRANSITIONS
      if (s.map === 'Stadium') {
          s.weather.type = 'NONE';
          s.weather.intensity = 0;
          s.weather.wetness = Math.max(0, (s.weather.wetness || 0) - 0.005);
          
          // Spawn confetti randomly (reduced)
          if (s.frames % 90 === 0) {
              s.particles.push({
                 x: Math.random() * WIDTH * 1.2,
                 y: -s.view.top - 20,
                 vx: -s.speed * 0.2 + (Math.random() - 0.5) * 2,
                 vy: 1 + Math.random() * 2,
                 life: 300, maxLife: 300,
                 color: ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'][Math.floor(Math.random() * 6)],
                 size: Math.random() * 4 + 4,
                 type: 'confetti'
              });
          }
      } else {
          
          const cycle = s.score % 8000;
          if (cycle > 1000 && cycle < 3500) {
            s.weather.type = 'RAIN';
            s.weather.intensity = Math.min(1, (cycle - 1000) / 1000); // Takes 1000 score to reach full intensity (very slow)
          } else if (cycle > 5000 && cycle < 7500) {
            s.weather.type = 'FOG';
            s.weather.intensity = Math.min(1, (cycle - 5000) / 1000); // Takes 1000 score to reach full intensity
          } else {
            if (s.weather.type === 'RAIN' && s.weather.intensity > 0) {
                s.weather.intensity = Math.max(0, s.weather.intensity - 0.002);
                if (s.weather.intensity === 0) s.weather.type = 'NONE';
            } else if (s.weather.type === 'FOG' && s.weather.intensity > 0) {
                s.weather.intensity = Math.max(0, s.weather.intensity - 0.002);
                if (s.weather.intensity === 0) s.weather.type = 'NONE';
            } else {
                s.weather.type = 'NONE';
                s.weather.intensity = 0;
            }
          }
          
          // Update wetness more smoothly
          if (s.weather.type === 'RAIN') {
              s.weather.wetness = Math.min(1, (s.weather.wetness || 0) + 0.001 * s.weather.intensity);
          } else {
              s.weather.wetness = Math.max(0, (s.weather.wetness || 0) - 0.0005);
          }
      }
      
      // Cat Physics

      if (s.transition) {
        // Scripted scene change: the player just watches
        s.input.jump = false;
        s.input.prevJump = false;
        s.input.ability = false;
      }
      if (cat.dead) {
        // No more control once the cat is knocked out
        s.input.jump = false;
        s.input.prevJump = false;
        s.input.ability = false;
        if (!cat.deathStarted) {
          // Death animation: pop up, tumble, land and lie down while the screen fades
          cat.deathStarted = true;
          cat.vy = -9;
          cat.isGrounded = false;
          cat.stunTimer = DEATH_ANIM_FRAMES;
          cat.wingsTimer = 0;
          cat.goldenBoostTimer = 0;
          cat.fishCannonTimer = 0;
          audio.playMeow();
          for (let p = 0; p < 20; p++) {
            s.particles.push({ x: cat.x + cat.w / 2, y: cat.y + cat.h / 2, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 30, maxLife: 30, color: p % 2 ? '#fde047' : '#f8fafc', size: Math.random() * 4 + 2, type: 'sparkle' });
          }
        }
      }
      const effectiveJumpForce = cat.goldenBoostTimer > 0 ? JUMP_FORCE * 1.3 : JUMP_FORCE;
      
      if (cat.abilityCooldown > 0) cat.abilityCooldown--;
      
      if (cat.abilityTimer > 0) cat.abilityTimer--;

      const prevJump = s.input.prevJump;
      const canFly = cat.isFlyingGear || cat.wingsTimer > 0;

      // Wizard Fly
      if (s.input.jump && cat.catType === 'wizard' && cat.jumps >= 2 && cat.mana > 0 && cat.vy > -3) {
          cat.vy -= 1.0;
          cat.mana -= 1;
          if (s.frames % 10 === 0) audio.playJump();
          s.particles.push({
             x: cat.x + cat.w/2 - 10, y: cat.y + cat.h,
             vx: (Math.random()-0.5)*2, vy: 2 + Math.random()*2, life: 30, maxLife: 30, color: '#d8b4fe', size: Math.random()*3 + 2
          });
          s.particles.push({
             x: cat.x + cat.w/2 + 10, y: cat.y + cat.h,
             vx: (Math.random()-0.5)*2, vy: 2 + Math.random()*2, life: 30, maxLife: 30, color: '#c084fc', size: Math.random()*3 + 2
          });
      }

      if (s.input.jump && !prevJump) {
        if (cat.isGrounded) {
          cat.vy = effectiveJumpForce;
          cat.isGrounded = false;
          cat.jumps = 1;
          s.stats.totalJumps++;
          audio.playJump();
          for(let p=0; p<8; p++) {
             s.particles.push({ x: cat.x + cat.w/2, y: GROUND_Y, vx: (Math.random()-0.5)*5, vy: -Math.random()*3, life: 15, maxLife: 15, color: '#cbd5e1', size: Math.random()*4 + 2 });
          }
        } else if (cat.catType !== 'super' && (cat.jumps < 2 || (cat.catType === 'athlete' && cat.jumps < 3))) {
          cat.vy = effectiveJumpForce;
          cat.jumps++;
          s.stats.totalJumps++;
          audio.playJump();
          let burstColor = '#cbd5e1';
          if (cat.catType === 'ninja') burstColor = '#94a3b8';
          if (cat.catType === 'athlete') burstColor = '#38bdf8';
          for(let p=0; p<10; p++) {
             s.particles.push({ x: cat.x + cat.w/2, y: cat.y + cat.h, vx: (Math.random()-0.5)*8, vy: (Math.random()*4), life: 15, maxLife: 15, color: burstColor, size: Math.random()*3 + 2 });
          }
        }
      }
      if (s.input.jump && canFly && cat.vy > -5 && cat.catType !== "wizard") {
        cat.vy -= 1.5; // Flap up
        if (s.frames % 10 === 0) {
          audio.playJump();
        }
      }

      if (s.input.ability) {
        if (cat.catType === "ninja") {
          const hasActiveShuriken = s.entities.some(e => e.type === "SHURIKEN" && !e.markedForDeletion && !e.crashed);
          if (cat.abilityCooldown <= 0) { cat.abilityCooldown = 60;
            audio.playPowerup();
            audio.playMeow();
            s.entities.push({ type: "SHURIKEN", x: cat.x + cat.w, y: cat.y + 10, w: 20, h: 20, speed: -(s.speed + 10), markedForDeletion: false, crashed: false });
            for(let p=0; p<15; p++) {
              s.particles.push({ x: cat.x + cat.w, y: cat.y + 20, vx: (Math.random()*5), vy: (Math.random()-0.5)*5, life: 15, maxLife: 15, color: "#cbd5e1", size: Math.random()*3 + 1, type: "sparkle" });
            }
          }
        } else if (cat.catType === "wizard" && cat.mana >= 20) {
          cat.mana -= 20;
          audio.playPowerup();
          audio.playMeow();
          s.entities.push({ type: "FIREBALL", x: cat.x + cat.w, y: cat.y, w: 60, h: 40, speed: -(s.speed + 12), markedForDeletion: false, crashed: false });
          for(let p=0; p<20; p++) {
            s.particles.push({ x: cat.x + cat.w, y: cat.y + 20, vx: (Math.random()*8), vy: (Math.random()-0.5)*8, life: 20, maxLife: 20, color: "#ef4444", size: Math.random()*4 + 2 });
            s.particles.push({ x: cat.x + cat.w, y: cat.y + 20, vx: (Math.random()*8), vy: (Math.random()-0.5)*8, life: 20, maxLife: 20, color: "#f59e0b", size: Math.random()*4 + 2 });
          }
        }
        if (abilityHintRef.current) abilityHintRef.current.style.opacity = "0";
        s.input.ability = false;
      }

      s.input.prevJump = s.input.jump;

      cat.y += cat.vy;
      if (!cat.isGrounded) {
        cat.vy += GRAVITY;
      }
      
      if (cat.y + cat.h >= GROUND_Y && !cat.fellInGap) {
        cat.y = GROUND_Y - cat.h;
        cat.vy = 0;
        cat.isGrounded = true;
        cat.jumps = 0;
      }
      
      // ---- Area transition (stairs up to the rooftops / fade) ----
      if (s.transition) {
        const tr = s.transition;
        tr.t++;
        const roofFeet = GROUND_Y - STAIR_STEPS * STAIR_H;
        if (tr.kind === 'STAIRS' && tr.phase === 'CLIMB') {
          const sx = tr.stairX0 - s.bg.road;
          const rel = cat.x + cat.w / 2 - sx;
          if (rel >= 0) {
            // Step up one stair at a time as the cat reaches it
            const step = Math.min(STAIR_STEPS, Math.floor(rel / STAIR_W) + 1);
            cat.y = GROUND_Y - step * STAIR_H - cat.h;
            cat.vy = 0; cat.isGrounded = true; cat.jumps = 0;
            if (rel > STAIR_STEPS * STAIR_W + 120) { tr.phase = 'FADE_OUT'; tr.t = 0; }
          }
        } else if (tr.phase === 'FADE_OUT') {
          if (tr.kind === 'STAIRS') { cat.y = roofFeet - cat.h; cat.vy = 0; cat.isGrounded = true; }
          if (tr.t >= TRANSITION_FADE_FRAMES) {
            s.map = tr.target;
            s.mapTransitionTimer = s.frames;
            s.areaEntryScore = s.score;
            s.stadiumZone = undefined;
            s.ambushTimer = 240;
            cat.y = GROUND_Y - cat.h; cat.vy = 0; cat.isGrounded = true;
            s.entities = s.entities.filter(e => !e.type.startsWith('OBSTACLE'));
            s.transition = null;
          }
        }
      }

      if (cat.y < 0) {
        cat.y = 0;
        cat.vy = 0;
      }

      if (cat.stunTimer > 0) {
        cat.stunTimer--;
        s.speed = 0;
        if (cat.stunTimer <= 0 && cat.dead) {
           s.isGameOver = true;
        }
      } else if (cat.goldenBoostTimer > 0) {
        cat.goldenBoostTimer--;
        s.speed = BASE_SPEED * 1.5;
        if (s.frames % 3 === 0) {
          // Ember trail behind the aura
          s.particles.push({ x: cat.x + Math.random() * 10, y: cat.y + cat.h / 2 + (Math.random() - 0.5) * 30, vx: -s.speed * 0.6, vy: (Math.random() - 0.5) * 1.5, life: 22, maxLife: 22, color: Math.random() > 0.5 ? '#fb923c' : '#fde68a', size: Math.random() * 3 + 2 });
        }
      } else if (cat.timeSlowTimer > 0) {
        cat.timeSlowTimer--;
        s.speed = BASE_SPEED * 0.5; // Halve the speed
      } else {
        s.speed = Math.min(MAX_SPEED, BASE_SPEED + (s.frames * 0.001)); // Slowly increase base speed, capped so later stages stay playable
      }
      

      if (cat.wingsTimer > 0) {
        cat.wingsTimer--;
      }

      if (cat.fishCannonTimer > 0) {
        cat.fishCannonTimer--;
        if (cat.fishCannonTimer % 30 === 0) {
            audio.playHit();
            s.entities.push({
               id: s.frames + Math.random(), type: 'CANNON_FISH',
               x: cat.x + cat.w, y: cat.y + 10, w: 20, h: 10,
               vx: 15, vy: 0, markedForDeletion: false, crashed: false
            });
            for(let p=0; p<5; p++) {
                s.particles.push({
                  x: cat.x + cat.w, y: cat.y + 15,
                  vx: (Math.random() * 5), vy: (Math.random() - 0.5) * 5,
                  life: 10, maxLife: 10, color: '#ef4444', size: Math.random() * 3 + 1
                });
            }
        }
      }


      // Parallax updates
      s.bg.road = s.bg.road + s.speed;
      s.bg.cityNear = s.bg.cityNear + s.speed * 0.5;
      s.bg.cityFar = s.bg.cityFar + s.speed * 0.2;

      
      // ---- Run progression ----
      // City:    Mafia boss at 10,000m. Beating it moves the run into the Stadium
      //          (and unlocks the Stadium map the first time).
      // Stadium: Athlete boss 10,000m after entering the Stadium (at 20,000m in a
      //          full run, or 10,000m when the run starts on the Stadium map).
      const areaBoss = AREA_BOSS[s.map];
      const bossDue = (areaBoss && !s.transition && s.score - s.areaEntryScore >= BOSS_DISTANCE && !s.bossesBeaten[areaBoss]) ? areaBoss : null;
      if (bossDue && !s.boss.active) {
        s.boss.hidden = false;
        s.boss.type = bossDue;
        s.boss.active = true;
        s.boss.defeated = false;
        s.boss.maxHp = BOSS_HP[bossDue];
        s.boss.hp = s.boss.maxHp;
        s.boss.x = WIDTH + 100;
        s.boss.y = GROUND_Y - s.boss.h;
        s.boss.state = 'ENTER';
        s.boss.timer = 0;
        s.boss.attackPhase = 0;
        s.boss.dropTimer = 0;
        s.boss.dropCount = 0;
        audio.playBossAlert();
        audio.startBossMusic();
        // Clear obstacles to prepare
        s.entities.forEach(e => {
           if (e.type.startsWith('OBSTACLE')) e.markedForDeletion = true;
        });
      }

      // Boss Logic
      // Boss-fight drops. Mafia (1st boss) introduces the Invincible Fish;
      // Athlete (2nd boss) introduces the Fish Cannon alongside footballs.
      const bossFighting = s.boss.active && !s.boss.defeated && s.boss.state !== 'ENTER' && s.boss.state !== 'DIALOGUE' && s.boss.state !== 'TUTORIAL' && s.boss.state !== 'DEFEATED_ANIM';
      if (bossFighting) {
         s.boss.dropTimer = (s.boss.dropTimer || 0) + 1;
         const dropEvery = s.boss.type === 'athlete' ? 300 : s.boss.type === 'ninja' ? 360 : 420;
         if (s.boss.dropTimer >= dropEvery) {
            s.boss.dropTimer = 0;
            s.boss.dropCount = (s.boss.dropCount || 0) + 1;
            if (s.boss.type === 'ninja') {
                // Shields and invincibility let you smash shurikens back at him
                s.entities.push(s.boss.dropCount % 2 === 1
                   ? { id: s.frames + 7, type: 'POWERUP_SHIELD', x: WIDTH + 50, y: GROUND_Y - 60 - Math.random() * 40, w: 24, h: 24, markedForDeletion: false }
                   : { id: s.frames + 7, type: 'GOLDEN_FISH', x: WIDTH + 50, y: GROUND_Y - 70 - Math.random() * 40, w: 24, h: 24, markedForDeletion: false });
            } else if (s.boss.type === 'athlete') {
                if (s.boss.dropCount % 2 === 1) {
                    s.entities.push({
                       id: s.frames + 7, type: 'BOSS_FOOTBALL_PICKUP',
                       x: WIDTH + 50, y: GROUND_Y - 30, w: 30, h: 30, markedForDeletion: false
                    });
                } else {
                    s.entities.push({
                       id: s.frames + 7, type: 'POWERUP_CANNON',
                       x: WIDTH + 50, y: GROUND_Y - 60 - Math.random() * 40,
                       w: 30, h: 30, markedForDeletion: false
                    });
                }
            } else {
                s.entities.push({
                   id: s.frames + 7, type: 'GOLDEN_FISH',
                   x: WIDTH + 50, y: GROUND_Y - 70 - Math.random() * 40,
                   w: 24, h: 24, markedForDeletion: false
                });
            }
         }
      }

      if (s.boss.active) {

        s.boss.timer++;
        
        if (s.boss.state === 'ENTER' && s.boss.type === 'ninja') {
           // Drops out of the night sky onto the roof
           if (s.boss.timer === 1) { s.boss.x = WIDTH - 150; s.boss.y = -80; s.boss.vy = 0; }
           s.boss.vy += 0.8;
           s.boss.y += s.boss.vy;
           if (s.boss.y >= GROUND_Y - s.boss.h) {
              s.boss.y = GROUND_Y - s.boss.h;
              ninjaPoof(s, s.boss.x + 20, s.boss.y + 30);
              audio.playHit();
              s.boss.state = 'DIALOGUE';
              s.boss.timer = 0;
           }
        } else if (s.boss.state === 'ENTER') {
           s.boss.x -= 2;
           if (s.boss.x <= WIDTH - 150) {
              s.boss.state = 'DIALOGUE';
              s.boss.timer = 0;
           }

        } else if (s.boss.state === 'DIALOGUE') {
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.1) * 10;
           if (s.boss.timer === 1) {
              audio.playHit(); // Simple alert sound
           }
           if (s.boss.timer > 180) {
              s.boss.state = 'TUTORIAL';
              s.boss.timer = 0;
           }

        } else if (s.boss.state === 'IDLE') {
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.1) * 10;
           // Glide back to the home spot (e.g. after being hit mid-dash)
           s.boss.x += ((WIDTH - 150) - s.boss.x) * 0.1;
           if (s.boss.timer > 60 && Math.abs((WIDTH - 150) - s.boss.x) < 10) {
              const attacks = s.boss.type === 'ninja'
                 ? ['WINDUP_FAN', 'WINDUP_DIVE', 'WINDUP_CLONES']
                 : s.boss.type === 'athlete'
                 ? ['WINDUP_VOLLEY', 'WINDUP_SPRINT', 'WINDUP_JAVELIN']
                 : ['WINDUP_SHOOT', 'WINDUP_SUMMON', 'WINDUP_DASH'];
              const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
              s.boss.state = randomAttack;
              s.boss.timer = 0;
           }
        } else if (s.boss.state.startsWith('WINDUP_')) {
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.5) * 5;
           if (s.boss.timer > 30) {
              s.boss.state = s.boss.state.replace('WINDUP_', '');
              s.boss.timer = 0;
           }

        } else if (s.boss.state === 'TUTORIAL') {
           // "How to beat" card is on screen; send in the power-up that makes it possible.
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.1) * 4;
           if (s.boss.timer === 1 && !s.seenIntros.has('BOSS_' + s.boss.type)) startCallout(s, 'BOSS_' + s.boss.type, null, true);
           if (s.boss.timer === BOSS_STARTER_SPAWN_FRAME) {
              const starter: Entity = s.boss.type === 'mafia'
                 ? { id: s.frames + 31, type: 'GOLDEN_FISH', x: WIDTH + 20, y: GROUND_Y - 34, w: 24, h: 24, markedForDeletion: false, tutorial: true }
                 : s.boss.type === 'ninja'
                 ? { id: s.frames + 31, type: 'POWERUP_SHIELD', x: WIDTH + 20, y: GROUND_Y - 34, w: 24, h: 24, markedForDeletion: false, tutorial: true }
                 : { id: s.frames + 31, type: 'BOSS_FOOTBALL_PICKUP', x: WIDTH + 20, y: GROUND_Y - 30, w: 30, h: 30, markedForDeletion: false, tutorial: true };
              s.entities.push(starter);
           }
           if (s.boss.timer > BOSS_TUTORIAL_FRAMES) { s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'FAN') {
           // Three shurikens ~50 frames apart: low ones must be jumped, high ones
           // fly over a cat that stays on the ground.
           s.boss.y = GROUND_Y - s.boss.h;
           if (s.boss.timer === 15 || s.boss.timer === 65 || s.boss.timer === 115) {
              const high = Math.random() < 0.45;
              s.entities.push({ id: s.frames + s.boss.timer, type: 'BOSS_SHURIKEN', x: s.boss.x - 10, y: high ? GROUND_Y - 80 : GROUND_Y - 30, w: 18, h: 18, markedForDeletion: false });
              audio.playJump();
           }
           if (s.boss.timer > 150) { s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'DIVE') {
           // Vanish, reappear high above the roof ahead of the cat (target marked),
           // slam down, then slash along the roof: jump it, or stomp his head.
           if (s.boss.timer === 1) { ninjaPoof(s, s.boss.x + 20, s.boss.y + 20); s.boss.hidden = true; s.boss.landed = false; }
           if (s.boss.timer === 22) { s.boss.hidden = false; s.boss.x = 330; s.boss.y = 110; s.boss.vy = 0; ninjaPoof(s, s.boss.x + 20, s.boss.y + 20); }
           if (s.boss.timer > 22 && s.boss.timer < 52) {
              s.boss.y = 110 + Math.sin(s.boss.timer * 0.4) * 4;
           } else if (s.boss.timer >= 52 && !s.boss.landed) {
              s.boss.vy += 1.4;
              s.boss.y += s.boss.vy;
              if (s.boss.y >= GROUND_Y - s.boss.h) {
                 s.boss.y = GROUND_Y - s.boss.h;
                 s.boss.landed = true;
                 s.boss.landTime = s.boss.timer;
                 audio.playHit();
                 for (let p = 0; p < 14; p++) s.particles.push({ x: s.boss.x + 20, y: GROUND_Y, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 4, life: 20, maxLife: 20, color: '#94a3b8', size: Math.random() * 4 + 2 });
              }
           } else if (s.boss.landed && s.boss.timer > s.boss.landTime + 14) {
              s.boss.x -= 13;
              if (s.boss.timer % 2 === 0) s.particles.push({ x: s.boss.x + 40, y: s.boss.y + 20 + (Math.random() - 0.5) * 20, vx: 3, vy: 0, life: 10, maxLife: 10, color: '#c4b5fd', size: 3 });
              if (s.boss.x < -60) {
                 s.boss.hidden = true;
                 s.boss.state = 'REAPPEAR';
                 s.boss.timer = 0;
              }
           }
        } else if (s.boss.state === 'CLONES') {
           // Shadow clones: he vanishes while three ninjas attack in turn.
           // Stomp a clone and it gets launched back toward him.
           if (s.boss.timer === 1) { ninjaPoof(s, s.boss.x + 20, s.boss.y + 20); s.boss.hidden = true; }
           if (s.boss.timer === 12) spawnNinja(s, 'DASH', 540, true);
           if (s.boss.timer === 70) spawnNinja(s, Math.random() < 0.5 ? 'DROP' : 'THROW', 600, true);
           if (s.boss.timer === 128) spawnNinja(s, 'DASH', 560, true);
           if (s.boss.timer > 175) { s.boss.state = 'REAPPEAR'; s.boss.timer = 0; }
        } else if (s.boss.state === 'REAPPEAR') {
           if (s.boss.timer === 15) {
              s.boss.x = WIDTH - 150;
              s.boss.y = GROUND_Y - s.boss.h;
              s.boss.hidden = false;
              ninjaPoof(s, s.boss.x + 20, s.boss.y + 20);
              s.boss.state = 'IDLE';
              s.boss.timer = 0;
           }
        } else if (s.boss.state === 'SHOOT') {
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.1) * 10;
           // Shots are ~55 frames apart (~385px at bullet speed) so there is
           // always room to land between two shots and jump again.
           if (s.boss.timer === 20 || s.boss.timer === 75 || s.boss.timer === 130) {
              audio.playHit();
              // Fixed low lane so every bullet is jumpable and predictable
              s.entities.push({
                 id: s.frames + s.boss.timer, type: 'BOSS_BULLET',
                 x: s.boss.x, y: GROUND_Y - 34, w: 20, h: 20,
                 vx: -4, vy: 0, markedForDeletion: false
              });
              for (let p = 0; p < 8; p++) {
                 s.particles.push({ x: s.boss.x - 20, y: GROUND_Y - 24, vx: -Math.random() * 4, vy: (Math.random() - 0.5) * 3, life: 12, maxLife: 12, color: '#fbbf24', size: Math.random() * 3 + 2 });
              }
           }
           if (s.boss.timer > 160) { s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'SUMMON') {
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.2) * 15;
           if (s.boss.timer === 20 || s.boss.timer === 75 || s.boss.timer === 130) {
              audio.playHit();
              const catTypes = ['default', 'orange', 'black', 'white'];
              const minionType = catTypes[Math.floor(Math.random() * catTypes.length)];
              s.entities.push({
                 id: s.frames + s.boss.timer, type: 'BOSS_MINION',
                 x: s.boss.x, y: GROUND_Y - 30, w: 30, h: 30,
                 vx: -8, vy: -10, markedForDeletion: false, catType: minionType
              });
           }
           if (s.boss.timer > 160) {
               s.boss.state = 'IDLE';
               s.boss.timer = 0;
           }
        } else if (s.boss.state === 'DASH') {
           // Mafia charge
           if (s.boss.timer < 60) {
              s.boss.y = GROUND_Y - s.boss.h;
              s.boss.x += Math.sin(s.boss.timer * 0.5) * 5;
           } else if (s.boss.timer < 90) {
              s.boss.x -= 20; // sweep through the cat's lane (to x≈50): jump it or stomp it
           } else if (s.boss.timer < 150) {
              s.boss.x += 10;
           } else {
              s.boss.x = WIDTH - 150;
              s.boss.state = 'IDLE';
              s.boss.timer = 0;
           }
        } else if (s.boss.state === 'VOLLEY') {
           // Athlete: kicks 3 balls high into the air. Each lands on a marked spot
           // ahead of the cat, then bounces along the track toward it.
           s.boss.y = GROUND_Y - s.boss.h;
           if (s.boss.timer === 12 || s.boss.timer === 57 || s.boss.timer === 102) {
              const x0 = s.boss.x - 10;
              const y0 = GROUND_Y - 26;
              const targetX = 230 + Math.random() * 140;
              s.entities.push({
                 id: s.frames + s.boss.timer, type: 'BOSS_VOLLEY_BALL',
                 x: x0, y: y0, w: 26, h: 26, markedForDeletion: false,
                 vx: (targetX - x0) / VOLLEY_FLIGHT_FRAMES, vy: -0.5 * VOLLEY_GRAVITY * VOLLEY_FLIGHT_FRAMES,
                 targetX, landed: false
              });
              audio.playJump();
              for (let p = 0; p < 6; p++) s.particles.push({ x: x0, y: GROUND_Y - 6, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 3, life: 14, maxLife: 14, color: '#fca5a5', size: Math.random() * 3 + 2 });
           }
           if (s.boss.timer > 150) { s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'SPRINT') {
           // Athlete: hurdler sprint across the track in a steady rhythm of leaps.
           // Stay down while he leaps over you; jump (or stomp him) when he's low.
           if (s.boss.timer === 1) s.boss.sprintPhase = Math.floor(Math.random() * SPRINT_STRIDE); // vary where in his stride he meets you
           s.boss.x -= SPRINT_SPEED;
           const cyc = (s.boss.timer + s.boss.sprintPhase) % SPRINT_STRIDE;
           const leaping = cyc < SPRINT_LEAP;
           s.boss.y = GROUND_Y - s.boss.h - (leaping ? Math.sin((cyc / SPRINT_LEAP) * Math.PI) * SPRINT_LEAP_HEIGHT : 0);
           if (!leaping && s.frames % 2 === 0) s.particles.push({ x: s.boss.x + 30, y: GROUND_Y, vx: 2, vy: -Math.random() * 2, life: 12, maxLife: 12, color: '#fca5a5', size: Math.random() * 3 + 1 });
           if (s.boss.x < -60) {
              // Lap complete: jog back in from the right
              s.boss.x = WIDTH + 40;
              s.boss.y = GROUND_Y - s.boss.h;
              s.boss.state = 'RETURN';
              s.boss.timer = 0;
           }
        } else if (s.boss.state === 'RETURN') {
           s.boss.y = GROUND_Y - s.boss.h;
           s.boss.x -= 4;
           if (s.boss.x <= WIDTH - 150) { s.boss.x = WIDTH - 150; s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'JAVELIN') {
           // Athlete: hurls 3 javelins skyward; they drop onto marked spots and stick
           // in the track, so you jump each one as it scrolls in.
           s.boss.y = GROUND_Y - s.boss.h;
           if (s.boss.timer === 10 || s.boss.timer === 55 || s.boss.timer === 100) {
              const target = 250 + Math.random() * 180;
              // Work out where to release it so it lands on `target`
              let py = 40, vy = JAVELIN_VY0, drift = 0;
              while (py + 16 < GROUND_Y) { vy += JAVELIN_GRAVITY; py += vy; drift += JAVELIN_DRIFT; }
              s.entities.push({ id: s.frames + s.boss.timer, type: 'OBSTACLE_JAVELIN', x: target + drift, y: 40, w: 16, h: 16, vy: JAVELIN_VY0, targetX: target, markedForDeletion: false });
              audio.playJump();
              for (let p = 0; p < 8; p++) s.particles.push({ x: s.boss.x + 10, y: s.boss.y, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 4, life: 18, maxLife: 18, color: '#e2e8f0', size: Math.random() * 2 + 1 });
           }
           if (s.boss.timer > 150) { s.boss.state = 'IDLE'; s.boss.timer = 0; }
        } else if (s.boss.state === 'HURT') {
           s.boss.hidden = false;
           s.boss.landed = false;
           s.boss.x += ((WIDTH - 150) - s.boss.x) * 0.06;
           s.boss.y += ((GROUND_Y - s.boss.h) - s.boss.y) * 0.2;
           if (s.boss.timer > 30) {
              if (s.boss.hp <= 0) {
                 s.boss.state = 'DEFEATED_ANIM';
                 s.boss.timer = 0;
                 audio.stopBossMusic();
                 audio.playDestroy();
              } else {
                 s.boss.state = 'IDLE';
                 s.boss.timer = 0;
              }
           }
        } else if (s.boss.state === 'DEFEATED_ANIM') {
           s.boss.x += 1;
           s.boss.y = GROUND_Y - s.boss.h + Math.sin(s.boss.timer * 0.5) * 20;
           
           if (s.boss.timer % 10 === 0) {
              audio.playHit();
              s.particles.push({
                 x: s.boss.x + Math.random()*40, y: s.boss.y + Math.random()*40,
                 vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                 life: 30, maxLife: 30, color: '#ef4444', size: Math.random()*20 + 10
              });
           }
           
           if (s.boss.timer > 200) {
               s.boss.active = false;
               s.boss.defeated = true;
               const defeatedType = s.boss.type;
               s.bossesBeaten[defeatedType] = true;
               setPlayerData(prev => {
                 const baseStats = {
                   ...prev.stats,
                   totalDistance: prev.stats?.totalDistance || 0,
                   totalYarns: prev.stats?.totalYarns || 0,
                   totalObstacles: prev.stats?.totalObstacles || 0,
                 };
                 if (defeatedType === 'ninja') {
                   // 2nd boss: unlocks the Stadium and the Ninja cat
                   const maps = [...(prev.unlockedMaps || ['City'])];
                   if (!maps.includes('Stadium')) maps.push('Stadium');
                   const colors = [...(prev.ownedColors || ['default'])];
                   if (!colors.includes('ninja')) colors.push('ninja');
                   return { ...prev, unlockedMaps: maps, ownedColors: colors, stats: { ...baseStats, rooftopBossDefeated: true } };
                 }
                 if (defeatedType === 'athlete') {
                   // 3rd boss: unlocks the Athlete cat and the Fish Cannon in normal runs
                   const colors = [...(prev.ownedColors || ['default'])];
                   if (!colors.includes('athlete')) colors.push('athlete');
                   return { ...prev, ownedColors: colors, stats: { ...baseStats, stadiumBossDefeated: true, cannonUnlocked: true } };
                 }
                 // 1st boss: unlocks Building Tops, Mafia cat, and Invincible Fish / Slow Time in normal runs
                 const maps = [...(prev.unlockedMaps || ['City'])];
                 if (!maps.includes('Rooftop')) maps.push('Rooftop');
                 const colors = [...(prev.ownedColors || ['default'])];
                 if (!colors.includes('mafia')) colors.push('mafia');
                 return { ...prev, unlockedMaps: maps, ownedColors: colors, stats: { ...baseStats, bossDefeated: true } };
               });
               s.score += 500;
               for(let i=0;i<50;i++) {
                 s.particles.push({ x: s.boss.x + 40, y: s.boss.y + 20, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 60, maxLife: 60, color: '#f59e0b' });
               }
               audio.playDestroy();
               // Beating an area's boss moves the run on to the next area
               if (defeatedType === 'mafia' && s.map === 'City') {
                 // Run up the fire-escape stairs onto the building tops
                 s.transition = { kind: 'STAIRS', target: 'Rooftop', t: 0, phase: 'CLIMB', stairX0: s.bg.road + WIDTH + 120 };
               } else if (defeatedType === 'ninja' && s.map === 'Rooftop') {
                 s.transition = { kind: 'FADE', target: 'Stadium', t: 0, phase: 'FADE_OUT', stairX0: 0 };
               } else if (defeatedType === 'athlete') {
                 // Last stage so far: tell the player more is coming, let them keep running or finish
                 s.paused = true;
                 setShowStage4(true);
               }
               if (s.transition) s.entities.forEach(e => { if (e.type.startsWith('OBSTACLE')) e.markedForDeletion = true; });
           }
        }
      }

      // Spawning
      const spawnStart = s.entities.length; // everything pushed from here to the gate below is a regular spawn

      if (!s.boss.active && !s.transition && s.frames % Math.floor(Math.random() * 60 + 60) === 0) {

        const STAGE_LENGTH = 2000;
        const distanceStage = Math.floor(s.score / STAGE_LENGTH) % 4; 
        let obstacleType: Entity['type'] = 'OBSTACLE_CAR';
        let w = 60, h = 30;
        let y = GROUND_Y - h;
        let color = '#3b82f6';
        
        const rand = Math.random();
        
        let spawnX = WIDTH;
        let targetX: number | undefined;
        if (s.map === 'Rooftop') {
            // Gaps between buildings are the signature hazard up here
            if (rand > 0.72) {
                obstacleType = 'OBSTACLE_GAP';
                w = 70 + Math.floor(Math.random() * 45); h = 10;
                y = GROUND_Y;
            } else if (rand > 0.5) {
                obstacleType = 'OBSTACLE_AC_UNIT';
                w = 52; h = 40;
                y = GROUND_Y - h;
            } else if (rand > 0.32) {
                obstacleType = 'OBSTACLE_VENT';
                w = 28; h = 58;
                y = GROUND_Y - h;
            } else if (rand > 0.15) {
                obstacleType = 'OBSTACLE_DISH';
                w = 42; h = 46;
                y = GROUND_Y - h;
            } else {
                obstacleType = 'OBSTACLE_BIRD'; // pigeons
                w = 40; h = 30;
                y = GROUND_Y - 90 - Math.random() * 40;
            }
        } else if (s.map === 'Stadium') {
            // Three rotating zones so the Stadium keeps changing as you run
            const zone = Math.floor(Math.max(0, s.score - s.areaEntryScore) / 1500) % 3;
            const zoneNames = ['TRACK ZONE', 'FIELD ZONE', 'COURT ZONE'];
            if (s.stadiumZone !== zone) {
                if (s.stadiumZone !== undefined) {
                    s.particles.push({ x: WIDTH / 2, y: 230, vx: 0, vy: -0.3, life: 120, maxLife: 120, color: '#fde047', size: 30, type: 'TEXT', text: zoneNames[zone] });
                }
                s.stadiumZone = zone;
            }
            const pick = (table: [Entity['type'], number][]) => {
                let acc = 0;
                for (const [type, weight] of table) { acc += weight; if (rand < acc) return type; }
                return table[table.length - 1][0];
            };
            if (zone === 0) {
                obstacleType = pick([['OBSTACLE_HURDLE', 0.3], ['OBSTACLE_RUNNER', 0.25], ['OBSTACLE_CONES', 0.2], ['OBSTACLE_JAVELIN', 0.15], ['OBSTACLE_WATER_BOTTLE', 0.1]]);
            } else if (zone === 1) {
                obstacleType = pick([['OBSTACLE_FOOTBALL', 0.25], ['OBSTACLE_SOCCER_BALL', 0.25], ['OBSTACLE_MASCOT', 0.2], ['OBSTACLE_JAVELIN', 0.15], ['OBSTACLE_CONES', 0.15]]);
            } else {
                obstacleType = pick([['OBSTACLE_BASKETBALL', 0.25], ['OBSTACLE_TENNIS_BALL', 0.25], ['OBSTACLE_DUMBBELL', 0.2], ['OBSTACLE_RUNNER', 0.15], ['OBSTACLE_MASCOT', 0.15]]);
            }
            const sizes: Partial<Record<Entity['type'], [number, number]>> = {
                OBSTACLE_HURDLE: [46, 56], OBSTACLE_RUNNER: [40, 55], OBSTACLE_CONES: [74, 26],
                OBSTACLE_WATER_BOTTLE: [20, 40], OBSTACLE_FOOTBALL: [30, 30], OBSTACLE_SOCCER_BALL: [26, 26],
                OBSTACLE_MASCOT: [48, 72], OBSTACLE_BASKETBALL: [28, 28], OBSTACLE_TENNIS_BALL: [20, 20],
                OBSTACLE_DUMBBELL: [44, 22], OBSTACLE_JAVELIN: [16, 16],
            };
            [w, h] = sizes[obstacleType] || [40, 40];
            y = GROUND_Y - h;
            if (obstacleType === 'OBSTACLE_TENNIS_BALL') y = GROUND_Y - h - 100;
            if (obstacleType === 'OBSTACLE_JAVELIN') {
                // Thrown in from above; lands ahead of the cat. Pre-compute the landing
                // spot so we can show a warning marker on the track.
                spawnX = 520 + Math.random() * 220;
                y = 40;
                let px = spawnX, py = y, vy = JAVELIN_VY0;
                while (py + h < GROUND_Y) { vy += JAVELIN_GRAVITY; py += vy; px -= JAVELIN_DRIFT; }
                targetX = px;
            }
        } else if (distanceStage === 0) {
           if (rand > 0.6) {
             obstacleType = 'OBSTACLE_TRASH'; 
             w = 40; h = 50;
           } else if (rand > 0.4) {
             obstacleType = 'OBSTACLE_CAR'; 
             w = 80; h = 40;
           } else if (rand > 0.1) {
             obstacleType = 'OBSTACLE_CONSTRUCTION'; 
             w = 50; h = 45;
           } else {
             obstacleType = 'OBSTACLE_RUNNER'; 
             w = 40; h = 55;
           }
           y = GROUND_Y - h;
        } else if (distanceStage === 1) {
           if (rand > 0.7) {
             obstacleType = 'OBSTACLE_BIRD'; 
             w = 40; h = 30;
             y = GROUND_Y - 100 - Math.random() * 50;
           } else if (rand > 0.4) {
             obstacleType = 'OBSTACLE_CAR'; 
             w = 80; h = 40;
             y = GROUND_Y - h;
           } else if (rand > 0.1) {
             obstacleType = 'OBSTACLE_BICYCLE'; 
             w = 60; h = 55;
             y = GROUND_Y - h;
           } else {
             obstacleType = 'OBSTACLE_RUNNER'; 
             w = 40; h = 55;
             y = GROUND_Y - h;
           }
        } else if (distanceStage === 2) {
           if (rand > 0.5) {
             obstacleType = 'OBSTACLE_CAR'; 
             w = 80; h = 40;
             y = GROUND_Y - h;
           } else if (rand > 0.2) {
             obstacleType = 'OBSTACLE_CONSTRUCTION'; 
             w = 50; h = 45;
             y = GROUND_Y - h;
           } else if (rand > 0.02 && rand < 0.05) {
             obstacleType = 'OBSTACLE_AIRPLANE';
             w = 80; h = 40;
             y = 50 + Math.random() * 100;
           } else {
             obstacleType = 'OBSTACLE_SIGN'; 
             w = 40; h = 60;
             y = GROUND_Y - h;
           }
        } else {
           if (rand > 0.6) {
             obstacleType = 'OBSTACLE_CAR'; 
             w = 80; h = 45;
             y = GROUND_Y - h;
           } else if (rand > 0.55) {
             obstacleType = 'OBSTACLE_AIRPLANE';
             w = 80; h = 40;
             y = 30 + Math.random() * 100;
           } else if (rand > 0.2) {
             obstacleType = 'OBSTACLE_TRASH'; 
             w = 40; h = 50;
             y = GROUND_Y - h;
           } else {
             obstacleType = 'OBSTACLE_BOX'; 
             w = 50; h = 50;
             y = GROUND_Y - h;
           }
        }

        s.entities.push({
          id: s.frames,
          type: obstacleType,
          x: spawnX,
          y, w, h,
          targetX,
          vy: obstacleType === 'OBSTACLE_JAVELIN' ? JAVELIN_VY0 : undefined,
          markedForDeletion: false,
          color
        });
      }
      
      if (!s.boss.active && !s.transition && s.frames % Math.floor(Math.random() * 100 + 50) === 0) {
        // Spawn Fish
        s.entities.push({
          id: s.frames + 1,
          type: 'FISH',
          x: WIDTH + 100,
          y: GROUND_Y - 40 - Math.random() * 150,
          w: 20,
          h: 20,
          markedForDeletion: false
        });
      }

      // Power-up progression: Shield + Wings from the start; Invincible Fish and
      // Slow Time after the 1st boss; Fish Cannon after the 2nd boss.
      const firstBossBeaten = !!playerData.stats?.bossDefeated || s.bossesBeaten.mafia;
      const secondBossBeaten = !!playerData.stats?.stadiumBossDefeated || s.bossesBeaten.athlete;

      if (firstBossBeaten && !s.boss.active && s.frames % 1000 === 0) {
        // Spawn Golden Fish
        s.entities.push({
          id: s.frames + 2,
          type: 'GOLDEN_FISH',
          x: WIDTH + 200,
          y: GROUND_Y - 150,
          w: 24,
          h: 24,
          markedForDeletion: false
        });
      }

      if (!s.transition && s.frames % 1200 === 0) {
        // Spawn Shield
        s.entities.push({
          id: s.frames + 3,
          type: 'POWERUP_SHIELD',
          x: WIDTH + 200,
          y: GROUND_Y - 60 - Math.random() * 60,
          w: 24,
          h: 24,
          markedForDeletion: false
        });
      }

      if (!s.transition && s.frames % 1800 === 0) {
        // Spawn Wings
        s.entities.push({
          id: s.frames + 4,
          type: 'POWERUP_WINGS',
          x: WIDTH + 200,
          y: GROUND_Y - 120 - Math.random() * 50,
          w: 24,
          h: 24,
          markedForDeletion: false
        });
      }

      if (firstBossBeaten && !s.boss.active && s.frames % 2100 === 0) {
        // Spawn Time Slow
        s.entities.push({
          id: s.frames + 5,
          type: 'POWERUP_TIME',
          x: WIDTH + 200,
          y: GROUND_Y - 80 - Math.random() * 40,
          w: 24,
          h: 24,
          markedForDeletion: false
        });
      }

      if (secondBossBeaten && !s.boss.active && s.frames % 2500 === 0) {
        // Spawn Cannon
        s.entities.push({
          id: s.frames + 6,
          type: 'POWERUP_CANNON',
          x: WIDTH + 200,
          y: GROUND_Y - 100 - Math.random() * 40,
          w: 30,
          h: 30,
          markedForDeletion: false
        });
      }


      
      // Ninja ambushes on the Building Tops (every ~5-9s, not during boss fights)
      if (s.map === 'Rooftop' && !s.boss.active && !s.transition && !cat.dead) {
        s.ambushTimer--;
        if (s.ambushTimer <= 0) {
          const r = Math.random();
          if (r < 0.4) spawnNinja(s, 'DASH', 520 + Math.random() * 120);
          else if (r < 0.75) spawnNinja(s, 'THROW', 650 + Math.random() * 80);
          else spawnNinja(s, 'DROP', 480 + Math.random() * 80);
          s.ambushTimer = 300 + Math.floor(Math.random() * 240);
        }
      }

      gateNewSpawns(s, spawnStart);

      // Mafia Cat passive ability
      if (cat.catType === 'mafia' && !cat.hasShield && !cat.dead) {
         cat.mafiaMinionTimer++;
         if (cat.mafiaMinionTimer > 600) { // every 10 seconds at 60fps
            cat.hasShield = true;
            cat.mafiaMinionTimer = 0;
            cat.minionType = ['orange', 'black', 'white', 'gray'][Math.floor(Math.random() * 4)];
            audio.playPowerup();
            for(let p=0; p<15; p++) {
              s.particles.push({ x: cat.x + cat.w + 20, y: cat.y + 20, vx: (Math.random()*5), vy: (Math.random()-0.5)*5, life: 25, maxLife: 25, color: "#8b5cf6", size: Math.random()*3 + 1, type: "sparkle" });
            }
         }
      }
      
      // Boss <-> Player collision (once per frame, independent of other entities)
      {
        const m = 5;
        if (
          !cat.dead && cat.stunTimer === 0 && isBossVulnerable(s) &&
          cat.x + m < s.boss.x + s.boss.w - m &&
          cat.x + cat.w - m > s.boss.x + m &&
          cat.y + m < s.boss.y + s.boss.h - m &&
          cat.y + cat.h - m > s.boss.y + m
        ) {
           // Stomp if the cat was above the boss's head last frame and is falling
           // (robust even when fall speed is larger than the head's thickness)
           if (cat.vy > 0 && cat.y + cat.h - cat.vy <= s.boss.y + 12) {
              // Jump on boss head
              cat.vy = -12;
              damageBoss(s, 10, 'HEAD STOMP!');
           } else if (cat.goldenBoostTimer > 0) {
              damageBoss(s, 8);
           } else if (cat.catType === "super" && cat.superHealth > 0) {
              cat.superHealth -= 30;
              damageBoss(s, 15);
           } else if (cat.hasShield) {
              cat.hasShield = false;
              cat.stunTimer = 15;
           } else {
              audio.playHit();
              if (cat.lives > 1) { cat.lives--; cat.stunTimer = 45; }
              else { cat.dead = true; audio.stopBossMusic(); cat.stunTimer = 60; }
           }
        }
      }

      // Update Entities & Collisions

      for (let i = s.entities.length - 1; i >= 0; i--) {
        const ent = s.entities[i];
        
        // Move
        if (ent.isDestroyed) {
          ent.x += ent.vx || 0;
          ent.y += ent.vy || 0;
          if (ent.vy !== undefined) ent.vy += GRAVITY;
          if (ent.rotation !== undefined && ent.rotSpeed !== undefined) {
             ent.rotation += ent.rotSpeed;
          }
          if (ent.deflected) {
             // Bounce along the ground, losing energy each time
             if (ent.y + ent.h >= GROUND_Y && (ent.vy || 0) > 0) {
                ent.y = GROUND_Y - ent.h;
                ent.vy = -(ent.vy || 0) * 0.45;
                ent.vx = (ent.vx || 0) * 0.75;
                ent.rotSpeed = (ent.rotSpeed || 0) * 0.7;
                ent.bounces = (ent.bounces || 0) + 1;
                for (let p = 0; p < 4; p++) s.particles.push({ x: ent.x + ent.w/2, y: GROUND_Y, vx: (Math.random()-0.5)*4, vy: -Math.random()*2, life: 12, maxLife: 12, color: '#94a3b8', size: Math.random()*3 + 1 });
                if (ent.bounces >= 2 || Math.abs(ent.vy) < 2.5) {
                   // Out of energy: poof
                   ent.markedForDeletion = true;
                   for (let p = 0; p < 8; p++) s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*4, vy: -Math.random()*3, life: 20, maxLife: 20, color: '#cbd5e1', size: Math.random()*4 + 2 });
                }
             }
             // Only an actual touch hurts the boss
             const bossCanBeHit = s.boss.active && s.boss.hp > 0 && (isBossVulnerable(s) || s.boss.state === 'HURT');
             if (!ent.markedForDeletion && bossCanBeHit &&
                 ent.x < s.boss.x + s.boss.w && ent.x + ent.w > s.boss.x &&
                 ent.y < s.boss.y + s.boss.h && ent.y + ent.h > s.boss.y) {
                damageBoss(s, ent.type === 'BOSS_MINION' || ent.type === 'NINJA_AMBUSH' ? 10 : 8, 'DIRECT HIT!');
                ent.markedForDeletion = true;
                for (let p = 0; p < 16; p++) s.particles.push({ x: s.boss.x + s.boss.w/2, y: s.boss.y + s.boss.h/2, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 25, maxLife: 25, color: p % 2 ? '#facc15' : '#f97316', size: Math.random()*4 + 2, type: 'sparkle' });
             }
             if (ent.x > WIDTH + 40) ent.markedForDeletion = true;
          }
          if (ent.type === 'OBSTACLE_CAR') {
             if (s.frames % 3 === 0) {
                s.particles.push({ x: ent.x + ent.w/2 + (Math.random()-0.5)*30, y: ent.y + ent.h/2 + (Math.random()-0.5)*20, vx: (Math.random()-0.5)*2, vy: -Math.random()*4 - 2, life: 30, maxLife: 30, color: '#ef4444', size: Math.random()*5 + 3 });
                s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*1, vy: -Math.random()*6 - 3, life: 40, maxLife: 40, color: '#334155', size: Math.random()*8 + 5 });
             }
             ent.x -= s.speed; // move with ground
          }
          if (ent.y > HEIGHT + s.view.bottom + 50) ent.markedForDeletion = true;
          if (ent.x + ent.w < 0 || (ent.x > WIDTH + 50 && (ent.type === 'SHURIKEN' || ent.type === 'FIREBALL' || ent.type === 'CANNON_FISH' || ent.type === 'PLAYER_FOOTBALL'))) ent.markedForDeletion = true;
        } else {
          if (ent.crashed && (ent.type === 'NINJA_AMBUSH' || ent.type === 'BOSS_SHURIKEN' || ent.type === 'BOSS_VOLLEY_BALL')) {
            // Landed a hit on the cat: the ninja vanishes, the star is spent
            if (ent.type === 'NINJA_AMBUSH') ninjaPoof(s, ent.x + 20, ent.y + 20);
            ent.markedForDeletion = true;
          }
          let entSpeed = ent.speed !== undefined ? ent.speed : s.speed;
          
          if (!ent.crashed) {
            if (ent.type === 'OBSTACLE_CAR') entSpeed = s.speed + 8;
            else if (ent.type === 'OBSTACLE_BICYCLE') entSpeed = s.speed + 5;
            else if (ent.type === 'OBSTACLE_RUNNER') entSpeed = s.speed + 3;
            else if (ent.type === 'OBSTACLE_BIRD') entSpeed = s.speed + 4;
            else if (ent.type === 'OBSTACLE_AIRPLANE') entSpeed = s.speed + 12;
            else if (ent.type === 'SHURIKEN') entSpeed = -15;
            else if (ent.type === 'FIREBALL') entSpeed = -18;
            else if (ent.type === 'CANNON_FISH') entSpeed = -20;
            else if (ent.type === 'BOSS_BULLET') entSpeed = 8;
            else if (ent.type === 'BOSS_ZIGZAG_BALL') {
                entSpeed = 7;
                ent.vy = (ent.vy || 0) + 0.3;
                ent.y += ent.vy;
                if (ent.y > GROUND_Y - 20) {
                    ent.y = GROUND_Y - 20;
                    ent.vy = -7;
                }
            }
            else if (ent.type === 'PLAYER_FOOTBALL') {
                entSpeed = -20;
            }
            else if (ent.type === 'BOSS_FOOTBALL_PICKUP') {
                entSpeed = s.speed;
                ent.y = GROUND_Y - 20 + Math.sin(s.frames * 0.2) * 5;
            }
            else if (ent.type === 'OBSTACLE_FOOTBALL') {
                entSpeed = s.speed + 3;
                if (!ent.spawnY) ent.spawnY = ent.y;
                ent.y = ent.spawnY - Math.abs(Math.sin(s.frames * 0.15)) * 120;
            }
            else if (ent.type === 'OBSTACLE_TENNIS_BALL') {
                entSpeed = s.speed + 4;
                if (!ent.spawnY) ent.spawnY = ent.y;
                ent.y = ent.spawnY - Math.abs(Math.sin(s.frames * 0.2)) * 80;
            }
            else if (ent.type === 'OBSTACLE_WATER_BOTTLE') {
                entSpeed = s.speed;
                // stationary
            }
            else if (ent.type === 'OBSTACLE_DUMBBELL') {
                entSpeed = s.speed;
                // stationary
            }
            else if (ent.type === 'OBSTACLE_SOCCER_BALL') {
                // Fast roller with little hops
                entSpeed = s.speed + 5;
                if (!ent.spawnY) ent.spawnY = ent.y;
                ent.y = ent.spawnY - Math.abs(Math.sin(s.frames * 0.25)) * 22;
            }
            else if (ent.type === 'OBSTACLE_BASKETBALL') {
                // Big slow bounces — time your jump under or over it
                entSpeed = s.speed + 2;
                if (!ent.spawnY) ent.spawnY = ent.y;
                ent.y = ent.spawnY - Math.abs(Math.sin(s.frames * 0.07)) * 150;
            }
            else if (ent.type === 'OBSTACLE_MASCOT') {
                entSpeed = s.speed + 1;
            }
            else if (ent.type === 'OBSTACLE_JAVELIN') {
                if (!ent.landed) {
                    entSpeed = JAVELIN_DRIFT;
                    ent.vy = (ent.vy ?? JAVELIN_VY0) + JAVELIN_GRAVITY;
                    ent.y += ent.vy;
                    if (ent.y + ent.h >= GROUND_Y) {
                        // Stick in the track: becomes a thin upright pole
                        ent.landed = true;
                        ent.w = 12; ent.h = 48;
                        ent.y = GROUND_Y - ent.h;
                        for (let p = 0; p < 10; p++) {
                            s.particles.push({ x: ent.x + 6, y: GROUND_Y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4, life: 18, maxLife: 18, color: '#b91c1c', size: Math.random() * 3 + 2 });
                        }
                    }
                } else {
                    entSpeed = s.speed;
                }
            }
            else if (ent.type === 'BOSS_SHURIKEN') {
                entSpeed = s.speed + 6;
            }
            else if (ent.type === 'BOSS_VOLLEY_BALL') {
                ent.vy = (ent.vy || 0) + VOLLEY_GRAVITY;
                ent.y += ent.vy;
                if (!ent.landed) {
                    entSpeed = -(ent.vx || 0); // high arc toward its marked landing spot
                } else {
                    entSpeed = s.speed + 3;    // then bounces along the track at the cat
                }
                if (ent.y + ent.h >= GROUND_Y && ent.vy > 0) {
                    ent.y = GROUND_Y - ent.h;
                    ent.vy = ent.landed ? -Math.max(4, ent.vy * 0.6) : -6.5;
                    if (!ent.landed) {
                        ent.landed = true;
                        for (let p = 0; p < 8; p++) s.particles.push({ x: ent.x + 13, y: GROUND_Y, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 3, life: 16, maxLife: 16, color: '#fca5a5', size: Math.random() * 3 + 2 });
                    }
                }
            }
            else if (ent.type === 'NINJA_AMBUSH') {
                ent.timer = (ent.timer || 0) + 1;
                entSpeed = s.speed;
                const vanish = () => { ninjaPoof(s, ent.x + 20, ent.y + 20); ent.markedForDeletion = true; };
                if (ent.phase === 'APPEAR') {
                    if (ent.variant === 'DROP') ent.y = 170 + Math.sin(ent.timer * 0.3) * 4; // hovering
                    if (ent.timer >= NINJA_TELEGRAPH_FRAMES) { ent.phase = 'ATTACK'; ent.timer = 0; }
                } else if (ent.variant === 'DROP' && ent.y + ent.h < GROUND_Y) {
                    ent.vy = (ent.vy || 0) + 1.1;
                    ent.y = Math.min(GROUND_Y - ent.h, ent.y + ent.vy);
                    if (ent.y + ent.h >= GROUND_Y) {
                        for (let p = 0; p < 8; p++) s.particles.push({ x: ent.x + 20, y: GROUND_Y, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 3, life: 16, maxLife: 16, color: '#94a3b8', size: Math.random() * 3 + 2 });
                        ent.variant = 'DASH';
                        ent.timer = 0;
                    }
                } else if (ent.variant === 'DASH') {
                    if (ent.timer > 6) entSpeed = s.speed + 9; // brief crouch, then lunge
                    if (ent.x + ent.w < cat.x - 40 || ent.timer > 110) vanish();
                } else if (ent.variant === 'THROW') {
                    if (ent.timer === 8) {
                        const high = Math.random() < 0.45;
                        s.entities.push({ id: Math.random(), type: 'BOSS_SHURIKEN', x: ent.x - 6, y: high ? GROUND_Y - 80 : GROUND_Y - 30, w: 18, h: 18, markedForDeletion: false });
                        audio.playJump();
                    }
                    if (ent.timer > 28) vanish();
                }
            }
            else if (ent.type === 'BOSS_MINION') {
                entSpeed = s.speed - 1;
                // random jump logic
                if (ent.y >= GROUND_Y - ent.h) {
                    ent.y = GROUND_Y - ent.h;
                    if (Math.random() < 0.02) ent.vy = -12; // jump
                } else {
                    ent.vy = (ent.vy || 0) + GRAVITY;
                    ent.y += ent.vy;
                }
            }
          }

          
          ent.x -= entSpeed;
          
          if (ent.crashed && ent.type !== 'OBSTACLE_CAR' && !ent.type.startsWith('OBSTACLE_BICYCLE') && !ent.type.startsWith('OBSTACLE_RUNNER')) {
            if (ent.y < GROUND_Y - ent.h) {
              ent.y += 10;
            }
          }
          
          if (ent.x + ent.w < 0 || (ent.x > WIDTH + 50 && (ent.type === 'SHURIKEN' || ent.type === 'FIREBALL' || ent.type === 'CANNON_FISH' || ent.type === 'PLAYER_FOOTBALL'))) {
            ent.markedForDeletion = true;
          }
        }

        // Entity to Entity (Projectiles)
        if (!ent.crashed && (ent.type === "SHURIKEN" || ent.type === "FIREBALL" || ent.type === "CANNON_FISH" || ent.type === "PLAYER_FOOTBALL")) {
           
           // Projectiles still land while the boss is flashing from a previous hit
           // (so rapid-fire isn't wasted), but not during its intro or death anim.
           if (isBossVulnerable(s) || (s.boss.active && s.boss.state === 'HURT' && s.boss.hp > 0)) {
              if (
                 ent.x < s.boss.x + s.boss.w &&
                 ent.x + ent.w > s.boss.x &&
                 ent.y < s.boss.y + s.boss.h &&
                 ent.y + ent.h > s.boss.y
              ) {
                 ent.crashed = true; ent.markedForDeletion = true;
                 let dmg = 1;
                 if (ent.type === 'CANNON_FISH') dmg = 3;
                 if (ent.type === 'SHURIKEN') dmg = 8;
                 if (ent.type === 'FIREBALL') dmg = 12;
                 if (ent.type === 'PLAYER_FOOTBALL') dmg = 20;
                 damageBoss(s, dmg);
                 for (let p = 0; p < 8; p++) {
                    s.particles.push({ x: ent.x + ent.w, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 18, maxLife: 18, color: '#fde68a', size: Math.random()*3 + 2, type: 'sparkle' });
                 }
              }
           }
           s.entities.forEach(other => {
              if (!other.crashed && ((other.type.startsWith("OBSTACLE") && other.type !== 'OBSTACLE_GAP') || other.type === "BOSS_MINION" || other.type === 'NINJA_AMBUSH')) {

                 if (
                   ent.x < other.x + other.w &&
                   ent.x + ent.w > other.x &&
                   ent.y < other.y + other.h &&
                   ent.y + ent.h > other.y
                 ) {
                    destroyObstacle(other, s, audio); ent.crashed = true; ent.markedForDeletion = true;
                    for(let p=0; p<10; p++) {
                       s.particles.push({ x: other.x + other.w/2, y: other.y + other.h/2, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, maxLife: 20, color: "#ef4444", size: Math.random()*3 + 2 });
                    }
                 }
              }
           });
        }

        
        const hitboxMargin = 5;

        // Rooftop gaps: running into the gap (not jumping over it) means a fall
        if (ent.type === 'OBSTACLE_GAP' && !ent.crashed && !cat.dead && !s.transition) {
          const cx = cat.x + cat.w / 2;
          const onRoofLevel = cat.isGrounded && cat.y + cat.h >= GROUND_Y - 1;
          if (onRoofLevel && cx > ent.x + 8 && cx < ent.x + ent.w - 8 && cat.goldenBoostTimer <= 0) {
            ent.crashed = true;
            if (cat.hasShield || cat.lives > 1) {
              // Saved: bounce back up out of the gap
              if (cat.hasShield) cat.hasShield = false; else cat.lives--;
              cat.vy = -13;
              cat.isGrounded = false;
              audio.playHit();
              s.particles.push({ x: cat.x + cat.w / 2, y: cat.y - 10, vx: 0, vy: -1.5, life: 50, maxLife: 50, color: '#4ade80', size: 18, type: 'TEXT', text: 'SAVED!' });
            } else {
              cat.dead = true;
              cat.fellInGap = true; // no roof to land on: the death animation falls into the gap
              audio.playHit();
            }
          }
          continue;
        }

        // Collision Check

        if (
          !ent.crashed && !cat.dead &&
          cat.x + hitboxMargin < ent.x + ent.w - hitboxMargin &&
          cat.x + cat.w - hitboxMargin > ent.x + hitboxMargin &&
          cat.y + hitboxMargin < ent.y + ent.h - hitboxMargin &&
          cat.y + cat.h - hitboxMargin > ent.y + hitboxMargin
        ) {
          // Collided
          if (ent.type.startsWith("OBSTACLE") || ent.type === "BOSS_BULLET" || ent.type === "BOSS_MINION" || ent.type === "BOSS_ZIGZAG_BALL" || ent.type === 'BOSS_SHURIKEN' || ent.type === 'NINJA_AMBUSH' || ent.type === 'BOSS_VOLLEY_BALL') {
            if (ent.type === 'NINJA_AMBUSH') {
              const stomp = cat.vy > 0 && cat.y + cat.h - cat.vy <= ent.y + 12;
              if (stomp) {
                destroyObstacle(ent, s, audio);
                if (ent.isClone && s.boss.active) {
                  // Shadow clone: launch it back at the Ninja boss (only hurts him if it connects)
                  ent.deflected = true;
                  ent.bounces = 0;
                  ent.vx = 9 + Math.random() * 4;
                  ent.vy = -10.5 - Math.random() * 2;
                }
                ninjaPoof(s, ent.x + 20, ent.y + 20);
                s.particles.push({ x: ent.x + 20, y: ent.y - 10, vx: 0, vy: -1.5, life: 45, maxLife: 45, color: '#c4b5fd', size: 16, type: 'TEXT', text: 'NINJA DOWN!' });
                cat.vy = -9;
                continue;
              }
              // Still materialising: can't hurt you yet
              if (ent.phase === 'APPEAR') continue;
            }
            if (ent.type === "BOSS_MINION" && cat.vy > 0 && cat.y + cat.h - cat.vy <= ent.y + 12) {
              destroyObstacle(ent, s, audio);
              if (s.boss.active) {
                s.boss.hasMinion = false; s.boss.minionRespawnTimer = 0;
                // Kick the henchman high toward the boss; it only hurts him if it lands on him
                ent.vx = 9 + Math.random() * 4;
                ent.vy = -10.5 - Math.random() * 2;
              }
              cat.vy = -8;
              continue;
            }
            if (cat.goldenBoostTimer > 0) {
              destroyObstacle(ent, s, audio);
              audio.playHit();
              for(let p=0; p<15; p++) {
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15 - 5, life: 25, maxLife: 25, color: "#94a3b8" });
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, maxLife: 20, color: "#f59e0b" });
              }

            } else if (cat.catType === "ninja" && !cat.isGrounded && cat.vy <= 0 && cat.jumps >= 2) {
              destroyObstacle(ent, s, audio);
              audio.playMeow();
              for(let p=0; p<15; p++) {
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15 - 5, life: 25, maxLife: 25, color: "#94a3b8" });
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, maxLife: 20, color: "#f59e0b" });
              }

            } else if (cat.catType === "super" && cat.superHealth > 0) {
              destroyObstacle(ent, s, audio);
              audio.playMeow();
              cat.superHealth -= 30;
              for(let p=0; p<15; p++) {
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15 - 5, life: 25, maxLife: 25, color: "#94a3b8" });
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, maxLife: 20, color: "#f59e0b" });
              }


            } else if (cat.hasShield) {
              cat.hasShield = false;
              destroyObstacle(ent, s, audio);
              cat.stunTimer = 15; // very brief iframe
            } else if (!cat.dead && cat.stunTimer === 0) {
              ent.crashed = true;
              audio.playHit();
              for(let p=0; p<15; p++) {
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 25, maxLife: 25, color: "#64748b", size: Math.random()*3 + 1 });
                 s.particles.push({ x: ent.x + ent.w/2, y: ent.y + ent.h/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 20, maxLife: 20, color: "#fef08a", size: Math.random()*3 + 1, type: "sparkle" });
              }
              if (cat.lives > 1) {
                cat.lives--;
                cat.stunTimer = 45; // stunned a bit
              } else {
                cat.dead = true;
                cat.stunTimer = 60; // stunned before game over
              }
            }
          } else if (ent.type === 'POWERUP_SHIELD') {
              cat.hasShield = true; ent.markedForDeletion = true;
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#4ade80', size: 16, type: 'TEXT', text: 'SHIELD!' });
              audio.playPowerup();
              for(let p=0; p<15; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  life: 30, maxLife: 30, color: '#22c55e', size: Math.random() * 4 + 2
                });
              }
            } else if (ent.type === 'POWERUP_TIME') {
              cat.timeSlowTimer = 300; ent.markedForDeletion = true;
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#a855f7', size: 16, type: 'TEXT', text: 'SLOW TIME!' });
              audio.playPowerup();
              for(let p=0; p<15; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  life: 30, maxLife: 30, color: '#8b5cf6', size: Math.random() * 4 + 2
                });
              }
            } else if (ent.type === 'POWERUP_WINGS') {
              cat.wingsTimer = 900; ent.markedForDeletion = true;
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#38bdf8', size: 16, type: 'TEXT', text: 'WINGS!' });
              audio.playPowerup();
              for(let p=0; p<15; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  life: 30, maxLife: 30, color: '#ffffff', size: Math.random() * 4 + 2
                });
              }
            } else if (ent.type === "FISH") {
              s.yarnsCollected++;
              if (cat.catType === "wizard") cat.mana = Math.min(100, (cat.mana || 0) + 15);
              if (cat.catType === "super" && cat.superHealth > 0) cat.superHealth = Math.min(100, (cat.superHealth || 0) + 10);

              ent.markedForDeletion = true;
              audio.playCoin();
              for(let p=0; p<12; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  life: 30, maxLife: 30, color: '#60a5fa', size: Math.random() * 6 + 4,
                  type: 'sparkle'
                });
              }
            
            } else if (ent.type === 'BOSS_FOOTBALL_PICKUP') {
              ent.markedForDeletion = true;
              audio.playPowerup();
              s.entities.push({
                 id: s.frames + 99, type: 'PLAYER_FOOTBALL',
                 x: cat.x + cat.w, y: cat.y + 10, w: 24, h: 24,
                 vx: 15, vy: 0, markedForDeletion: false, crashed: false
              });
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#facc15', size: 16, type: 'TEXT', text: 'KICK!' });
            } else if (ent.type === 'POWERUP_CANNON') {
              cat.fishCannonTimer = s.boss.active ? BOSS_FIGHT_CANNON_FRAMES : 600; ent.markedForDeletion = true;
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#ef4444', size: 16, type: 'TEXT', text: 'CANNON!' });
              audio.playPowerup();
              for(let p=0; p<20; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
                  life: 45, maxLife: 45, color: '#ef4444', size: Math.random() * 8 + 4,
                  type: 'sparkle'
                });
              }
            } else if (ent.type === 'GOLDEN_FISH') {
              cat.goldenBoostTimer = s.boss.active ? BOSS_FIGHT_INVINCIBLE_FRAMES : 600; ent.markedForDeletion = true;
              s.particles.push({ x: cat.x + cat.w/2, y: cat.y - 10, vx: 0, vy: -1.5, life: 60, maxLife: 60, color: '#f59e0b', size: 16, type: 'TEXT', text: 'INVINCIBLE!' });
              audio.playPowerup();
              for(let p=0; p<20; p++) {
                s.particles.push({
                  x: ent.x + ent.w/2, y: ent.y + ent.h/2,
                  vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
                  life: 45, maxLife: 45, color: '#f97316', size: Math.random() * 8 + 4,
                  type: 'sparkle'
                });
              }
            }
          }
        }

      // Ground dust
      if (cat.isGrounded && !cat.dead && s.frames % 5 === 0) {
        const dustColor = s.map === 'Stadium' ? '#7f1d1d' : '#94a3b8';
        s.particles.push({
           x: cat.x + 10, y: GROUND_Y,
           vx: -s.speed - Math.random()*2, vy: -Math.random()*2, 
           life: 15, maxLife: 15, color: dustColor, size: Math.random()*2 + 1
        });
      }
      checkCallouts(s);

      // Cleanup
      s.entities = s.entities.filter(e => !e.markedForDeletion);
      } // end of world update (skipped while a callout is showing)

      // -- DRAW --
      const view = s.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, WIDTH, view.h);
      drawSky(ctx);
      // Everything below is drawn in world coordinates (0..800), offset so the
      // extra sky sits above and the extra ground below.
      ctx.translate(0, view.top);

      drawBackground(ctx);
      drawWeather(ctx);
      drawStairsScene(ctx);

      const drawSceneObjects = (isReflection: boolean) => {
// Draw shadows first
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (const ent of s.entities) {
          if (!ent.markedForDeletion && ent.type !== 'OBSTACLE_GAP') {
             const shadowW = ent.w * 0.8;
             const shadowX = ent.x + ent.w/2;
             const shadowY = GROUND_Y;
             ctx.beginPath();
             ctx.ellipse(shadowX, shadowY, shadowW/2, 4, 0, 0, Math.PI*2);
             ctx.fill();
          }
      }
      
      // Starter power-up from a boss tutorial: pulsing ring + "EAT ME!" arrow
      for (const ent of s.entities) {
          if (!ent.tutorial || ent.markedForDeletion) continue;
          const cx = ent.x + ent.w / 2, cy = ent.y + ent.h / 2;
          const pulse = Math.abs(Math.sin(s.frames * 0.15));
          ctx.save();
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + pulse * 0.6})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx, cy, 20 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          const bob = Math.sin(s.frames * 0.2) * 4;
          ctx.fillText(ent.type === 'BOSS_FOOTBALL_PICKUP' ? 'GRAB IT!' : 'EAT ME!', cx, cy - 42 + bob);
          ctx.beginPath(); ctx.moveTo(cx - 7, cy - 34 + bob); ctx.lineTo(cx + 7, cy - 34 + bob); ctx.lineTo(cx, cy - 25 + bob); ctx.fill();
          ctx.restore();
      }

      // Javelin landing warning
      for (const ent of s.entities) {
          if ((ent.type === 'OBSTACLE_JAVELIN' || ent.type === 'BOSS_VOLLEY_BALL') && !ent.landed && !ent.crashed && ent.targetX !== undefined) {
             const pulse = 0.5 + Math.abs(Math.sin(s.frames * 0.3)) * 0.5;
             ctx.save();
             ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
             ctx.lineWidth = 3;
             ctx.beginPath(); ctx.ellipse(ent.targetX + ent.w/2, GROUND_Y + 4, 22, 6, 0, 0, Math.PI*2); ctx.stroke();
             ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.9})`;
             ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
             ctx.fillText('!', ent.targetX + ent.w/2, GROUND_Y - 8);
             ctx.restore();
          }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';

      // Cat shadow
      ctx.beginPath();
      ctx.ellipse(s.cat.x + s.cat.w/2, GROUND_Y, s.cat.w*0.8/2, 4, 0, 0, Math.PI*2);
      ctx.fill();

      // Draw entities
      for (const ent of s.entities) {
        ctx.save();
        
        if (ent.type === 'FISH' || ent.type === 'GOLDEN_FISH' || ent.type === 'POWERUP_SHIELD' || ent.type === 'POWERUP_WINGS' || ent.type === 'POWERUP_TIME' || ent.type === 'POWERUP_CANNON' || ent.type === 'CANNON_FISH') {
          ctx.translate(ent.x + ent.w / 2, ent.y + ent.h / 2 + (ent.type !== 'FISH' ? Math.sin(s.frames * 0.1) * 2 : 0));
          
          // glow effect
          if (ent.type === 'FISH') {
            ctx.shadowColor = '#60a5fa';
            ctx.shadowBlur = 10;
          } else if (ent.type === 'GOLDEN_FISH') {
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 15;
          } else if (ent.type === 'POWERUP_SHIELD') {
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 15;
          } else if (ent.type === 'POWERUP_WINGS') {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 15;
          } else if (ent.type === 'POWERUP_TIME') {
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 15;
          } else if (ent.type === 'POWERUP_CANNON') {
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 15;
          } else if (ent.type === 'CANNON_FISH') {
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 10;
          }

          if (ent.type === 'GOLDEN_FISH') {
            ctx.fillStyle = `rgba(249, 115, 22, ${Math.random() * 0.5 + 0.2})`;
            ctx.beginPath(); ctx.arc(0, 0, ent.w/2 + 8, 0, Math.PI * 2); ctx.fill();
          }

          // cute fish
          if (ent.type === 'POWERUP_SHIELD') ctx.fillStyle = '#22c55e'; // green
          else if (ent.type === 'POWERUP_WINGS') ctx.fillStyle = '#ffffff'; // white
          else if (ent.type === 'POWERUP_TIME') ctx.fillStyle = '#a855f7'; // purple
          else if (ent.type === 'POWERUP_CANNON') ctx.fillStyle = '#ef4444'; // red
          else if (ent.type === 'CANNON_FISH') ctx.fillStyle = '#3b82f6'; // blue
          else ctx.fillStyle = ent.type === 'GOLDEN_FISH' ? '#f97316' : '#60a5fa'; // orange or blue

          ctx.beginPath();
          ctx.ellipse(0, 0, ent.w/2 - 2, ent.h/3, 0, 0, Math.PI*2);
          ctx.fill();
          // tail
          ctx.beginPath();
          ctx.moveTo(-ent.w/2 + 6, 0); ctx.lineTo(-ent.w/2 - 8, -10); ctx.lineTo(-ent.w/2 - 8, 10);
          ctx.fill();
          // fins
          ctx.beginPath(); ctx.moveTo(0, -ent.h/3); ctx.lineTo(-5, -ent.h/3 - 6); ctx.lineTo(5, -ent.h/3); ctx.fill();
          
          ctx.shadowBlur = 0; // reset shadow for details

          // powerup specific details
          if (ent.type === 'POWERUP_SHIELD') {
            // holding a shield
            ctx.fillStyle = '#16a34a';
            ctx.beginPath();
            ctx.moveTo(ent.w/4 + 6, 2);
            ctx.lineTo(ent.w/4 - 2, 2);
            ctx.lineTo(ent.w/4 - 2, 8);
            ctx.lineTo(ent.w/4 + 2, 11);
            ctx.lineTo(ent.w/4 + 6, 8);
            ctx.fill();
            
            ctx.fillStyle = '#86efac';
            ctx.beginPath();
            ctx.moveTo(ent.w/4 + 4, 3);
            ctx.lineTo(ent.w/4, 3);
            ctx.lineTo(ent.w/4, 7);
            ctx.lineTo(ent.w/4 + 2, 9);
            ctx.lineTo(ent.w/4 + 4, 7);
            ctx.fill();
          } else if (ent.type === 'GOLDEN_FISH') {
            // wearing a crown
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(-4, -ent.h/3 - 1);
            ctx.lineTo(-6, -ent.h/3 - 8);
            ctx.lineTo(-2, -ent.h/3 - 4);
            ctx.lineTo(2, -ent.h/3 - 8);
            ctx.lineTo(4, -ent.h/3 - 1);
            ctx.fill();
          } else if (ent.type === 'POWERUP_TIME') {
            // holding a little pocket watch
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(ent.w/4 + 2, 6, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(ent.w/4 + 2, 6, 3, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ent.w/4 + 2, 6); ctx.lineTo(ent.w/4 + 2, 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ent.w/4 + 2, 6); ctx.lineTo(ent.w/4 + 4, 6); ctx.stroke();
          } else if (ent.type === 'POWERUP_WINGS') {
            // having wings
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.quadraticCurveTo(-5, -12, -2, -15);
            ctx.quadraticCurveTo(3, -5, 5, -2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2, -2);
            ctx.quadraticCurveTo(7, -12, 4, -15);
            ctx.quadraticCurveTo(-1, -5, -3, -2);
            ctx.fill();
          }

          // eye
          ctx.fillStyle = '#000'; // black eye
          ctx.beginPath(); ctx.arc(ent.w/4 - 2, -3, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ent.w/4 - 3, -4, 1, 0, Math.PI*2); ctx.fill();
          
          // smile
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ent.w/4, 2, 3, 0.2, Math.PI-0.2); ctx.stroke();
        } else {
          // Obstacles
          ctx.translate(ent.x, ent.y);
          if (s.map === 'Stadium' && !isReflection) {
            // Dark halo so obstacles read clearly against the busy stadium
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;
          }
          if (ent.rotation) {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.rotate(ent.rotation);
             ctx.translate(-ent.w/2, -ent.h/2);
          }
          if (ent.y >= GROUND_Y - ent.h - 5 && ent.type !== 'OBSTACLE_GAP') {
             ctx.fillStyle = "rgba(0,0,0,0.2)";
             ctx.beginPath(); ctx.ellipse(ent.w/2, ent.h, ent.w/2 - 5, 5, 0, 0, Math.PI*2); ctx.fill();
          }
          if (ent.type === "OBSTACLE_CAR") {

             // Facing left car
             ctx.fillStyle = ent.color || '#ef4444';
             ctx.beginPath(); ctx.roundRect(0, 15, ent.w, ent.h - 15, 8); ctx.fill(); // body
             ctx.beginPath(); ctx.roundRect(15, 0, ent.w - 30, 25, 10); ctx.fill(); // cabin
             
             ctx.fillStyle = '#94a3b8'; // bumpers
             ctx.beginPath(); ctx.roundRect(-2, ent.h-10, 6, 8, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(ent.w-4, ent.h-10, 6, 8, 2); ctx.fill();
             
             ctx.fillStyle = '#e0f2fe'; // windows
             ctx.beginPath(); ctx.roundRect(20, 4, ent.w/2 - 22, 11, 4); ctx.fill();
             ctx.beginPath(); ctx.roundRect(ent.w/2 + 2, 4, ent.w/2 - 22, 11, 4); ctx.fill();
             
             // headlights (left side)
             ctx.fillStyle = '#fef08a';
             ctx.beginPath(); ctx.ellipse(3, 20, 4, 6, 0, 0, Math.PI*2); ctx.fill();
             if (!ent.crashed) {
                ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
                ctx.beginPath();
                ctx.moveTo(3, 20);
                ctx.lineTo(-40, 5);
                ctx.lineTo(-40, 35);
                ctx.fill();
             } else {
                // Smoke
                ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
                ctx.beginPath(); ctx.arc(ent.w/2, 5, 10 + Math.sin(s.frames*0.1)*2, 0, Math.PI*2); ctx.fill();
             }
             
             ctx.fillStyle = '#ef4444'; // taillights (right side)
             ctx.beginPath(); ctx.ellipse(ent.w - 3, 20, 3, 5, 0, 0, Math.PI*2); ctx.fill();
             
             // Wheels rotating
             ctx.save();
             ctx.translate(20, ent.h);
             ctx.rotate(ent.crashed ? 0 : -s.frames * 0.2);
             ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-8, -1.5, 16, 3);
             ctx.fillRect(-1.5, -8, 3, 16);
             ctx.restore();
             
             ctx.save();
             ctx.translate(ent.w - 20, ent.h);
             ctx.rotate(-s.frames * 0.2);
             ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-8, -1.5, 16, 3);
             ctx.fillRect(-1.5, -8, 3, 16);
             ctx.restore();
             
          } else if (ent.type === 'OBSTACLE_BIRD' || ent.type === 'OBSTACLE_BAT') {
             ctx.translate(ent.w/2, ent.h/2 + Math.sin(s.frames * 0.3) * 5);
             ctx.fillStyle = "#1e293b"; // body
             ctx.beginPath(); ctx.ellipse(0, 0, ent.w/2, ent.h/2.5, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = "#334155"; // wing

             ctx.beginPath(); ctx.ellipse(5, 0, ent.w/2.5, ent.h/3, -Math.sin(s.frames * 0.5)*0.8, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#f59e0b'; // beak (facing left)
             ctx.beginPath(); ctx.moveTo(-ent.w/2 + 2, -2); ctx.lineTo(-ent.w/2 - 8, 2); ctx.lineTo(-ent.w/2 + 2, 6); ctx.fill();
             ctx.fillStyle = '#fff'; // eye
             ctx.beginPath(); ctx.arc(-ent.w/4, -3, 4, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-ent.w/4 - 1, -3, 1.5, 0, Math.PI*2); ctx.fill();
          
          } else if (ent.type === 'SHURIKEN') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.rotate(s.frames * 0.5);
             ctx.fillStyle = '#94a3b8'; // metal
             ctx.beginPath();
             ctx.moveTo(0, -ent.h/2); ctx.lineTo(ent.w/4, -ent.h/4);
             ctx.lineTo(ent.w/2, 0); ctx.lineTo(ent.w/4, ent.h/4);
             ctx.lineTo(0, ent.h/2); ctx.lineTo(-ent.w/4, ent.h/4);
             ctx.lineTo(-ent.w/2, 0); ctx.lineTo(-ent.w/4, -ent.h/4);
             ctx.closePath(); ctx.fill();
             ctx.fillStyle = '#475569';
             ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
          } else if (ent.type === 'FIREBALL') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.fillStyle = '#ef4444'; // red core
             ctx.beginPath(); ctx.ellipse(0, 0, ent.w/2, ent.h/2, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#f97316'; // orange outer
             ctx.beginPath(); ctx.ellipse(-5, 0, ent.w/2, ent.h/2.5, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#facc15'; // yellow trail
             ctx.beginPath(); ctx.ellipse(-15, 0, ent.w/3, ent.h/3, 0, 0, Math.PI*2); ctx.fill();
          
          } else if (ent.type === 'BOSS_BULLET') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.shadowColor = '#ef4444';
             ctx.shadowBlur = 15;
             ctx.fillStyle = '#f87171';
             ctx.beginPath(); ctx.arc(0, 0, ent.w/2, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#fca5a5';
             ctx.beginPath(); ctx.arc(-2, -2, ent.w/4, 0, Math.PI*2); ctx.fill();
             ctx.shadowBlur = 0;
          } else if (ent.type === 'BOSS_MINION') {
             // Draw using drawCat!
             const minionCatObj = { isMinion: true,
                 catType: ent.catType || 'default',
                 stunTimer: 0,
                 abilityTimer: 0,
                 jumps: 0,
                 vy: ent.vy || 0
             };
             // Offset because drawCat draws from bottom center, but context is already translated to entity center sometimes?
             // Actually entity loop does ctx.translate(ent.x, ent.y) at the start!
             // So x, y for drawCat should be 0, 0. 
             drawCat(ctx, minionCatObj, 0, 0, ent.w, ent.h, (ent.y >= GROUND_Y - ent.h), true);
          } else if (ent.type === 'OBSTACLE_BOX') {

             // Cardboard Box
             ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.roundRect(0, 0, ent.w, ent.h, 4); ctx.fill();
             ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.roundRect(2, 2, ent.w-4, ent.h-4, 3); ctx.fill();
             ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
             ctx.beginPath(); ctx.moveTo(0, ent.h/2); ctx.lineTo(ent.w, ent.h/2); ctx.stroke(); // tape
             ctx.fillStyle = '#fef3c7'; // label
             ctx.fillRect(ent.w/2 - 8, 8, 16, 12);
          } else if (ent.type === 'OBSTACLE_TRASH') {
             // Trash Can
             ctx.fillStyle = '#64748b'; // body
             ctx.beginPath(); ctx.moveTo(5, ent.h); ctx.lineTo(0, 10); ctx.lineTo(ent.w, 10); ctx.lineTo(ent.w-5, ent.h); ctx.fill();
             ctx.fillStyle = '#475569'; // lid/rim
             ctx.beginPath(); ctx.roundRect(-4, 0, ent.w+8, 12, 4); ctx.fill();
             ctx.fillStyle = '#cbd5e1'; // handle
             ctx.beginPath(); ctx.roundRect(ent.w/2 - 8, -6, 16, 6, 2); ctx.fill();
             ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; // ridges
             ctx.beginPath(); ctx.moveTo(10, 18); ctx.lineTo(12, ent.h-5); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(ent.w/2, 18); ctx.lineTo(ent.w/2, ent.h-5); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(ent.w-10, 18); ctx.lineTo(ent.w-12, ent.h-5); ctx.stroke();
          } else if (ent.type === 'OBSTACLE_HYDRANT') {
             // Fire Hydrant
             ctx.fillStyle = '#dc2626'; // body
             ctx.beginPath(); ctx.roundRect(5, 10, ent.w-10, ent.h-10, 4); ctx.fill();
             ctx.beginPath(); ctx.roundRect(0, 20, ent.w, 12, 3); ctx.fill(); // side arms
             ctx.fillStyle = '#991b1b'; // nuts
             ctx.beginPath(); ctx.arc(-2, 26, 4, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(ent.w+2, 26, 4, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#dc2626'; // dome
             ctx.beginPath(); ctx.arc(ent.w/2, 12, 12, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#fca5a5'; // highlight
             ctx.beginPath(); ctx.ellipse(ent.w/2 - 4, 10, 3, 5, 0, 0, Math.PI*2); ctx.fill();
          } else if (ent.type === 'OBSTACLE_SIGN') {
             // Street Sign
             ctx.fillStyle = '#94a3b8'; // pole
             ctx.beginPath(); ctx.roundRect(ent.w/2 - 4, 0, 8, ent.h, 2); ctx.fill();
             ctx.fillStyle = '#ef4444'; // octagon
             ctx.beginPath(); 
             ctx.moveTo(ent.w/2 - 8, 2); ctx.lineTo(ent.w/2 + 8, 2); ctx.lineTo(ent.w/2 + 20, 14);
             ctx.lineTo(ent.w/2 + 20, 26); ctx.lineTo(ent.w/2 + 8, 38); ctx.lineTo(ent.w/2 - 8, 38);
             ctx.lineTo(ent.w/2 - 20, 26); ctx.lineTo(ent.w/2 - 20, 14);
             ctx.fill();
             ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; // border
             ctx.beginPath(); 
             ctx.moveTo(ent.w/2 - 6, 5); ctx.lineTo(ent.w/2 + 6, 5); ctx.lineTo(ent.w/2 + 17, 16);
             ctx.lineTo(ent.w/2 + 17, 24); ctx.lineTo(ent.w/2 + 6, 35); ctx.lineTo(ent.w/2 - 6, 35);
             ctx.lineTo(ent.w/2 - 17, 24); ctx.lineTo(ent.w/2 - 17, 16);
             ctx.closePath(); ctx.stroke();
             ctx.fillStyle = '#fff'; ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
             ctx.fillText("STOP", ent.w/2, 21);
          } else if (ent.type === 'OBSTACLE_BICYCLE') {
             // Bicycle facing left
             const wheelRot = -s.frames * 0.2;
             ctx.save();
             ctx.translate(14, ent.h-14); ctx.rotate(wheelRot);
             ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
             ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
             ctx.restore();
             
             ctx.save();
             ctx.translate(ent.w-14, ent.h-14); ctx.rotate(wheelRot);
             ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
             ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
             ctx.restore();
             
             if (s.weather.type === 'RAIN' && !ent.crashed) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(ent.w-28, ent.h-80, 20, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(ent.w-28, ent.h-80); ctx.lineTo(ent.w-24, ent.h-55); ctx.stroke();
             }

             if (ent.crashed) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath(); ctx.arc(ent.w-32 + Math.cos(s.frames*0.2)*10, ent.h-75 + Math.sin(s.frames*0.2)*5, 3, 0, Math.PI*2); ctx.fill();
             }
             
             ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.lineCap = 'round'; // red frame
             ctx.beginPath(); ctx.moveTo(ent.w-14, ent.h-14); ctx.lineTo(ent.w-28, ent.h-35); ctx.lineTo(24, ent.h-35); ctx.lineTo(14, ent.h-14); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(ent.w-14, ent.h-14); ctx.lineTo(28, ent.h-14); ctx.lineTo(ent.w-28, ent.h-35); ctx.stroke();
             
             ctx.strokeStyle = '#94a3b8'; // seat post & handlebar post (facing left, handlebars left)
             ctx.beginPath(); ctx.moveTo(ent.w-28, ent.h-35); ctx.lineTo(ent.w-24, ent.h-45); ctx.stroke(); // seat post
             ctx.beginPath(); ctx.moveTo(24, ent.h-35); ctx.lineTo(20, ent.h-45); ctx.stroke(); // handlebar post
             
             ctx.fillStyle = '#0f172a'; // seat & handles
             ctx.beginPath(); ctx.roundRect(ent.w-32, ent.h-48, 16, 6, 3); ctx.fill(); // seat
             ctx.beginPath(); ctx.roundRect(14, ent.h-48, 12, 4, 2); ctx.fill(); // handle
             
             // Human facing left
             ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.ellipse(ent.w-24, ent.h-55, 8, 12, 0.2, 0, Math.PI*2); ctx.fill(); // body
             ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(ent.w-32, ent.h-70, 7, 0, Math.PI*2); ctx.fill(); // head
             ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 4;
             ctx.beginPath(); ctx.moveTo(ent.w-24, ent.h-60); ctx.lineTo(22, ent.h-48); ctx.stroke(); // arm to handlebar
             ctx.strokeStyle = '#1e293b';
             
             // pedaling animation
             const pedalY = Math.sin(s.frames * 0.2) * 5;
             const pedalX = Math.cos(s.frames * 0.2) * 5;
             ctx.beginPath(); ctx.moveTo(ent.w-24, ent.h-45); ctx.lineTo(ent.w/2 + pedalX, ent.h-25 + pedalY); ctx.lineTo(ent.w/2 + pedalX, ent.h-15 + pedalY); ctx.stroke(); // leg
             
          } else if (ent.type === 'OBSTACLE_CONSTRUCTION') {
             // Traffic Cone + Barricade
             ctx.fillStyle = '#f97316'; // Cone
             ctx.beginPath(); ctx.moveTo(10, ent.h); ctx.lineTo(30, ent.h); ctx.lineTo(23, ent.h-30); ctx.lineTo(17, ent.h-30); ctx.fill();
             ctx.fillStyle = '#fff';
             ctx.beginPath(); ctx.moveTo(14, ent.h-10); ctx.lineTo(26, ent.h-10); ctx.lineTo(25, ent.h-15); ctx.lineTo(15, ent.h-15); ctx.fill();
             
             // Barricade
             ctx.fillStyle = '#fef08a';
             ctx.beginPath(); ctx.roundRect(35, ent.h-25, 25, 25, 2); ctx.fill();
             ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4;
             ctx.beginPath(); ctx.moveTo(38, ent.h); ctx.lineTo(45, ent.h-25); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(57, ent.h); ctx.lineTo(50, ent.h-25); ctx.stroke();
             ctx.fillStyle = '#ef4444'; // Red light
             ctx.beginPath(); ctx.arc(47, ent.h-28, 4, 0, Math.PI*2); ctx.fill();
             if (s.frames % 30 < 15) { ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(47, ent.h-28, 2, 0, Math.PI*2); ctx.fill(); }
          } else if (ent.type === 'OBSTACLE_RUNNER') {
             // Runner facing left
             const runCycle = Math.sin(s.frames * 0.3) * 15;
             const bounce = Math.abs(Math.cos(s.frames * 0.3)) * 4;
             ctx.translate(ent.w/2, ent.h/2 - bounce);
             
             // Legs (swinging horizontally)
             ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
             ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(runCycle, 25); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-runCycle, 25); ctx.stroke();
             // Shoes
             ctx.fillStyle = '#3b82f6';
             ctx.beginPath(); ctx.roundRect(runCycle - 6, 22, 12, 6, 3); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-runCycle - 6, 22, 12, 6, 3); ctx.fill();
             
             ctx.fillStyle = '#10b981'; // shirt
             ctx.beginPath(); ctx.roundRect(-10, -10, 20, 22, 5); ctx.fill();
             ctx.fillStyle = '#fb923c'; // head
             ctx.beginPath(); ctx.arc(-4, -22, 10, 0, Math.PI*2); ctx.fill(); 
             // Sweatband
             ctx.fillStyle = '#ef4444'; ctx.fillRect(-13, -26, 18, 4);
             
             if (s.weather.type === 'RAIN' && !ent.crashed) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(-4, -35, 18, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-4, -35); ctx.lineTo(6, -10); ctx.stroke();
             }

             if (ent.crashed) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath(); ctx.arc(-4 + Math.cos(s.frames*0.2)*10, -32 + Math.sin(s.frames*0.2)*5, 3, 0, Math.PI*2); ctx.fill();
             }
             
             // Arms
             ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
             ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(6, 5); ctx.lineTo(12 - runCycle/2, 12); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(-10, 5); ctx.lineTo(-16 + runCycle/2, 12); ctx.stroke();
          } else if (ent.type === 'OBSTACLE_HURDLE') {
             // Legs + feet
             ctx.fillStyle = '#cbd5e1';
             ctx.fillRect(4, 8, 5, ent.h - 8);
             ctx.fillRect(ent.w - 9, 8, 5, ent.h - 8);
             ctx.fillRect(0, ent.h - 4, 16, 4);
             ctx.fillRect(ent.w - 16, ent.h - 4, 16, 4);
             // Striped top board
             ctx.fillStyle = '#f8fafc';
             ctx.fillRect(0, 0, ent.w, 12);
             ctx.fillStyle = '#111827';
             for (let k = 0; k < ent.w; k += 12) ctx.fillRect(k, 0, 6, 12);
             ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
             ctx.strokeRect(0, 0, ent.w, 12);
          } else if (ent.type === 'OBSTACLE_CONES') {
             // Row of three training cones
             for (let k = 0; k < 3; k++) {
                const cx = 12 + k * 25;
                ctx.fillStyle = '#f97316';
                ctx.beginPath(); ctx.moveTo(cx - 10, ent.h); ctx.lineTo(cx, 0); ctx.lineTo(cx + 10, ent.h); ctx.fill();
                ctx.fillStyle = '#f8fafc';
                ctx.beginPath(); ctx.moveTo(cx - 6, ent.h - 10); ctx.lineTo(cx - 3, ent.h - 17); ctx.lineTo(cx + 3, ent.h - 17); ctx.lineTo(cx + 6, ent.h - 10); ctx.fill();
                ctx.fillStyle = '#9a3412';
                ctx.fillRect(cx - 13, ent.h - 3, 26, 3);
             }
          } else if (ent.type === 'OBSTACLE_SOCCER_BALL' || ent.type === 'BOSS_VOLLEY_BALL') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.rotate(-s.frames * 0.35);
             const r = ent.w/2;
             ctx.fillStyle = '#f8fafc';
             ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#111827';
             ctx.beginPath();
             for (let k = 0; k < 5; k++) {
                const a = -Math.PI/2 + k * Math.PI * 2 / 5;
                if (k === 0) ctx.moveTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38); else ctx.lineTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
             }
             ctx.fill();
             for (let k = 0; k < 5; k++) {
                const a = -Math.PI/2 + k * Math.PI * 2 / 5;
                ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.22, 0, Math.PI*2); ctx.fill();
             }
             ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
             ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();
          } else if (ent.type === 'OBSTACLE_BASKETBALL') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.rotate(-s.frames * 0.12);
             const r = ent.w/2;
             ctx.fillStyle = '#ea580c';
             ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.5;
             ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
             ctx.beginPath(); ctx.arc(-r * 1.1, 0, r * 0.8, -0.9, 0.9); ctx.stroke();
             ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.8, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
          } else if (ent.type === 'OBSTACLE_MASCOT') {
             // Big fuzzy dog mascot waddling toward the cat
             const waddle = Math.sin(s.frames * 0.2) * 0.08;
             ctx.translate(ent.w/2, ent.h);
             ctx.rotate(waddle);
             // legs
             ctx.fillStyle = '#1d4ed8';
             ctx.fillRect(-16, -18, 12, 18); ctx.fillRect(4, -18, 12, 18);
             ctx.fillStyle = '#f8fafc';
             ctx.fillRect(-19, -5, 16, 5); ctx.fillRect(2, -5, 16, 5);
             // body / jersey
             ctx.fillStyle = '#2563eb';
             ctx.beginPath(); ctx.roundRect(-22, -48, 44, 34, 10); ctx.fill();
             ctx.fillStyle = '#facc15';
             ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
             ctx.fillText('1', 0, -25);
             ctx.textAlign = 'left';
             // waving arm
             ctx.strokeStyle = '#a16207'; ctx.lineWidth = 7; ctx.lineCap = 'round';
             const wave = Math.sin(s.frames * 0.3) * 0.6;
             ctx.beginPath(); ctx.moveTo(-18, -42); ctx.lineTo(-30 + Math.sin(wave) * 8, -60 - Math.cos(wave) * 4); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(18, -40); ctx.lineTo(26, -26); ctx.stroke();
             // big head
             ctx.fillStyle = '#ca8a04';
             ctx.beginPath(); ctx.arc(0, -58, 16, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#854d0e';
             ctx.beginPath(); ctx.ellipse(-14, -60, 6, 11, 0.3, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.ellipse(14, -60, 6, 11, -0.3, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#fef3c7';
             ctx.beginPath(); ctx.ellipse(-4, -53, 8, 6, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#0f172a';
             ctx.beginPath(); ctx.arc(-9, -62, 2.5, 0, Math.PI*2); ctx.arc(3, -62, 2.5, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(-9, -54, 3, 0, Math.PI*2); ctx.fill();
             // cap
             ctx.fillStyle = '#dc2626';
             ctx.beginPath(); ctx.arc(0, -66, 13, Math.PI, 0); ctx.fill();
             ctx.fillRect(-22, -67, 12, 4);
          } else if (ent.type === 'OBSTACLE_JAVELIN') {
             if (!ent.landed) {
                // Flying: tip at the hitbox, shaft trailing up/back along the velocity
                const vx = s.speed - JAVELIN_DRIFT; // motion relative to the ground (rightward)
                const ang = Math.atan2(ent.vy || JAVELIN_VY0, vx);
                ctx.translate(ent.w/2, ent.h/2);
                ctx.rotate(ang);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(-78, -2, 70, 4);
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(-48, -2.5, 14, 5);
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, 0); ctx.lineTo(-8, 3); ctx.fill();
             } else {
                // Stuck in the track, leaning back
                ctx.translate(ent.w/2, ent.h);
                ctx.rotate(-0.35);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(-2, -58, 4, 60);
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(-2.5, -34, 5, 12);
                // wobble lines just after landing
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
                const wob = Math.sin(s.frames * 0.8) * 3;
                ctx.beginPath(); ctx.moveTo(-6 + wob, -56); ctx.lineTo(-6 + wob, -46); ctx.stroke();
             }
          } else if (ent.type === 'OBSTACLE_FOOTBALL' || ent.type === 'BOSS_ZIGZAG_BALL' || ent.type === 'PLAYER_FOOTBALL' || ent.type === 'BOSS_FOOTBALL_PICKUP') {
             ctx.translate(ent.w/2, ent.h/2);
             if (ent.type === 'BOSS_FOOTBALL_PICKUP') {
                ctx.shadowColor = '#facc15'; ctx.shadowBlur = 20;
             }
             if (ent.type !== 'BOSS_FOOTBALL_PICKUP') {
                ctx.rotate(s.frames * (ent.type === 'PLAYER_FOOTBALL' ? 0.3 : 0.1));
             }
             ctx.fillStyle = ent.type === 'PLAYER_FOOTBALL' ? '#3b82f6' : (ent.type === 'BOSS_ZIGZAG_BALL' ? '#ef4444' : '#b45309');
             if (ent.type === 'BOSS_FOOTBALL_PICKUP') ctx.fillStyle = '#facc15';
             ctx.beginPath(); ctx.ellipse(0, 0, ent.w/2, ent.h/3, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#fff';
             ctx.fillRect(-10, -2, 20, 4); // Laces
             ctx.shadowBlur = 0;
          } else if (ent.type === 'OBSTACLE_TENNIS_BALL') {
             ctx.translate(ent.w/2, ent.h/2);
             ctx.rotate(s.frames * -0.2);
             ctx.fillStyle = '#bef264';
             ctx.beginPath(); ctx.arc(0, 0, ent.w/2, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
             ctx.beginPath(); ctx.arc(-ent.w/2, 0, ent.w/2, -Math.PI/2, Math.PI/2); ctx.stroke();
             ctx.beginPath(); ctx.arc(ent.w/2, 0, ent.w/2, Math.PI/2, Math.PI*1.5); ctx.stroke();
          } else if (ent.type === 'OBSTACLE_WATER_BOTTLE') {
             ctx.fillStyle = '#38bdf8'; // light blue water
             ctx.globalAlpha = 0.6;
             ctx.beginPath(); ctx.roundRect(0, 0, ent.w, ent.h, 4); ctx.fill();
             ctx.globalAlpha = 1;
             ctx.fillStyle = '#e0f2fe';
             ctx.beginPath(); ctx.roundRect(0, 0, ent.w, ent.h, 4); ctx.stroke(); // outline
             ctx.fillStyle = '#ef4444'; // red cap
             ctx.fillRect(ent.w/2 - 6, -6, 12, 6);
          } else if (ent.type === 'OBSTACLE_DUMBBELL') {
             ctx.fillStyle = '#64748b'; // bar
             ctx.fillRect(10, ent.h/2 - 4, ent.w - 20, 8);
             ctx.fillStyle = '#1e293b'; // weights
             ctx.beginPath(); ctx.roundRect(0, 0, 15, ent.h, 4); ctx.fill();
             ctx.beginPath(); ctx.roundRect(ent.w - 15, 0, 15, ent.h, 4); ctx.fill();
          } else if (ent.type === 'OBSTACLE_GAP') {
             // Gap between two buildings: a drop all the way down to a street far below
             const depth = HEIGHT + s.view.bottom - GROUND_Y + 10;
             const g = ctx.createLinearGradient(0, 0, 0, depth);
             g.addColorStop(0, '#040208');
             g.addColorStop(0.75, '#0a0612');
             g.addColorStop(1, '#1f1208');
             ctx.fillStyle = g;
             ctx.fillRect(0, -2, ent.w, depth);
             ctx.fillStyle = '#1a1024'; // inner building walls
             ctx.fillRect(0, -2, 7, depth);
             ctx.fillRect(ent.w - 7, -2, 7, depth);
             ctx.fillStyle = 'rgba(253, 224, 71, 0.55)'; // street lights far below
             ctx.beginPath(); ctx.arc(ent.w * 0.35, depth - 26, 2.5, 0, Math.PI * 2); ctx.arc(ent.w * 0.7, depth - 14, 2, 0, Math.PI * 2); ctx.fill();
             ctx.fillStyle = '#8b7aa8'; // roof lips
             ctx.fillRect(-3, -2, 8, 4);
             ctx.fillRect(ent.w - 5, -2, 8, 4);
             // hazard stripes on the edge before the drop
             for (let k = 0; k < 3; k++) {
                ctx.fillStyle = k % 2 ? '#111827' : '#facc15';
                ctx.fillRect(-18 + k * 6, -2, 6, 3);
             }
          } else if (ent.type === 'OBSTACLE_AC_UNIT') {
             ctx.fillStyle = '#1f2937';
             ctx.fillRect(4, ent.h - 4, 8, 4); ctx.fillRect(ent.w - 12, ent.h - 4, 8, 4);
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath(); ctx.roundRect(0, 0, ent.w, ent.h - 4, 4); ctx.fill();
             ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
             for (let k = 6; k < ent.w / 2; k += 4) { ctx.beginPath(); ctx.moveTo(k, 6); ctx.lineTo(k, ent.h - 10); ctx.stroke(); }
             ctx.fillStyle = '#334155';
             ctx.beginPath(); ctx.arc(ent.w * 0.72, (ent.h - 4) / 2, 12, 0, Math.PI * 2); ctx.fill();
             ctx.save();
             ctx.translate(ent.w * 0.72, (ent.h - 4) / 2);
             ctx.rotate(s.frames * 0.4);
             ctx.fillStyle = '#cbd5e1';
             for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI * 2 / 3); ctx.fillRect(-2, -10, 4, 10); }
             ctx.restore();
          } else if (ent.type === 'OBSTACLE_VENT') {
             // Exhaust pipe with a mushroom cap, puffing steam
             ctx.fillStyle = '#64748b';
             ctx.fillRect(6, 12, ent.w - 12, ent.h - 12);
             ctx.fillStyle = '#94a3b8';
             ctx.fillRect(6, 12, 4, ent.h - 12);
             ctx.fillStyle = '#475569';
             ctx.beginPath(); ctx.ellipse(ent.w / 2, 12, ent.w / 2 + 2, 7, 0, Math.PI, 0); ctx.fill();
             ctx.fillRect(-2, 11, ent.w + 4, 4);
             ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
             for (let k = 0; k < 3; k++) {
                const ph = ((s.frames * 0.8 + k * 20) % 60) / 60;
                ctx.beginPath(); ctx.arc(ent.w / 2 + ph * 8, 4 - ph * 40, 5 + ph * 8, 0, Math.PI * 2); ctx.fill();
             }
          } else if (ent.type === 'OBSTACLE_DISH') {
             // Satellite dish on a post
             ctx.fillStyle = '#475569';
             ctx.fillRect(ent.w / 2 - 3, 18, 6, ent.h - 18);
             ctx.fillRect(ent.w / 2 - 10, ent.h - 4, 20, 4);
             ctx.save();
             ctx.translate(ent.w / 2, 18);
             ctx.rotate(-0.5);
             ctx.fillStyle = '#e2e8f0';
             ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
             ctx.fillStyle = '#cbd5e1';
             ctx.beginPath(); ctx.ellipse(0, 1, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
             ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
             ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -14); ctx.stroke();
             ctx.fillStyle = '#ef4444';
             ctx.beginPath(); ctx.arc(-14, -14, 3, 0, Math.PI * 2); ctx.fill();
             ctx.restore();
          } else if (ent.type === 'BOSS_SHURIKEN') {
             ctx.translate(ent.w / 2, ent.h / 2);
             // motion trail
             ctx.fillStyle = 'rgba(167, 139, 250, 0.35)';
             ctx.fillRect(4, -2, 22, 4);
             ctx.rotate(s.frames * 0.6);
             ctx.fillStyle = '#cbd5e1';
             ctx.beginPath();
             for (let k = 0; k < 4; k++) {
                const a = k * Math.PI / 2;
                ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
                ctx.lineTo(Math.cos(a + Math.PI / 4) * 3.5, Math.sin(a + Math.PI / 4) * 3.5);
             }
             ctx.closePath();
             ctx.fill();
             ctx.fillStyle = '#1e293b';
             ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
          } else if (ent.type === 'NINJA_AMBUSH') {
             const appearing = ent.phase === 'APPEAR';
             if (appearing) {
                // Flickering in from the shadows, with a warning mark
                ctx.globalAlpha = 0.35 + Math.abs(Math.sin((ent.timer || 0) * 0.35)) * 0.4;
             }
             if (!appearing && ent.variant === 'DASH' && (ent.timer || 0) > 6) {
                ctx.fillStyle = 'rgba(196, 181, 253, 0.45)'; // speed lines
                for (let k = 0; k < 3; k++) ctx.fillRect(ent.w + 4 + k * 6, 10 + k * 9, 26 - k * 5, 2);
             }
             drawCat(ctx, { catType: 'ninja', stunTimer: 0, abilityTimer: 0, jumps: 0, vy: 0 }, 0, 0, ent.w, ent.h, !(ent.variant === 'DROP' && ent.y + ent.h < GROUND_Y), true);
             ctx.globalAlpha = 1;
             if (appearing) {
                ctx.fillStyle = Math.floor(s.frames / 5) % 2 === 0 ? '#ef4444' : '#facc15';
                ctx.font = 'bold 26px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('!', ent.w / 2, -12);
                ctx.textAlign = 'left';
             }
             if (ent.isClone) {
                ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
                ctx.beginPath(); ctx.arc(ent.w / 2, ent.h / 2, ent.w * 0.7, 0, Math.PI * 2); ctx.fill();
             }
          } else if (ent.type === 'OBSTACLE_AIRPLANE') {
             // Airplane facing left
             ctx.translate(ent.w/2, ent.h/2);
             // Wings (back)
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath(); ctx.ellipse(0, 0, ent.w/4, ent.h/2, Math.PI/4, 0, Math.PI*2); ctx.fill();
             
             // Body
             ctx.fillStyle = '#e2e8f0';
             ctx.beginPath(); ctx.ellipse(0, 0, ent.w/2, ent.h/4, 0, 0, Math.PI*2); ctx.fill();
             
             // Wings (front)
             ctx.fillStyle = '#cbd5e1';
             ctx.beginPath(); ctx.ellipse(-5, 5, ent.w/3, ent.h/3, -Math.PI/6, 0, Math.PI*2); ctx.fill();
             
             // Tail fin
             ctx.fillStyle = '#ef4444';
             ctx.beginPath(); ctx.moveTo(ent.w/2 - 15, 0); ctx.lineTo(ent.w/2 + 5, 0); ctx.lineTo(ent.w/2, -15); ctx.fill();
             
             // Cockpit (left)
             ctx.fillStyle = '#38bdf8';
             ctx.beginPath(); ctx.ellipse(-ent.w/2 + 15, -4, 8, 4, -0.2, 0, Math.PI*2); ctx.fill();
             
             // Propeller
             ctx.fillStyle = '#1e293b';
             ctx.beginPath(); ctx.ellipse(-ent.w/2, 0, 2, 8, s.frames, 0, Math.PI*2); ctx.fill();
          }
        }
        
        ctx.restore();
      }

      
      // Draw Boss
      if (s.boss.active && !s.boss.defeated) {
         // Boss Warning UI
         if (s.boss.state === 'DEFEATED_ANIM') {
            ctx.save();
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 50px monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#22c55e';
            ctx.fillText('BOSS DEFEATED!', WIDTH / 2, HEIGHT / 3);
            
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 26px monospace';
            ctx.shadowColor = '#f59e0b';
            // playerData still holds the pre-fight save here, so this tells us if it's the first win
            const bt = s.boss.type;
            const firstWin = bt === 'mafia' ? !playerData.stats?.bossDefeated
              : bt === 'ninja' ? !playerData.stats?.rooftopBossDefeated
              : !playerData.stats?.stadiumBossDefeated;
            const unlockText = { mafia: 'UNLOCKED: MAFIA CAT & BUILDING TOPS', ninja: 'UNLOCKED: NINJA CAT & STADIUM', athlete: 'UNLOCKED: ATHLETE CAT' }[bt];
            const powerText = { mafia: 'NEW POWER-UPS: INVINCIBLE FISH + SLOW TIME', ninja: '', athlete: 'NEW POWER-UP: FISH CANNON' }[bt];
            if (firstWin) {
              ctx.fillText(unlockText, WIDTH / 2, HEIGHT / 3 + 50);
              if (powerText) {
                ctx.fillStyle = '#fb923c';
                ctx.font = 'bold 20px monospace';
                ctx.shadowColor = '#fb923c';
                ctx.fillText(powerText, WIDTH / 2, HEIGHT / 3 + 85);
              }
            } else {
              ctx.fillText('+500m BONUS', WIDTH / 2, HEIGHT / 3 + 50);
            }
            const nextArea = bt === 'mafia' ? 'BUILDING TOPS' : bt === 'ninja' ? 'THE STADIUM' : '';
            if (nextArea) {
              ctx.fillStyle = '#e2e8f0';
              ctx.font = 'bold 18px monospace';
              ctx.shadowBlur = 0;
              ctx.fillText(`NEXT: ${nextArea} →`, WIDTH / 2, HEIGHT / 3 + 120);
            }
            ctx.restore();
         } else if (s.boss.state === 'ENTER' || s.boss.state === 'DIALOGUE') {
            ctx.save();
            ctx.fillStyle = (Math.floor(s.frames / 15) % 2 === 0) ? '#ef4444' : '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ef4444';
            ctx.fillText(s.boss.type === 'athlete' ? 'WARNING: ATHLETE BOSS' : s.boss.type === 'ninja' ? 'WARNING: NINJA BOSS' : 'WARNING: BOSS BATTLE', WIDTH / 2, HEIGHT / 3);
            ctx.restore();
         }
         
         ctx.save();
         // Ninja dive: mark where he'll land
         if (s.boss.state === 'DIVE' && !s.boss.hidden && !s.boss.landed && s.boss.timer > 22) {
             const pulse = 0.5 + Math.abs(Math.sin(s.frames * 0.3)) * 0.5;
             ctx.strokeStyle = 'rgba(239, 68, 68, ' + pulse + ')';
             ctx.lineWidth = 3;
             ctx.beginPath(); ctx.ellipse(s.boss.x + s.boss.w/2, GROUND_Y + 3, 26, 7, 0, 0, Math.PI*2); ctx.stroke();
         }
         // Boss shadow
         ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
         if (!s.boss.hidden) { ctx.beginPath(); ctx.ellipse(s.boss.x + s.boss.w/2, GROUND_Y, s.boss.w/2 + 10, 8, 0, 0, Math.PI*2); ctx.fill(); }
         

         ctx.restore();

         // Draw Mafia Boss using shared drawCat
         const bossCatObj = { 
            catType: s.boss.type, 
            stunTimer: 0,
            abilityTimer: 0,
            jumps: 0,
            vy: 0
         };
         
         ctx.save();
         if (s.boss.state === 'HURT') {
             // Hit flash: red glow + flicker instead of a solid red box
             ctx.shadowColor = '#ef4444';
             ctx.shadowBlur = 25;
             if (Math.floor(s.boss.timer / 3) % 2 === 0) ctx.globalAlpha = 0.45;
         }
         // drawCat is authored for a 40x40 cat, so scale it up rather than stretching the box
         ctx.translate(s.boss.x, s.boss.y + s.boss.h);
         ctx.scale(s.boss.w / 40, s.boss.h / 40);
         if (!s.boss.hidden) drawCat(ctx, bossCatObj, 0, -40, 40, 40, !(s.boss.type === 'ninja' && s.boss.state === 'DIVE' && !s.boss.landed), true);
         ctx.restore();

         if (s.boss.state === 'DIALOGUE') {
             ctx.save();
             ctx.translate(s.boss.x + s.boss.w/2, s.boss.y - 10);
             ctx.fillStyle = '#fff';
             ctx.beginPath();
             ctx.roundRect(-60, -40, 120, 30, 10);
             ctx.fill();
             ctx.beginPath();
             ctx.moveTo(0, 0);
             ctx.lineTo(-5, -10);
             ctx.lineTo(5, -10);
             ctx.fill();
             ctx.fillStyle = '#000';
             ctx.font = 'bold 12px monospace';
             ctx.textAlign = 'center';
             ctx.fillText(s.boss.type === 'athlete' ? 'READY FOR' : s.boss.type === 'ninja' ? 'You never' : 'You think you', 0, -26);
             ctx.fillText(s.boss.type === 'athlete' ? 'KICKOFF?' : s.boss.type === 'ninja' ? 'saw me coming.' : 'can run?', 0, -14);
             ctx.restore();
         }

         // Gun if shooting
         if (s.boss.type !== 'athlete' && (s.boss.state === 'SHOOT' || s.boss.state === 'WINDUP_SHOOT')) {
             ctx.save();
             ctx.translate(s.boss.x + s.boss.w/2, s.boss.y + s.boss.h/2);
             ctx.fillStyle = '#94a3b8';
             ctx.fillRect(-s.boss.w/2 - 20, 10, 30, 8); // gun barrel
             ctx.fillRect(-s.boss.w/2 - 5, 10, 8, 15); // handle
             ctx.restore();
         } else if (s.boss.type === 'athlete' && s.boss.state === 'WINDUP_VOLLEY') {
             // Ball at his feet, ready to kick
             ctx.save();
             ctx.translate(s.boss.x - 8, GROUND_Y - 12);
             ctx.fillStyle = '#f8fafc';
             ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#111827';
             ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
             ctx.restore();
         } else if (s.boss.type === 'athlete' && s.boss.state === 'WINDUP_JAVELIN') {
             // Javelin raised over his shoulder
             ctx.save();
             ctx.translate(s.boss.x + 20, s.boss.y + 8);
             ctx.rotate(-0.6);
             ctx.fillStyle = '#e2e8f0';
             ctx.fillRect(-30, -2, 60, 4);
             ctx.fillStyle = '#dc2626';
             ctx.fillRect(-4, -2.5, 10, 5);
             ctx.restore();
         } else if (s.boss.type === 'athlete' && s.boss.state === 'WINDUP_SPRINT') {
             ctx.save();
             ctx.textAlign = 'center';
             ctx.font = 'bold 18px monospace';
             ctx.fillStyle = '#fef08a';
             ctx.fillText('ON YOUR MARKS!', s.boss.x + s.boss.w / 2, s.boss.y - 40);
             ctx.restore();
         }

         
         // Telegraphing Warning
         if (s.boss.state.startsWith('WINDUP_')) {
             ctx.fillStyle = (Math.floor(s.frames / 5) % 2 === 0) ? '#ef4444' : '#facc15';
             ctx.font = 'bold 40px monospace';
             ctx.textAlign = 'center';
             ctx.fillText('!', s.boss.x + s.boss.w/2, s.boss.y - 10);
         }

         

         // Boss HP Bar (placed just below the HUD overlay)
         const barY = Math.max(60, s.view.hud + 44 - s.view.top);
         const hpFrac = Math.max(0, s.boss.hp) / s.boss.maxHp;
         ctx.fillStyle = '#1e293b';
         ctx.fillRect(WIDTH/2 - 200, barY, 400, 24);
         ctx.fillStyle = hpFrac > 0.5 ? '#ef4444' : hpFrac > 0.25 ? '#f97316' : '#facc15';
         ctx.fillRect(WIDTH/2 - 200, barY, 400 * hpFrac, 24);
         ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 3;
         ctx.strokeRect(WIDTH/2 - 200, barY, 400, 24);
         ctx.fillStyle = '#fff';
         ctx.font = 'bold 24px monospace';
         ctx.textAlign = 'center';
         ctx.fillText(s.boss.type === 'mafia' ? 'MAFIA CAT' : s.boss.type === 'ninja' ? 'NINJA CAT' : 'ATHLETE CAT', WIDTH/2, barY - 12);
         ctx.font = 'bold 16px monospace';
         ctx.fillText(`${Math.max(0, Math.ceil(s.boss.hp))} / ${s.boss.maxHp}`, WIDTH/2, barY + 18);


      }

      // Shadow for cat
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath(); ctx.ellipse(cat.x + cat.w/2, GROUND_Y, cat.w/2 + 5, 5, 0, 0, Math.PI*2); ctx.fill();

      
      // Draw timers on head
      let timerOffset = -15;
      const drawTimer = (text, color) => {
          ctx.fillStyle = color;
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'black';
          ctx.strokeText(text, cat.x + cat.w/2, cat.y + timerOffset);
          ctx.fillText(text, cat.x + cat.w/2, cat.y + timerOffset);
          timerOffset -= 15;
      };
      if (cat.goldenBoostTimer > 0) drawTimer(`${Math.ceil(cat.goldenBoostTimer / 60)}s Invincible`, '#fcd34d');
      if (cat.wingsTimer > 0) drawTimer(`${Math.ceil(cat.wingsTimer / 60)}s Wings`, '#7dd3fc');
      if (cat.timeSlowTimer > 0) drawTimer(`${Math.ceil(cat.timeSlowTimer / 60)}s Slow`, '#c084fc');
      if (cat.fishCannonTimer > 0) drawTimer(`${Math.ceil(cat.fishCannonTimer / 60)}s Cannon`, '#fca5a5');
      if (cat.abilityCooldown > 0 && cat.catType === 'ninja') drawTimer(`${Math.ceil(cat.abilityCooldown / 60)}s CD`, '#fca5a5');
      
      drawCat(ctx, { ...cat, catType: playerData.currentColor }, cat.x, cat.y, cat.w, cat.h, cat.isGrounded);


      
      // Mafia Minion (running in front)
      if (cat.catType === 'mafia' && cat.hasShield) {
         const mCat = { isMinion: true,
            catType: cat.minionType || 'default',
            stunTimer: 0, abilityTimer: 0, jumps: 0, vy: 0
         };
         // It floats slightly
         const offsetY = Math.abs(Math.sin(s.frames * 0.2))*5;
         // Draw it smaller (w=30, h=30)
         drawCat(ctx, mCat, cat.x + cat.w + 10, cat.y + 10 - offsetY, 30, 30, true, false);
      }

      // Time Slow Vignette

      if (cat.timeSlowTimer > 0) {
         ctx.save();
         const vTop = -s.view.top, vH = s.view.h, vMid = vTop + vH / 2;
         const gradient = ctx.createRadialGradient(WIDTH/2, vMid, WIDTH/4, WIDTH/2, vMid, Math.max(WIDTH, vH) / 1.2);
         gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
         gradient.addColorStop(1, 'rgba(124, 58, 237, 0.4)'); // Purple tint at edges
         ctx.fillStyle = gradient;
         ctx.fillRect(0, vTop, WIDTH, vH);
         ctx.restore();
      }

      // Draw Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        if (!isReflection) {
          // Only the real pass advances particles (the wet-street reflection just redraws them)
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
        }
        const lifeRatio = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = isReflection ? lifeRatio * s.weather.wetness * 0.4 : lifeRatio;
        ctx.fillStyle = p.color;
        
        if (p.type !== 'TEXT') {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.type === 'confetti' ? 5 : 10;
        }
        
        if (p.type === 'TEXT') {
          ctx.font = `bold ${p.size}px monospace`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'black';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
        } else if (p.type === 'sparkle') {
          const currentSize = p.size * lifeRatio * 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - currentSize);
          ctx.lineTo(p.x + currentSize/3, p.y - currentSize/3);
          ctx.lineTo(p.x + currentSize, p.y);
          ctx.lineTo(p.x + currentSize/3, p.y + currentSize/3);
          ctx.lineTo(p.x, p.y + currentSize);
          ctx.lineTo(p.x - currentSize/3, p.y + currentSize/3);
          ctx.lineTo(p.x - currentSize, p.y);
          ctx.lineTo(p.x - currentSize/3, p.y - currentSize/3);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'confetti') {
          ctx.save();
          ctx.translate(p.x, p.y);
          // Spin confetti
          ctx.rotate((s.frames * 0.1) + p.x);
          // Make confetti flutter (change height scale based on rotation)
          const flutter = Math.sin((s.frames * 0.1) + p.y) * p.size;
          ctx.fillRect(-p.size/2, -flutter/2, p.size, flutter);
          ctx.restore();
        } else {
          const currentSize = (p.size || 3) * lifeRatio;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, currentSize), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      s.particles = s.particles.filter(p => p.life > 0);
      
      
      };

      if (s.weather.wetness > 0 && s.map === 'City') {
          ctx.save();
          ctx.translate(0, GROUND_Y * 2);
          ctx.scale(1, -1);
          ctx.globalAlpha = s.weather.wetness * 0.4;
          
          // Add a clipping region so we only draw the reflection ON the street
          // Only reflect what's just above the street (mirrored: world y 600..760).
          // Anything higher, like the boss HP bar, would otherwise appear upside-down
          // in the extra ground area on tall screens.
          ctx.beginPath();
          ctx.rect(0, GROUND_Y - 160, WIDTH, 160);
          ctx.clip();
          
          drawSceneObjects(true);
          ctx.restore();
      }
      
      drawSceneObjects(false);

      drawCallout(ctx);

      // Area change fade (out to black, then back in on the new area)
      {
        let fade = 0;
        if (s.transition?.phase === 'FADE_OUT') fade = s.transition.t / TRANSITION_FADE_FRAMES;
        else if (s.mapTransitionTimer > 0 && s.frames - s.mapTransitionTimer < TRANSITION_FADE_FRAMES) fade = 1 - (s.frames - s.mapTransitionTimer) / TRANSITION_FADE_FRAMES;
        if (fade > 0) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
          ctx.fillRect(0, -view.top, WIDTH, view.h);
        }
      }

      // Knock-out fade before the Game Over screen
      if (cat.dead) {
        const k = 1 - Math.max(0, cat.stunTimer) / DEATH_ANIM_FRAMES;
        const vTop = -view.top;
        ctx.save();
        ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(0.75, k * 0.85)})`;
        ctx.fillRect(0, vTop, WIDTH, view.h);
        if (k > 0.25) {
          ctx.globalAlpha = Math.min(1, (k - 0.25) * 3);
          ctx.textAlign = 'center';
          ctx.font = 'bold 44px monospace';
          ctx.fillStyle = '#f43f5e';
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 20;
          ctx.fillText('KNOCKED OUT!', WIDTH / 2, GROUND_Y - 220);
        }
        ctx.restore();
      }
      
      // Draw Map Name
      const sinceMap = s.frames - s.mapTransitionTimer; // also replays when the run enters the Stadium
      if (sinceMap < 240) { // Show for 4 seconds
        ctx.save();
        let alpha = 1;
        if (sinceMap < 60) {
           alpha = sinceMap / 60; // Fade in
        } else if (sinceMap > 180) {
           alpha = (240 - sinceMap) / 60; // Fade out
        }
        
        ctx.globalAlpha = alpha;
        
        // Map Name
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc'; // slate-50
        ctx.font = 'bold 36px monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(s.map === 'Stadium' ? 'STAGE 3 · THE STADIUM' : s.map === 'Rooftop' ? 'STAGE 2 · BUILDING TOPS' : 'STAGE 1 · NIGHT CITY', WIDTH / 2, HEIGHT / 4);
        
        ctx.font = '16px monospace';
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(s.map === 'Stadium' ? 'GRAND ARENA' : s.map === 'Rooftop' ? 'WATCH FOR NINJAS' : 'OUTSKIRTS', WIDTH / 2, HEIGHT / 4 + 30);
        
        ctx.restore();
      }

      // UI update via DOM refs instead of canvas to match Elegant Dark layout
      if (scoreRef.current) {
        scoreRef.current.innerText = `${Math.floor(s.score)}m`;
      }
      if (comboRef.current) {
        if (s.combo > 1) {
          comboRef.current.innerText = `x${s.combo}`;
          comboRef.current.style.transform = `scale(${1 + Math.min(s.combo * 0.1, 0.5)})`;
          comboRef.current.style.opacity = '1';
        } else {
          comboRef.current.style.transform = 'scale(0)';
          comboRef.current.style.opacity = '0';
        }
      }
      if (yarnsRef.current) {
        yarnsRef.current.innerText = `${s.yarnsCollected}`;
      }
      if (boostContainerRef.current && boostRef.current) {
        if (cat.goldenBoostTimer > 0) {
          boostContainerRef.current.style.display = 'flex';
          boostRef.current.innerText = `${Math.ceil(cat.goldenBoostTimer / 60)}s`;
        } else {
          boostContainerRef.current.style.display = 'none';
        }
      }
      if (wingsContainerRef.current && wingsRef.current) {
        if (cat.wingsTimer > 0) {
          wingsContainerRef.current.style.display = 'flex';
          wingsRef.current.innerText = `${Math.ceil(cat.wingsTimer / 60)}s`;
        } else {
          wingsContainerRef.current.style.display = 'none';
        }
      }
      
      if (abilityContainerRef.current && abilityRef.current) {
        if (cat.abilityCooldown > 0) {
          abilityContainerRef.current.style.display = 'flex';
          abilityRef.current.style.opacity = '1';
          abilityRef.current.innerText = `${Math.ceil(cat.abilityCooldown / 60)}s`;
        
        } else if (cat.catType === 'wizard') {
          abilityContainerRef.current.style.display = 'flex';
          abilityRef.current.style.opacity = '1';
          abilityRef.current.innerText = Math.floor(cat.mana || 0) + ' MP';
        } else if (cat.catType !== 'default' && cat.catType !== 'strong' && cat.catType !== 'super') {
          abilityContainerRef.current.style.display = 'flex';
          abilityRef.current.style.opacity = '0';
        } else {
          abilityContainerRef.current.style.display = 'none';
        }

      }

      if (s.isGameOver) {
        audio.stopBossMusic();
        onGameOver(Math.floor(s.score), s.yarnsCollected, s.stats.totalJumps, s.stats.obstaclesDestroyed, s.frames);
      } else {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [onGameOver, playerData]);

  return (
    <div ref={stageRef} className="w-full h-full relative font-mono overflow-hidden bg-[#01030c]" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* TOP HUD — floats over the extra sky instead of taking its own black strip */}
      <div ref={hudRef} className="absolute top-0 left-0 w-full px-3 pt-3 flex justify-between items-start z-30 pointer-events-none">
        <div className="flex flex-col items-start bg-slate-950/55 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/10">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400">Distance</div>
          <div className="flex items-center gap-2">
            <div ref={scoreRef} className="text-xl sm:text-3xl font-bold text-white leading-tight">0m</div>
            <div ref={comboRef} className="text-base sm:text-xl font-black text-rose-500 italic transition-all duration-200" style={{ transform: 'scale(0)', opacity: 0, textShadow: '0 0 10px rgba(244,63,94,0.6)' }}>x1</div>
          </div>
        </div>

        <div className="flex flex-col items-end bg-slate-950/55 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/10">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-yellow-500 whitespace-nowrap">Fish Caught</div>
          <div className="flex items-center gap-1.5">
            <Fish className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <div ref={yarnsRef} className="text-xl sm:text-3xl font-bold text-yellow-400 leading-tight">0</div>
          </div>
        </div>
      </div>

      {/* Pause button (top centre, between the HUD boxes) */}
      <button
        onClick={() => setGamePaused(true)}
        aria-label="Pause"
        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-11 h-11 flex items-center justify-center rounded-full bg-slate-950/60 border border-white/15 text-slate-100 backdrop-blur-sm active:bg-slate-800"
      >
        <Pause size={20} fill="currentColor" />
      </button>

      {paused && !showStage4 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-6">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="mb-6 text-3xl font-black uppercase tracking-widest text-white">Paused</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGamePaused(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-lg font-black uppercase tracking-widest text-slate-950 active:bg-amber-400"
              >
                <Play size={20} fill="currentColor" /> Resume
              </button>
              <button
                onClick={finishRun}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold uppercase tracking-widest text-slate-200 active:bg-slate-700"
              >
                <LogOut size={16} /> End Run
              </button>
            </div>
          </div>
        </div>
      )}

      {showStage4 && (
        <UnderDevelopment
          title="Stage 4"
          secondaryLabel="Keep Running"
          onSecondary={() => { setShowStage4(false); state.current.paused = false; }}
          backLabel="Finish Run"
          onBack={finishRun}
        />
      )}

      {/* BOTTOM — controls hint over the extra ground */}
      <div className="absolute bottom-3 sm:bottom-6 left-0 w-full flex flex-col items-center justify-end gap-1 text-center text-[10px] sm:text-xs text-slate-400/80 font-bold uppercase tracking-widest pointer-events-none z-20">
        <div className="md:hidden">TAP TO JUMP · TAP AGAIN TO DOUBLE JUMP</div>
        <div className="hidden md:block">SPACE / CLICK TO JUMP · E TO USE ABILITY · ESC TO PAUSE</div>
        {playerData.currentColor !== 'default' && playerData.currentColor !== 'strong' && (
           <div ref={abilityHintRef} className="animate-pulse text-emerald-400 md:hidden">SWIPE RIGHT TO USE ABILITY</div>
        )}
      </div>

      {/* Legacy power-up HUD (timers are drawn above the cat on the canvas) */}
      <div className="hidden">
        <div ref={boostContainerRef} className="flex-col items-center min-w-[80px]" style={{ display: "none" }}>
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-red-500 mb-1 flex items-center justify-center gap-1 whitespace-nowrap">
            <Shield size={12} className="sm:w-4 sm:h-4" />
            Invincible
          </div>
          <div ref={boostRef} className="text-xl sm:text-2xl font-bold text-red-500 text-center">0s</div>
        </div>

        <div ref={wingsContainerRef} className="flex-col items-center min-w-[80px]" style={{ display: "none" }}>
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-blue-400 mb-1 flex items-center justify-center gap-1 whitespace-nowrap">
            <Feather size={12} className="sm:w-4 sm:h-4" />
            Wings
          </div>
          <div ref={wingsRef} className="text-xl sm:text-2xl font-bold text-blue-400 text-center">0s</div>
        </div>

        <div ref={abilityContainerRef} className="flex-col items-center min-w-[80px]" style={{ display: "none" }}>
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-emerald-400 mb-1 whitespace-nowrap text-center">Skill</div>
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-slate-900 border-2 border-emerald-500/50 rounded-lg flex items-center justify-center overflow-hidden mx-auto">
             <div ref={abilityRef} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-emerald-400 font-bold text-sm sm:text-base z-10 transition-opacity">
                RDY
             </div>
             <div className="text-emerald-500 flex items-center justify-center w-full h-full">
                {playerData.currentColor === "athlete" && <Zap size={28} className="sm:w-8 sm:h-8" />}
                {playerData.currentColor === "ninja" && <Sword size={28} className="sm:w-8 sm:h-8" />}
                {playerData.currentColor === "wizard" && <Wand2 size={28} className="sm:w-8 sm:h-8" />}
                {playerData.currentColor === "ghost" && <Ghost size={28} className="sm:w-8 sm:h-8" />}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
