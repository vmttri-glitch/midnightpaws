export type GameState = 'MENU' | 'PLAYING' | 'STORE' | 'GAMEOVER' | 'GALLERY' | 'ACHIEVEMENTS' | 'LEADERBOARD';

export type Gear = 'NONE' | 'WINGS' | 'DOG_GUARD';

export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  type: 'DISTANCE_NO_JUMP' | 'COLLECT_YARN' | 'JUMP_COUNT' | 'DESTROY_OBSTACLES' | 'SURVIVE_TIME';
  target: number;
  progress: number;
  completed: boolean;
  reward: number;
  desc: string;
}

export interface PlayerData {
  yarns: number;
  ownedColors: string[];
  ownedAccessories: string[];
  ownedGears?: string[];
  currentColor: string;
  currentAccessory: string | null;
  activeGear: Gear;
  dailyChallenge?: DailyChallenge;
  highScores?: { name: string, score: number, date: string }[];

  unlockedRooms?: string[];
  unlockedMaps?: string[];
  currentMap?: string;
  // First-encounter callouts already shown (obstacle / power-up / boss keys)
  seenIntros?: string[];
  roomAssignments?: Record<string, string>;
  stats?: {
    totalDistance: number;
    totalYarns: number;
    totalObstacles: number;
    catFriendship?: Record<string, number>;
    bossDefeated?: boolean;
    rooftopBossDefeated?: boolean;
    stadiumBossDefeated?: boolean;
    cannonUnlocked?: boolean;
  };
}

// Stage order of a run. Each area's boss appears 10,000m after entering it.
export const MAP_ORDER = ['City', 'Rooftop', 'Stadium'] as const;
export const MAP_INFO: Record<string, { name: string; desc: string }> = {
  City: { name: 'Night City', desc: 'Stage 1 · The midnight streets. Boss: Mafia Cat.' },
  Rooftop: { name: 'Building Tops', desc: 'Stage 2 · High above the city. Ninjas lurk. Boss: Ninja Cat.' },
  Stadium: { name: 'The Stadium', desc: 'Stage 3 · The grand arena. Boss: Athlete Cat.' },
};

export const STORE_ITEMS = {
  colors: [
    { id: 'default', name: 'Street Cat', cost: 0, color: '#ff8c00', desc: 'A regular stray cat.' },
    { id: 'ninja', name: 'Ninja Cat', cost: 100, color: '#1a1a1a', desc: 'Sword slash when jumping, throw shuriken (swipe right).' },
    { id: 'super', name: 'Super Cat', cost: 200, color: '#4ade80', desc: 'Hulk mode! Destroy obstacles but uses HP. Eat fish to heal.' },
    { id: 'athlete', name: 'Athlete Cat', cost: 150, color: '#facc15', desc: 'Can always triple jump!' },
    { id: 'wizard', name: 'Wizard Cat', cost: 250, color: '#9333ea', desc: 'Double jump & hold to fly. Ability to shoot fire. Uses Mana.' },
    { id: 'strong', name: 'Strong Cat', cost: 300, color: '#b45309', desc: 'Starts with 2 lives (Armor), has two tails.' },
    { id: 'mafia', name: 'Mafia Cat', cost: 500, color: '#334155', desc: 'Boss! Periodically summons a fellow cat to take a hit.' },
  ],

  rooms: [
    { id: 'Bedroom', name: 'Bedroom', cost: 0, capacity: 4, desc: 'A cozy bedroom.' },
    { id: 'Livingroom', name: 'Living Room', cost: 500, capacity: 4, desc: 'A spacious living room with a big TV.' },
    { id: 'Bathroom', name: 'Bathroom', cost: 300, capacity: 4, desc: 'A clean bathroom with a warm tub.' },
    { id: 'Balcony', name: 'Balcony', cost: 400, capacity: 4, desc: 'Fresh air and city views.' },
    { id: 'Kitchen', name: 'Kitchen', cost: 600, capacity: 4, desc: 'Smells like fish!' },
  ],
  accessories: [
    { id: 'none', name: 'None', cost: 0 },

    { id: 'red_collar', name: 'Red Collar', cost: 50 },
    { id: 'top_hat', name: 'Top Hat', cost: 150 },
    { id: 'sunglasses', name: 'Sunglasses', cost: 200 },
    { id: 'crown', name: 'Gold Crown', cost: 500 },
    { id: 'scarf', name: 'Winter Scarf', cost: 100 },
    { id: 'bowtie', name: 'Bowtie', cost: 120 },
    { id: 'headphones', name: 'Headphones', cost: 250 },

  ],
  gears: [
    { id: 'NONE', name: 'None', cost: 0 },
    { id: 'WINGS', name: 'Bat Wings', cost: 300, description: 'Start your next run with 20s of flight (hold jump).' },
    { id: 'DOG_GUARD', name: 'Dog Guard', cost: 250, description: 'Start your next run with a shield that blocks one hit.' },
  ],
};
