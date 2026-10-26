import React, { useEffect, useRef, useState } from 'react';
import { PlayerData } from '../types';
import {  Play, ShoppingCart, Trophy, ImageIcon, X, Target, CheckCircle, Award , Fish, Map, Lock, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import UnderDevelopment from './UnderDevelopment';
import { motion, AnimatePresence } from 'motion/react';
import { STORE_ITEMS, MAP_ORDER, MAP_INFO } from '../types';
import { drawCat } from '../utils/drawCat';
import { audio } from '../utils/audio';

interface CatRoomProps {
  onPlay: () => void;
  onStore: () => void;
  onGallery: () => void;
  onLeaderboard: () => void;
  onAchievements: () => void;
  playerData: PlayerData;
  setPlayerData: React.Dispatch<React.SetStateAction<PlayerData>>;
}

const ROOM_W = 800;
const ROOM_H = 1000;

export default function CatRoom({ onPlay, onStore, onGallery, onLeaderboard, onAchievements, playerData, setPlayerData }: CatRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Canvas height and how far the 800x1000 room is pushed down inside it
  const viewRef = useRef({ h: ROOM_H, top: 0 });

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const fit = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      const h = Math.min(2400, Math.max(ROOM_H, Math.round(ROOM_W * ch / cw)));
      viewRef.current = { h, top: Math.round((h - ROOM_H) * 0.45) };
      if (canvas.height !== h) canvas.height = h;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const framesRef = useRef(0);
  const animationRef = useRef<number>();
  
  const [activeCatAnim, setActiveCatAnim] = useState<{ id: string, phase: 'WAKE' | 'JUMP', progress: number } | null>(null);
  const [afkTimer, setAfkTimer] = useState(0);
  const [showAfkMsg, setShowAfkMsg] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setAfkTimer(prev => prev + 1), 1000);
    const reset = () => { setAfkTimer(0); setShowAfkMsg(false); };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('touchstart', reset);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, []);

  useEffect(() => {
    if (afkTimer === 5) setShowAfkMsg(true);
    if (afkTimer === 9) setShowAfkMsg(false);
  }, [afkTimer]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showBossArchives, setShowBossArchives] = useState(false);
  const [showMapSelect, setShowMapSelect] = useState(false);
  const [ranksTab, setRanksTab] = useState<'local' | 'global'>('local');
  const [underDev, setUnderDev] = useState<string | null>(null);
  const [muted, setMuted] = useState(audio.isMuted());

  // Android back button in the room: close whatever is open, otherwise leave the app
  useEffect(() => {
    const onBack = () => {
      if (underDev) setUnderDev(null);
      else if (showMapSelect) setShowMapSelect(false);
      else if (showBossArchives) setShowBossArchives(false);
      else if (showLeaderboard) setShowLeaderboard(false);
      else if (Capacitor.isNativePlatform()) CapApp.exitApp();
    };
    window.addEventListener('mp-menu-back', onBack);
    return () => window.removeEventListener('mp-menu-back', onBack);
  });
  const unlockedMaps = [...(playerData.unlockedMaps || ['City'])].sort(
    (a, b) => MAP_ORDER.indexOf(a as any) - MAP_ORDER.indexOf(b as any)
  );
  const currentMap = playerData.currentMap || 'City';


  const [currentRoom, setCurrentRoom] = useState<string>('Bedroom');

  const unlockedRooms = playerData.unlockedRooms || ['Bedroom'];
  const roomDistribution: Record<string, string[]> = {};
  unlockedRooms.forEach(r => roomDistribution[r] = []);
  
  let currentRoomIdx = 0;
  playerData.ownedColors.forEach(catId => {
    let rId = unlockedRooms[currentRoomIdx];
    let rData = STORE_ITEMS.rooms?.find(r => r.id === rId);
    while (rData && roomDistribution[rId]?.length >= rData.capacity) {
       currentRoomIdx++;
       rId = unlockedRooms[currentRoomIdx];
       rData = STORE_ITEMS.rooms?.find(r => r.id === rId);
    }
    if (rId) {
      if (!roomDistribution[rId]) roomDistribution[rId] = [];
      roomDistribution[rId].push(catId);
    }
  });

  const ROOM_CONFIGS: Record<string, { slots: any[], wall: string, floor: string }> = {
    Bedroom: {
      wall: '#334155', floor: '#475569',
      slots: [
        { x: 350, y: 700, z: 756 },
        { x: 150, y: 850, z: 850 },
        { x: 670, y: 450, z: 711 },
        { x: 280, y: 750, z: 761 },
        { x: 450, y: 800, z: 800 },
        { x: 550, y: 850, z: 850 }
      ]
    },
    Livingroom: {
      wall: '#78350f', floor: '#92400e',
      slots: [
        { x: 200, y: 700, z: 750 },
        { x: 400, y: 850, z: 850 },
        { x: 600, y: 750, z: 750 },
        { x: 300, y: 800, z: 800 }
      ]
    },
    Bathroom: {
      wall: '#0ea5e9', floor: '#0284c7',
      slots: [
        { x: 250, y: 750, z: 750 },
        { x: 450, y: 850, z: 850 }
      ]
    },
    Balcony: {
      wall: '#0f172a', floor: '#1e293b',
      slots: [
        { x: 300, y: 750, z: 750 },
        { x: 500, y: 800, z: 800 },
        { x: 200, y: 850, z: 850 }
      ]
    },
    Kitchen: {
      wall: '#f59e0b', floor: '#d97706',
      slots: [
        { x: 250, y: 750, z: 750 },
        { x: 450, y: 800, z: 800 },
        { x: 650, y: 850, z: 850 },
        { x: 350, y: 820, z: 820 }
      ]
    }
  };

  const currentRoomConfig = ROOM_CONFIGS[currentRoom] || ROOM_CONFIGS['Bedroom'];
  const SLOTS = currentRoomConfig.slots;
  const currentRoomCats = roomDistribution[currentRoom] || [];

  const catsInRoom = currentRoomCats.map((colorId, i) => {
    const state = ['SLEEPING', 'SITTING', 'STANDING', 'PLAYING', 'EATING'][i % 5];
    const slot = SLOTS[i % SLOTS.length];
    return {
      roomState: state,
      id: colorId,
      x: slot.x,
      y: slot.y,
      w: 60,
      h: 60,
      catType: colorId,
      z: slot.z
    };
  });


  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeCatAnim) return; // Prevent click during anim
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Map the tap to room coordinates, accounting for object-contain and the
    // extra wall/floor added above/below the 800x1000 room on tall screens.
    const canvasH = viewRef.current.h;
    const canvasAspect = ROOM_W / canvasH;
    const rectAspect = rect.width / rect.height;
    
    let displayedWidth = rect.width;
    let displayedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (rectAspect > canvasAspect) {
      // Pillarboxed
      displayedHeight = rect.height;
      displayedWidth = rect.height * canvasAspect;
      offsetX = (rect.width - displayedWidth) / 2;
    } else {
      // Letterboxed
      displayedWidth = rect.width;
      displayedHeight = rect.width / canvasAspect;
      offsetY = (rect.height - displayedHeight) / 2;
    }
    
    const scaleX = ROOM_W / displayedWidth;
    const scaleY = canvasH / displayedHeight;

    const x = (e.clientX - rect.left - offsetX) * scaleX;
    const y = (e.clientY - rect.top - offsetY) * scaleY - viewRef.current.top;

    // Check if clicked on a cat
    for (const cat of catsInRoom) {
      // Cat bounding box (bottom center origin in drawCat, so we adjust)
      // x is top-left in drawCat? Wait, drawCat uses x,y as top left.
      // Wait, let's check drawCat: `ctx.translate(x + w/2, y + h - bounce);`
      // So bounding box is roughly x to x+w, y to y+h
      if (x > cat.x - 20 && x < cat.x + cat.w + 20 && y > cat.y - 20 && y < cat.y + cat.h + 20) {
        // Select this cat
        setPlayerData({ 
          ...playerData, 
          currentColor: cat.id,
          stats: {
            ...(playerData.stats || { totalDistance: 0, totalYarns: 0, totalObstacles: 0 }),
            catFriendship: {
              ...(playerData.stats?.catFriendship || {}),
              [cat.id]: (playerData.stats?.catFriendship?.[cat.id] || 0) + 1
            }
          }
        });
        setActiveCatAnim({ id: cat.id, phase: 'WAKE', progress: 0 });
        break;
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animProgress = 0;

    const render = () => {
      framesRef.current++;
      if (framesRef.current % 300 === 0 && Math.random() < 0.5) {
        audio.init();
        if (Math.random() < 0.5) audio.playMeow();
        else audio.playPurr();
      }
      const frames = framesRef.current;

      // The room scene is 800x1000; on taller screens the canvas is taller and
      // we extend the wall upward and the floor downward instead of letterboxing.
      const { top, h } = viewRef.current;
      const bottom = h - ROOM_H - top;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(0, top);
      if (top > 0) {
        if (currentRoom === 'Balcony') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, -top, 800, top);
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 40; i++) {
            ctx.globalAlpha = 0.4 + Math.sin(frames * 0.05 + i) * 0.4;
            ctx.fillRect((i * 173) % 800, -top + ((i * 89) % Math.max(1, top)), 2, 2);
          }
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = currentRoomConfig.wall;
          ctx.fillRect(0, -top, 800, top);
          ctx.fillStyle = '#475569';
          for (let i = 0; i < 800; i += 40) ctx.fillRect(i, -top, 20, top);
          // Ceiling shade + crown molding
          const shade = ctx.createLinearGradient(0, -top, 0, 0);
          shade.addColorStop(0, 'rgba(2, 6, 23, 0.75)');
          shade.addColorStop(1, 'rgba(2, 6, 23, 0.1)');
          ctx.fillStyle = shade;
          ctx.fillRect(0, -top, 800, top);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, -top, 800, 14);
          // Hanging lamp with a warm glow (centered, clear of the side buttons)
          const LX = 400;
          const lampY = Math.max(-top + 14, -120);
          ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(LX, -top + 14); ctx.lineTo(LX, lampY + 60); ctx.stroke();
          const glow = ctx.createRadialGradient(LX, lampY + 80, 5, LX, lampY + 80, 220);
          glow.addColorStop(0, 'rgba(253, 224, 71, 0.25)');
          glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(LX - 220, lampY - 140, 440, 440);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath(); ctx.moveTo(LX - 30, lampY + 80); ctx.lineTo(LX + 30, lampY + 80); ctx.lineTo(LX + 15, lampY + 60); ctx.lineTo(LX - 15, lampY + 60); ctx.fill();
          ctx.fillStyle = '#fef9c3';
          ctx.beginPath(); ctx.arc(LX, lampY + 82, 7, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (bottom > 0) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(0, ROOM_H, 800, bottom);
        ctx.strokeStyle = '#271002';
        ctx.lineWidth = 2;
        for (let i = -200; i < 1000; i += 60) {
          // continue the floor planks' perspective lines (slope -100px per 400px)
          ctx.beginPath(); ctx.moveTo(i - 100, ROOM_H); ctx.lineTo(i - 100 - bottom * 0.25, ROOM_H + bottom); ctx.stroke();
        }
        const fshade = ctx.createLinearGradient(0, ROOM_H, 0, ROOM_H + bottom);
        fshade.addColorStop(0, 'rgba(0,0,0,0)');
        fshade.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = fshade;
        ctx.fillRect(0, ROOM_H, 800, bottom);
      }

      // Clear
      ctx.fillStyle = '#0f172a'; // deep night sky
      ctx.fillRect(0, 0, 800, 1000);
      
      // Draw Sky, Stars & Moon
      ctx.fillStyle = '#f8fafc';
      for(let i=0; i<100; i++) {
         const sx = (Math.sin(i * 123) * 400 + 400);
         const sy = (Math.cos(i * 321) * 300 + 300);
         const sSize = Math.abs(Math.sin(frames * 0.02 + i)) * 1.5;
         ctx.beginPath(); ctx.arc(sx, sy, sSize, 0, Math.PI*2); ctx.fill();
      }
      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(254, 240, 138, 0.6)';
      ctx.beginPath(); ctx.arc(600, 150, 40, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;


      if (currentRoom === 'Balcony') {
        // Just draw Skyline big
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 800, 600); // sky
        
        // Stars
        ctx.fillStyle = '#fff';
        for(let i=0; i<30; i++) {
           const sx = (i * 137) % 800;
           const sy = (i * 97) % 400;
           ctx.globalAlpha = 0.5 + Math.sin(frames * 0.05 + i) * 0.5;
           ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1.0;

        ctx.translate(0, 150);
        // Skyline
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 300, 800, 200);
        for(let i=0; i<32; i++) {
          const bHeight = 100 + Math.sin(i * 1.5) * 150;
          ctx.fillRect(i*25, 400 - bHeight, 20, bHeight);
          // Window lights
          if (i % 2 === 0) {
            ctx.fillStyle = '#fef08a';
            ctx.globalAlpha = 0.5 + Math.sin(frames * 0.05 + i) * 0.2;
            for (let w = 0; w < 5; w++) {
              ctx.fillRect(i*25 + 5, 400 - bHeight + 10 + w*15, 10, 8);
            }
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#1e293b';
          }
        }
        ctx.restore();
        
        ctx.fillStyle = currentRoomConfig.floor;
        ctx.fillRect(0, 550, 800, 450);
      } else {
        // Draw Window and City Skyline
        ctx.save();

      ctx.translate(350, 150);
      
      // Skyline
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 300, 300, 100);
      for(let i=0; i<12; i++) {
        const bHeight = 100 + Math.sin(i * 1.5) * 60;
        ctx.fillRect(i*25, 400 - bHeight, 20, bHeight);
        
        // Window lights on buildings
        if (i % 2 === 0) {
          ctx.fillStyle = '#fef08a';
          ctx.globalAlpha = 0.5 + Math.sin(frames * 0.05 + i) * 0.2;
          for (let w = 0; w < 3; w++) {
            ctx.fillRect(i*25 + 5, 400 - bHeight + 10 + w*15, 10, 8);
          }
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#1e293b';
        }
      }
      
      ctx.fillStyle = '#38bdf8'; // window glow
      ctx.globalAlpha = 0.15 + Math.sin(frames*0.02)*0.05;
      ctx.fillRect(0, 0, 300, 400);
      ctx.globalAlpha = 1.0;
      
      // Window Frame & Sill
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 15;
      ctx.strokeRect(0, 0, 300, 400);
      ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(150, 400); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(300, 200); ctx.stroke();
      
      // Window blind / curtain
      ctx.fillStyle = '#8b5cf6';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(0, 0, 60, 400);
      ctx.fillRect(240, 0, 60, 400);
      ctx.globalAlpha = 1.0;
      
      ctx.restore();

      }

      // Draw Room Walls & Floor
      if (currentRoom !== 'Balcony') {
      ctx.fillStyle = currentRoomConfig.wall; // Back wall
      ctx.fillRect(0, 0, 350, 600);
      ctx.fillRect(650, 0, 150, 600);
      ctx.fillRect(350, 550, 300, 50); // under window
      
            }
      // Wallpaper stripes
      ctx.fillStyle = '#475569';
      for(let i=0; i<800; i+=40) {
        if (i < 350 || i > 650) {
          ctx.fillRect(i, 0, 20, 600);
        }
      }
      
      // Posters on wall
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(250, 250, 70, 100); // poster 1
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(255, 255, 60, 50);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(255, 310, 60, 5); ctx.fillRect(255, 320, 40, 5);
      
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(700, 300, 60, 80); // poster 2
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(730, 330, 15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(705, 360, 50, 5);
      
      // Floor (Wooden planks)
      ctx.fillStyle = '#451a03';
      ctx.beginPath(); ctx.moveTo(0, 600); ctx.lineTo(800, 600); ctx.lineTo(800, 1000); ctx.lineTo(0, 1000); ctx.fill();
      ctx.strokeStyle = '#271002';
      ctx.lineWidth = 2;
      for(let i=0; i<800; i+=60) {
         ctx.beginPath(); ctx.moveTo(i, 600); ctx.lineTo(i - 100, 1000); ctx.stroke();
      }


      // Draw Rug
      if (currentRoom === 'Bedroom' || currentRoom === 'Livingroom') {
          ctx.fillStyle = currentRoom === 'Bedroom' ? '#0f766e' : '#b45309'; // teal or brown rug
          ctx.beginPath(); ctx.ellipse(400, 850, 320, 110, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = currentRoom === 'Bedroom' ? '#14b8a6' : '#f59e0b';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(400, 850, 300, 95, 0, 0, Math.PI*2); ctx.stroke();
      }

      const renderQueue: { z: number, draw: () => void }[] = [];
      
      if (currentRoom === 'Bedroom') {
                  renderQueue.push({ z: 610, draw: () => {
        // Bedside Table (placed higher so it's behind the bed)
        ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.roundRect(170, 530, 60, 80, 5); ctx.fill();
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(175, 540, 50, 30); ctx.fillRect(175, 575, 50, 30);
        
        // Lamp on bedside table
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(195, 500, 10, 30); // pole
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(180, 510); ctx.lineTo(220, 510); ctx.lineTo(210, 480); ctx.lineTo(190, 480); ctx.fill(); // shade
        // Lamp glow
        ctx.fillStyle = '#fef08a';
        ctx.globalAlpha = 0.2 + Math.sin(frames * 0.05) * 0.05;
        ctx.beginPath(); ctx.arc(200, 510, 60, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
      }});

      renderQueue.push({ z: 750, draw: () => {
        const breath = Math.sin(frames * 0.04) * 5;
        // Headboard (Back wall)
        ctx.fillStyle = '#78350f'; 
        ctx.beginPath(); ctx.roundRect(240, 550, 220, 120, 10); ctx.fill();
        
        // Mattress
        ctx.fillStyle = '#e2e8f0'; 
        ctx.beginPath(); ctx.roundRect(230, 650, 240, 60, 15); ctx.fill();
        
        // Blanket
        ctx.fillStyle = '#1d4ed8'; // blue blanket
        ctx.beginPath(); ctx.roundRect(230, 670, 240, 50, 15); ctx.fill();
        
        // Pillow
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.roundRect(300, 640 - breath * 0.2, 80, 25, 10); ctx.fill();
        
        // Human Head (Sleeping under blanket)
        ctx.fillStyle = '#fcd34d'; // skin tone
        ctx.beginPath(); ctx.arc(280, 665, 22, 0, Math.PI*2); ctx.fill();
        
        // Human Hair
        ctx.fillStyle = '#451a03'; 
        ctx.beginPath(); ctx.arc(280, 660, 24, Math.PI, 0); ctx.fill();
        for (let i=0; i<5; i++) {
           ctx.beginPath(); ctx.arc(265 + i*7, 655 + Math.sin(i)*5, 8, 0, Math.PI*2); ctx.fill();
        }
        
        // Blanket fold over human
        ctx.fillStyle = '#60a5fa'; // lighter blue fold
        ctx.beginPath(); ctx.roundRect(230, 670, 240, 15, 8); ctx.fill();
        
        // Human breathing under blanket
        ctx.fillStyle = '#1d4ed8'; 
        ctx.beginPath(); ctx.ellipse(350, 690, 50 + breath, 30 + breath * 0.5, 0, 0, Math.PI*2); ctx.fill();
        
        // Blanket shading
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(230, 710, 240, 10, {bl: 15, br: 15, tl: 0, tr: 0}); ctx.fill();

        // Zzz
        if (frames % 120 < 60) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px monospace';
          ctx.fillText('z', 290, 630 - (frames % 120)*0.5);
          ctx.fillText('Z', 310, 610 - (frames % 120)*0.5);
        }
      }});

      renderQueue.push({ z: 700, draw: () => {
        // Dresser
        ctx.fillStyle = '#451a03'; ctx.fillRect(40, 530, 130, 170);
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(50, 540, 110, 45); 
        ctx.fillRect(50, 595, 110, 45); 
        ctx.fillRect(50, 650, 110, 40);
        // Knobs
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(105, 562, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(105, 617, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(105, 670, 5, 0, Math.PI*2); ctx.fill();
        
        // Plant on dresser
        ctx.fillStyle = '#b45309'; ctx.fillRect(90, 500, 30, 30);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.ellipse(105, 480, 25, 40, Math.PI/6 + Math.sin(frames*0.02)*0.1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(90, 490, 20, 35, -Math.PI/4 + Math.sin(frames*0.025)*0.1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(120, 490, 20, 35, Math.PI/4 + Math.sin(frames*0.015)*0.1, 0, Math.PI*2); ctx.fill();
      }});

      renderQueue.push({ z: 830, draw: () => {
        // Beanbag
        ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.ellipse(250, 830, 70, 45, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.ellipse(250, 835, 50, 30, 0, 0, Math.PI*2); ctx.fill(); // inner shadow
      }});

      renderQueue.push({ z: 500, draw: () => {
        // Wardrobe
        ctx.fillStyle = '#451a03'; ctx.fillRect(100, 150, 140, 350);
        ctx.fillStyle = '#78350f'; ctx.fillRect(110, 160, 55, 330); ctx.fillRect(175, 160, 55, 330);
        // Wardrobe handles
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(155, 300, 5, 40); ctx.fillRect(180, 300, 5, 40);
      }});

      renderQueue.push({ z: 710, draw: () => {
        // Cat Tree
        ctx.fillStyle = '#d6d3d1'; ctx.fillRect(660, 450, 20, 250); // main pole
        ctx.fillStyle = '#8b5cf6'; ctx.fillRect(620, 600, 100, 20); // lower platform
        ctx.fillRect(640, 450, 60, 20); // upper platform
        ctx.fillStyle = '#a8a29e'; ctx.fillRect(650, 680, 40, 30); // base
      }});
      
      renderQueue.push({ z: 900, draw: () => {
        // Chair
        ctx.fillStyle = '#1e293b'; // chair back
        ctx.beginPath(); ctx.roundRect(650, 720, 60, 120, 10); ctx.fill();
        ctx.fillStyle = '#334155'; // chair seat
        ctx.beginPath(); ctx.ellipse(680, 840, 55, 35, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#0f172a'; // chair leg
        ctx.fillRect(675, 850, 10, 50);
      }});

      renderQueue.push({ z: 965, draw: () => {
        // Pillow on floor
        ctx.fillStyle = '#a855f7';
        ctx.beginPath(); ctx.roundRect(500, 920, 80, 45, 20); ctx.fill();
        ctx.fillStyle = '#9333ea';
        ctx.beginPath(); ctx.roundRect(510, 930, 60, 25, 10); ctx.fill();
      }});
      } else if (currentRoom === 'Livingroom') {
          renderQueue.push({ z: 600, draw: () => {
            // Big TV
            ctx.fillStyle = '#111';
            ctx.fillRect(500, 350, 250, 150);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 10;
            ctx.strokeRect(500, 350, 250, 150);
            // TV Stand
            ctx.fillStyle = '#451a03';
            ctx.fillRect(480, 500, 290, 50);
            
            // TV glow
            ctx.fillStyle = '#60a5fa';
            ctx.globalAlpha = 0.1 + Math.sin(frames * 0.1) * 0.05;
            ctx.fillRect(495, 345, 260, 160);
            ctx.globalAlpha = 1.0;
          }});
          renderQueue.push({ z: 750, draw: () => {
             // Big Sofa
             ctx.fillStyle = '#b91c1c'; // red sofa
             ctx.beginPath(); ctx.roundRect(100, 550, 300, 120, 15); ctx.fill(); // back
             ctx.fillStyle = '#991b1b';
             ctx.beginPath(); ctx.roundRect(80, 620, 340, 80, 20); ctx.fill(); // seat
             ctx.fillStyle = '#7f1d1d';
             ctx.beginPath(); ctx.roundRect(80, 600, 40, 100, 15); ctx.fill(); // left arm
             ctx.beginPath(); ctx.roundRect(380, 600, 40, 100, 15); ctx.fill(); // right arm
          }});
          renderQueue.push({ z: 850, draw: () => {
             // Coffee Table
             ctx.fillStyle = '#d97706';
             ctx.beginPath(); ctx.ellipse(400, 850, 120, 60, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#b45309';
             ctx.beginPath(); ctx.ellipse(400, 855, 120, 60, 0, 0, Math.PI*2); ctx.fill();
          }});
      } else if (currentRoom === 'Bathroom') {
          renderQueue.push({ z: 600, draw: () => {
             // Mirror
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath(); ctx.ellipse(200, 400, 60, 80, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#e2e8f0';
             ctx.beginPath(); ctx.ellipse(200, 400, 55, 75, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#bae6fd';
             ctx.globalAlpha = 0.5;
             ctx.beginPath(); ctx.ellipse(210, 390, 30, 50, Math.PI/6, 0, Math.PI*2); ctx.fill();
             ctx.globalAlpha = 1.0;
             // Sink
             ctx.fillStyle = '#f8fafc';
             ctx.beginPath(); ctx.roundRect(140, 550, 120, 60, 20); ctx.fill();
             ctx.fillStyle = '#94a3b8';
             ctx.fillRect(195, 520, 10, 40); // faucet
          }});
          renderQueue.push({ z: 750, draw: () => {
             // Bathtub
             ctx.fillStyle = '#f8fafc';
             ctx.beginPath(); ctx.roundRect(400, 650, 300, 120, 40); ctx.fill();
             ctx.fillStyle = '#cbd5e1';
             ctx.beginPath(); ctx.roundRect(420, 660, 260, 90, 30); ctx.fill();
             // Water in tub
             ctx.fillStyle = '#38bdf8';
             ctx.globalAlpha = 0.8;
             ctx.beginPath(); ctx.roundRect(425, 680 + Math.sin(frames*0.05)*5, 250, 65, 20); ctx.fill();
             ctx.globalAlpha = 1.0;
          }});
      } else if (currentRoom === 'Balcony') {
          renderQueue.push({ z: 400, draw: () => {
             // Skyline is already drawn by background, let's just draw some railing
             ctx.fillStyle = '#1e293b';
             for (let i=0; i<15; i++) {
                ctx.fillRect(50 + i * 50, 500, 10, 200);
             }
             ctx.fillRect(0, 500, 800, 20);
             ctx.fillRect(0, 700, 800, 20);
          }});
          renderQueue.push({ z: 800, draw: () => {
             // Big potted plant
             ctx.fillStyle = '#ca8a04';
             ctx.fillRect(150, 750, 80, 100);
             ctx.fillStyle = '#15803d';
             ctx.beginPath(); ctx.arc(190, 700, 60, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(150, 730, 50, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(230, 730, 50, 0, Math.PI*2); ctx.fill();
          }});
      } else if (currentRoom === 'Kitchen') {
          renderQueue.push({ z: 600, draw: () => {
             // Fridge
             ctx.fillStyle = '#e2e8f0';
             ctx.fillRect(100, 300, 160, 350);
             ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 5;
             ctx.strokeRect(100, 300, 160, 150); // freezer
             ctx.strokeRect(100, 450, 160, 200); // fridge
             ctx.fillStyle = '#64748b';
             ctx.fillRect(240, 350, 10, 50);
             ctx.fillRect(240, 500, 10, 80);
          }});
          renderQueue.push({ z: 750, draw: () => {
             // Counter
             ctx.fillStyle = '#0f172a';
             ctx.fillRect(300, 600, 450, 250);
             // Marble top
             ctx.fillStyle = '#f1f5f9';
             ctx.fillRect(290, 580, 470, 30);
             // Stove burners
             ctx.fillStyle = '#334155';
             ctx.beginPath(); ctx.ellipse(400, 595, 30, 10, 0, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.ellipse(500, 595, 30, 10, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#ef4444'; // slightly warm
             ctx.beginPath(); ctx.ellipse(400, 595, 20, 5, 0, 0, Math.PI*2); ctx.fill();
          }});
      }


      // Draw Cats
      catsInRoom.forEach(cat => {
        let cx = cat.x;
        let cy = cat.y;
        let isGrounded = false; // sleeping/sitting
        let drawType = cat.catType;
        let catZ = cat.z;
        
        // Handle animation if this cat was clicked
        if (activeCatAnim && activeCatAnim.id === cat.id) {
           animProgress += 0.02; // Update animation state
           if (activeCatAnim.phase === 'WAKE') {
             // Waking up animation (jiggle)
             cy -= Math.abs(Math.sin(animProgress * 10)) * 5;
             if (animProgress > 1) {
                setActiveCatAnim({ id: cat.id, phase: 'JUMP', progress: 0 });
                animProgress = 0;
             }
           } else if (activeCatAnim.phase === 'JUMP') {
             isGrounded = false; // jumping posture
             // Parabola to window (450, 500)
             const targetX = 500;
             const targetY = 400;
             const startX = cat.x;
             const startY = cat.y;
             cx = startX + (targetX - startX) * animProgress;
             // Arc
             cy = startY + (targetY - startY) * animProgress - Math.sin(animProgress * Math.PI) * 150;
             
             catZ = 9999; // jump on top of everything
             
             if (animProgress > 1) {
                // Done! transition to game
                onPlay();
             }
           }
        }

        renderQueue.push({ z: catZ, draw: () => {
          drawCat(ctx, frames, { ...cat, x: cx, y: cy, catType: drawType, isAwake: !!(activeCatAnim && activeCatAnim.id === cat.id) }, cx, cy, cat.w, cat.h, isGrounded, cat.id === playerData.currentColor ? playerData : { ...playerData, currentAccessory: 'none' }, (activeCatAnim && activeCatAnim.id === cat.id) ? (isGrounded ? 'STANDING' : 'JUMPING') : undefined);
          
          // Draw Status Indicator
          const friendship = playerData.stats?.catFriendship?.[cat.id] || 0;
          let icon = '';
          let color = '';
          if (friendship === 0) {
            icon = '?'; color = '#94a3b8'; // Unknown
          } else if (friendship < 10) {
            icon = '...'; color = '#cbd5e1'; // Shy
          } else if (friendship < 30) {
            icon = '♪'; color = '#60a5fa'; // Curious
          } else if (friendship < 100) {
            icon = '♥'; color = '#f43f5e'; // Friendly
          } else if (friendship < 300) {
            icon = '♥♥'; color = '#f43f5e'; // Good Friend
          } else {
            icon = '👑'; color = '#facc15'; // Best Friend
          }
          
          ctx.save();
          // Floating animation
          const floatY = Math.sin(frames * 0.05 + cat.id.charCodeAt(0)) * 5;
          ctx.translate(cx + cat.w/2, cy - 10 + floatY);
          
          // Draw bubble
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.beginPath();
          ctx.roundRect(-20, -25, 40, 20, 10);
          ctx.fill();
          
          // Little tail for bubble
          ctx.beginPath();
          ctx.moveTo(-5, -5);
          ctx.lineTo(0, 0);
          ctx.lineTo(5, -5);
          ctx.fill();

          // Draw Text/Icon
          ctx.fillStyle = color;
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, 0, -14);
          ctx.restore();

          if (cat.roomState === "SLEEPING" && cat.x === SLOTS[0].x && cat.y === SLOTS[0].y) {
             ctx.save();
             ctx.translate(cx + 20, cy - 50 + Math.sin(frames * 0.05) * 5);
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.beginPath(); ctx.arc(-10, 20, 4, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(-2, 5, 8, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.ellipse(20, -15, 35, 25, 0, 0, Math.PI*2); ctx.fill();
             ctx.translate(20, -15);
             ctx.fillStyle = "#60a5fa";
             ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -8); ctx.lineTo(20, 8); ctx.fill();
             ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-5, -2, 2, 0, Math.PI*2); ctx.fill();
             ctx.restore();
          }
        }});

      });
      
      // Execute the render queue sorted by Z
      renderQueue.sort((a, b) => a.z - b.z).forEach(item => item.draw());      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playerData.ownedColors, activeCatAnim, currentRoom]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-950 overflow-hidden">
      {showAfkMsg && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-white bg-slate-900/80 px-4 py-2 rounded-lg font-bold text-sm shadow-xl"
          >
            Tap a cat to play!
          </motion.div>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={1000} 
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        onClick={handleCanvasClick}
      />
      

      {/* Room Selector */}
      <div className="absolute top-20 left-4 z-50 flex flex-col gap-2">
        {unlockedRooms.map(r => (
          <button 
            key={r}
            onClick={() => setCurrentRoom(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${currentRoom === r ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => { audio.init(); audio.setMuted(!muted); setMuted(!muted); }}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          className="mt-1 w-10 h-10 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/90 text-slate-200 active:bg-slate-700"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Big PLAY button (tapping a cat also starts a run) */}
      <div className="absolute bottom-24 left-0 w-full flex justify-center pointer-events-none z-40">
        <motion.button
          whileTap={{ scale: 0.92 }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          onClick={() => { audio.init(); onPlay(); }}
          className="pointer-events-auto flex items-center gap-3 px-10 py-4 rounded-2xl bg-amber-500 active:bg-amber-400 text-slate-950 font-black text-2xl uppercase tracking-widest shadow-[0_0_30px_rgba(245,158,11,0.45)]"
        >
          <Play size={26} fill="currentColor" /> Play
        </motion.button>
      </div>

      {/* HUD overlays */}

      {/* Achievements button */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onAchievements}
          className="bg-purple-900/90 active:bg-purple-800 text-white font-bold py-3 px-5 rounded-xl shadow-lg border border-purple-700 flex items-center gap-2"
        >
          <Award size={18} />
          <span className="text-xs uppercase tracking-widest">Achievements</span>
        </motion.button>
      </div>


      <div className="absolute top-4 left-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-800 backdrop-blur-sm shadow-xl"
        >
          <Fish className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
          <span className="text-xl font-bold text-yellow-400">{playerData.yarns}</span>
        </motion.div>
      </div>


      {/* Daily Challenge Overlay */}
      {playerData.dailyChallenge && (
        <div className="absolute bottom-4 left-4 pointer-events-none scale-75 origin-bottom-left">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-4 rounded-lg border ${playerData.dailyChallenge.completed ? 'border-emerald-500/50 bg-emerald-950/30' : 'border-slate-800 bg-slate-900/50'} backdrop-blur-sm max-w-[250px] w-full shadow-lg`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className={playerData.dailyChallenge.completed ? 'text-emerald-400' : 'text-blue-400'} />
              <h3 className={`text-xs font-bold uppercase tracking-widest ${playerData.dailyChallenge.completed ? 'text-emerald-400' : 'text-blue-400'}`}>Daily Challenge</h3>
            </div>
            <p className="text-xs text-slate-300 mb-2 leading-tight">{playerData.dailyChallenge.desc}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-2">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${playerData.dailyChallenge.completed ? 'bg-emerald-400' : 'bg-blue-500'} transition-all duration-500`} 
                    style={{ width: `${Math.min(100, (playerData.dailyChallenge.progress / playerData.dailyChallenge.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {playerData.dailyChallenge.completed ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">+{playerData.dailyChallenge.reward} <Fish size={12} /></span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col gap-1.5">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowMapSelect(true)}
          className="flex items-center gap-2 bg-emerald-900/90 active:bg-emerald-800 text-white px-3 py-2.5 rounded-lg border border-emerald-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <Map size={16} /> Map
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onStore}
          className="flex items-center gap-2 bg-slate-800/90 active:bg-slate-700 text-white px-3 py-2.5 rounded-lg border border-slate-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <ShoppingCart size={16} /> Store
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onGallery}
          className="flex items-center gap-2 bg-indigo-900/90 active:bg-indigo-800 text-white px-3 py-2.5 rounded-lg border border-indigo-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <ImageIcon size={16} /> Gallery
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowBossArchives(true)}
          className="flex items-center gap-2 bg-red-900/90 active:bg-red-800 text-white px-3 py-2.5 rounded-lg border border-red-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <Target size={16} /> Boss
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowLeaderboard(true)}
          className="flex items-center gap-2 bg-slate-800/90 active:bg-slate-700 text-white px-3 py-2.5 rounded-lg border border-slate-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <Trophy size={16} /> Ranks
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => { setPlayerData(prev => ({ ...prev, seenIntros: [] })); onPlay(); }}
          className="flex items-center gap-2 bg-slate-800/90 active:bg-slate-700 text-white px-3 py-2.5 rounded-lg border border-slate-700 font-bold uppercase text-xs tracking-wider shadow-lg backdrop-blur-sm"
        >
          <HelpCircle size={16} /> How to Play
        </motion.button>
      </div>

      

      
      {/* Map Selection Modal */}
      <AnimatePresence>
        {showMapSelect && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowMapSelect(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <Map size={28} className="text-emerald-400" />
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Select Location</h2>
              </div>
              
              <div className="space-y-3">
                {MAP_ORDER.map(m => {
                  const unlocked = unlockedMaps.includes(m);
                  const unlockHint = m === 'Rooftop' ? 'Beat the Mafia Cat to unlock' : 'Beat the Ninja Cat to unlock';
                  return (
                  <div
                    key={m}
                    onClick={() => {
                        if (!unlocked) return;
                        setPlayerData(prev => ({ ...prev, currentMap: m }));
                        setShowMapSelect(false);
                    }}
                    className={`p-4 rounded-lg border transition-all flex items-center justify-between ${
                      !unlocked
                        ? 'bg-slate-900/60 border-slate-800 opacity-60'
                        : currentMap === m
                        ? 'cursor-pointer bg-emerald-900/50 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'cursor-pointer bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                     <div>
                        <div className="text-white font-bold text-lg uppercase">{MAP_INFO[m]?.name || m}</div>
                        <div className="text-slate-400 text-xs mt-1">
                           {unlocked ? (MAP_INFO[m]?.desc || '') : unlockHint}
                        </div>
                     </div>
                     {!unlocked ? <Lock className="text-slate-500" size={20} /> : currentMap === m && <CheckCircle className="text-emerald-400" size={24} />}
                  </div>
                  );
                })}
                {/* Next stage isn't built yet */}
                <div
                  onClick={() => setUnderDev('Stage 4')}
                  className="p-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 cursor-pointer flex items-center justify-between hover:border-amber-500/50"
                >
                  <div>
                    <div className="text-slate-300 font-bold text-lg uppercase">Stage 4 · ???</div>
                    <div className="text-slate-500 text-xs mt-1">Coming soon</div>
                  </div>
                  <Lock className="text-slate-600" size={20} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showBossArchives && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowBossArchives(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                <Target size={28} className="text-red-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Boss Archives</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded bg-slate-900 flex items-center justify-center shadow-inner overflow-hidden relative">
                         <div className="absolute font-black text-3xl opacity-20">M</div>
                       </div>
                       <div>
                           <div className="font-bold text-slate-200 text-lg">Mafia Cat</div>
                           <div className="text-slate-400 text-sm">City Encounter</div>
                       </div>
                    </div>
                    {playerData.stats?.bossDefeated ? (
                        <button 
                           onClick={() => window.location.href = '?boss=mafia'}
                           className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs shadow-lg"
                        >Replay</button>
                    ) : (
                        <span className="text-slate-500 text-xs font-bold uppercase">Locked</span>
                    )}
                </div>
                
                <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded bg-slate-900 flex items-center justify-center shadow-inner overflow-hidden relative">
                         <div className="absolute font-black text-3xl opacity-20">N</div>
                       </div>
                       <div>
                           <div className="font-bold text-slate-200 text-lg">Ninja Cat</div>
                           <div className="text-slate-400 text-sm">Building Tops Encounter</div>
                       </div>
                    </div>
                    {playerData.stats?.rooftopBossDefeated ? (
                        <button 
                           onClick={() => window.location.href = '?boss=ninja'}
                           className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs shadow-lg"
                        >Replay</button>
                    ) : (
                        <span className="text-slate-500 text-xs font-bold uppercase">Locked</span>
                    )}
                </div>

                <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded bg-slate-900 flex items-center justify-center shadow-inner overflow-hidden relative">
                         <div className="absolute font-black text-3xl opacity-20">A</div>
                       </div>
                       <div>
                           <div className="font-bold text-slate-200 text-lg">Athlete Cat</div>
                           <div className="text-slate-400 text-sm">Stadium Encounter</div>
                       </div>
                    </div>
                    {playerData.stats?.stadiumBossDefeated ? (
                        <button 
                           onClick={() => window.location.href = '?boss=athlete'}
                           className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs shadow-lg"
                        >Replay</button>
                    ) : (
                        <span className="text-slate-500 text-xs font-bold uppercase">Locked</span>
                    )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        
        {showLeaderboard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowLeaderboard(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <Trophy size={28} className="text-yellow-400" />
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Top 5 Scores</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setRanksTab('local')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-widest border ${ranksTab === 'local' ? 'bg-yellow-500 text-slate-950 border-yellow-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                >
                  My Runs
                </button>
                <button
                  onClick={() => setUnderDev('Global Ranks')}
                  className="py-2 rounded-lg text-xs font-bold uppercase tracking-widest border bg-slate-800 text-slate-300 border-slate-700"
                >
                  Global
                </button>
              </div>

              <div className="space-y-3">
                {playerData.highScores && playerData.highScores.length > 0 ? (
                  playerData.highScores.map((score, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <span className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                          #{index + 1}
                        </span>
                        <span className="text-white font-bold">{score.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-yellow-400 font-bold text-lg">{score.score}m</span>
                        <span className="text-[10px] text-slate-500">{score.date}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-6 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    No high scores yet.<br/>Start running!
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {underDev && <UnderDevelopment title={underDev} onBack={() => setUnderDev(null)} />}
    </div>
  );
}

