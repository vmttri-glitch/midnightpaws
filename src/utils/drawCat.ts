import { STORE_ITEMS } from '../types';
import { PlayerData } from '../types';

export function drawCat(
  ctx: CanvasRenderingContext2D,
  frames: number,
  cat: any,
  x: number,
  y: number,
  w: number,
  h: number,
  isGrounded: boolean,
  playerData: PlayerData,
  overrideState?: 'SLEEPING' | 'SITTING' | 'STANDING' | 'PLAYING' | 'EATING' | 'JUMPING'
) {
  const colorObj = STORE_ITEMS.colors.find(c => c.id === cat.catType);
  const color = colorObj ? colorObj.color : '#f97316'; // orange default
  
  ctx.save();
  
  if (cat.catType === 'ghost' && cat.abilityTimer > 0) {
    ctx.globalAlpha = 0.5;
  }
  
  // States
  const state = overrideState || cat.roomState || (isGrounded ? 'STANDING' : 'JUMPING');
  let bounce = 0;
  if (state === 'STANDING' || state === 'PLAYING') {
    bounce = Math.abs(Math.sin(frames * 0.3)) * 3;
  } else if (state === 'JUMPING') {
    bounce = Math.sin(frames * 0.1) * 2;
  } else if (state === 'SLEEPING') {
    bounce = Math.sin(frames * 0.05) * 1; // gentle breathing
  } else if (state === 'EATING') {
    bounce = Math.abs(Math.sin(frames * 0.5)) * 2;
  }
  
  let drawY = y + h - bounce;
  let drawX = x + w/2;
  
  if (state === 'SLEEPING') {
     drawY += h/4; // lie down
  } else if (state === 'SITTING') {
     drawY += h/6; // sit
  }
  
  ctx.translate(drawX, drawY); // origin at bottom center
  if (cat.catType === 'strong') {
    ctx.scale(1.2, 1.2);
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
    ctx.lineWidth = 20 + Math.sin(frames * 0.5) * 10;
    ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(1200, -h/2); ctx.stroke();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(1200, -h/2); ctx.stroke();
  }
  
  // Tail
  ctx.save();
  if (cat.catType !== 'ghost') {
    let tailAngle = -30;
    if (state === 'STANDING' || state === 'SITTING') {
      tailAngle = Math.sin(frames * 0.2) * 15 - 10;
    } else if (state === 'SLEEPING') {
      tailAngle = 70; // wrapped around
    } else if (state === 'EATING') {
      tailAngle = 20 + Math.sin(frames * 0.8) * 10; // happy tail
    } else if (state === 'PLAYING') {
      tailAngle = -45 + Math.sin(frames * 0.5) * 30; // excited tail
    }
    
    if (state === 'SLEEPING') {
      ctx.translate(w/2 - 5, -5);
      ctx.rotate(tailAngle * Math.PI / 180);
    } else {
      ctx.translate(-w/2 + 5, -8);
      ctx.rotate(tailAngle * Math.PI / 180);
    }
    
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-20, -10, -15, -20);
    ctx.quadraticCurveTo(-10, -25, -5, -20);
    ctx.quadraticCurveTo(-10, -5, 5, 0);
    ctx.fill();
  }
  ctx.restore();
  
  // Legs (Paws)
  if (cat.catType !== 'ghost') {
    ctx.fillStyle = color;
    if (state === 'STANDING' || state === 'SITTING') {
      const legOffset1 = state === 'STANDING' ? Math.sin(frames * 0.6) * 3 : 0;
      const legOffset2 = state === 'STANDING' ? Math.cos(frames * 0.6) * 3 : 0;
      ctx.beginPath(); ctx.roundRect(-w/2 + 8, -6, 8, 6 + legOffset1, 4); ctx.fill();
      ctx.beginPath(); ctx.roundRect(w/2 - 16, -6, 8, 6 + legOffset2, 4); ctx.fill();
    } else if (state === 'JUMPING' || state === 'PLAYING') {
      const pawRot = state === 'PLAYING' ? Math.sin(frames * 0.4) * 5 : 0;
      ctx.beginPath(); ctx.roundRect(-w/2 + 5, -10 - pawRot, 8, 8, 4); ctx.fill();
      ctx.beginPath(); ctx.roundRect(w/2 - 12, -6 + pawRot, 10, 6, 4); ctx.fill();
    } else if (state === 'SLEEPING') {
       // tucked paws
       ctx.beginPath(); ctx.roundRect(-w/2 + 10, -8, 12, 6, 3); ctx.fill();
       ctx.beginPath(); ctx.roundRect(w/4 - 5, -8, 12, 6, 3); ctx.fill();
    } else if (state === 'EATING') {
       ctx.beginPath(); ctx.roundRect(-w/2 + 8, -6, 8, 6, 4); ctx.fill();
       ctx.beginPath(); ctx.roundRect(w/2 - 16, -6, 8, 6, 4); ctx.fill();
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
    if (state === 'SLEEPING') {
      ctx.ellipse(0, -h/4, w/1.5, h/3, 0, 0, Math.PI*2);
    } else if (state === 'SITTING') {
      ctx.ellipse(0, -h/3, w/1.8, h/2.5, 0, 0, Math.PI*2);
    } else {
      ctx.ellipse(0, -h/2 + 5, w/2, h/2 - 5, 0, 0, Math.PI*2);
    }
    ctx.fill();
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
  }
  
  // Head setup
  let headX = w/4;
  let headY = -h + 10;
  if (state === 'SLEEPING') {
    headX = -w/4;
    headY = -h/2;
  } else if (state === 'EATING') {
    headX = w/4;
    headY = -h/2 + 10; // lower head to eat
  }

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 20, 18, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Patterns (Head)
  if (cat.catType === 'calico') {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.ellipse(headX + 5, headY + 5, 12, 10, 0, 0, Math.PI*2); ctx.fill();
  }
  
  // Ears
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(headX - 15, headY - 8); ctx.quadraticCurveTo(headX - 20, headY - 20, headX - 8, headY - 15); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + 5, headY - 15); ctx.quadraticCurveTo(headX + 15, headY - 20, headX + 12, headY - 8); ctx.fill();
  
  // Inner Ears
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(headX - 12, headY - 9); ctx.quadraticCurveTo(headX - 15, headY - 16, headX - 8, headY - 13); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + 4, headY - 13); ctx.quadraticCurveTo(headX + 10, headY - 16, headX + 9, headY - 9); ctx.fill();
  
  // Eyes
  if (state === 'SLEEPING' || (!isGrounded && !cat.isAwake && state !== 'PLAYING' && state !== 'EATING')) {
     ctx.strokeStyle = '#0f172a';
     ctx.lineWidth = 2;
     ctx.beginPath(); ctx.moveTo(headX, headY); ctx.quadraticCurveTo(headX + 3, headY + 2, headX + 6, headY); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(headX + 10, headY); ctx.quadraticCurveTo(headX + 13, headY + 2, headX + 16, headY); ctx.stroke();
     if (state === 'SLEEPING') {
       // Zzz
       if (frames % 60 < 30) {
         ctx.fillStyle = '#fff';
         ctx.font = '12px monospace';
         ctx.fillText('z', headX - 10, headY - 20 - (frames%60)*0.2);
         ctx.fillText('Z', headX - 20, headY - 30 - (frames%60)*0.2);
       }
     }
  } else {
    const eyeColor = (cat.catType === 'ghost' || cat.catType === 'ninja') ? '#fff' : '#0f172a';
    ctx.fillStyle = eyeColor;
    
    if (cat.catType === 'ninja') {
       ctx.beginPath(); ctx.ellipse(headX + 2, headY - 2, 4, 3, -0.3, 0, Math.PI*2); ctx.fill();
       ctx.beginPath(); ctx.ellipse(headX + 14, headY - 2, 4, 3, 0.3, 0, Math.PI*2); ctx.fill();
       ctx.fillStyle = '#ef4444'; 
       ctx.beginPath(); ctx.arc(headX + 2, headY - 2, 1.5, 0, Math.PI*2); ctx.fill();
       ctx.beginPath(); ctx.arc(headX + 14, headY - 2, 1.5, 0, Math.PI*2); ctx.fill();
       ctx.fillStyle = '#ef4444';
       ctx.beginPath(); ctx.roundRect(headX - 18, headY - 12, 36, 6, 3); ctx.fill();
    } else {
       ctx.beginPath(); ctx.arc(headX + 4, headY, 3.5, 0, Math.PI*2); ctx.fill();
       ctx.beginPath(); ctx.arc(headX + 14, headY, 3.5, 0, Math.PI*2); ctx.fill();
       ctx.fillStyle = '#fff';
       ctx.beginPath(); ctx.arc(headX + 3, headY - 1, 1.2, 0, Math.PI*2); ctx.fill();
       ctx.beginPath(); ctx.arc(headX + 13, headY - 1, 1.2, 0, Math.PI*2); ctx.fill();
    }
  }
  
  // Nose and Mouth
  ctx.fillStyle = '#f472b6'; 
  ctx.beginPath(); ctx.arc(headX + 9, headY + 4, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(headX + 9, headY + 5.5); ctx.quadraticCurveTo(headX + 6, headY + 8, headX + 4, headY + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX + 9, headY + 5.5); ctx.quadraticCurveTo(headX + 12, headY + 8, headX + 14, headY + 6); ctx.stroke();
  
  // Whiskers
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.moveTo(headX - 2, headY + 2); ctx.lineTo(headX - 10, headY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX - 2, headY + 5); ctx.lineTo(headX - 10, headY + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX + 20, headY + 2); ctx.lineTo(headX + 28, headY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX + 20, headY + 5); ctx.lineTo(headX + 28, headY + 6); ctx.stroke();
  
  // Accessories
  

  if (cat.catType === 'mafia') {
     // Fedora
     ctx.fillStyle = '#0f172a';
     ctx.beginPath(); ctx.ellipse(headX + 5, headY - 15, w/2 + 5, 4, 0, 0, Math.PI*2); ctx.fill(); // brim
     ctx.fillRect(headX + 5 - w/2 + 5, headY - 35, w - 10, 20); // crown
     ctx.fillStyle = '#facc15'; // hat band
     ctx.fillRect(headX + 5 - w/2 + 5, headY - 19, w - 10, 4);

     // Sunglasses
     ctx.fillStyle = '#020617';
     ctx.fillRect(headX + 5, headY - 5, 12, 6);
     ctx.fillRect(headX + 18, headY - 5, 12, 6);
     
     // Cigar
     ctx.fillStyle = '#78350f';
     ctx.fillRect(headX + 15, headY + 5, 12, 3);
     ctx.fillStyle = '#ef4444';
     ctx.fillRect(headX + 27, headY + 5, 2, 3);
     
     // Smoke
     ctx.fillStyle = 'rgba(255,255,255,0.4)';
     ctx.beginPath(); ctx.arc(headX + 30 + Math.sin(frames * 0.1)*2, headY, 2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(headX + 32 + Math.cos(frames * 0.1)*3, headY - 4, 3, 0, Math.PI*2); ctx.fill();
  }


  if (cat.catType === 'wizard') {
    ctx.fillStyle = '#6b21a8';
    ctx.beginPath(); ctx.moveTo(headX - 25, headY - 12); ctx.lineTo(headX + 25, headY - 12); ctx.lineTo(headX, headY - 40); ctx.fill();
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(headX - 22, headY - 12); ctx.lineTo(headX + 22, headY - 12); ctx.stroke();
  }
  
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
  
  if (cat.hasShield && cat.catType !== 'mafia') {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -h/2, w + 10, 0, Math.PI*2); ctx.stroke();
  }
  if (cat.isFlyingGear || cat.wingsTimer > 0) {
    ctx.fillStyle = 'rgba(96, 165, 250, 0.8)';
    const flap = Math.sin(frames * 0.4) * 15;
    ctx.beginPath(); ctx.moveTo(-w/2 + 5, -h/2); ctx.quadraticCurveTo(-w/2 - 20, -h/2 - 20 + flap, -w/2 - 30, -h/2 - 5 + flap/2); ctx.quadraticCurveTo(-w/2 - 15, -h/2 + 10, -w/2 + 5, -h/2 + 15); ctx.fill();
  }
  
  ctx.restore();
}
