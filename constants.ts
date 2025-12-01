import { GameConfig } from './types';

// Grid size logic
// We'll use a fixed logical grid that scales visually
export const DEFAULT_GRID_WIDTH = 60;
export const DEFAULT_GRID_HEIGHT = 40;

export const INITIAL_CONFIG: GameConfig = {
  gridWidth: DEFAULT_GRID_WIDTH,
  gridHeight: DEFAULT_GRID_HEIGHT,
  speed: 80, // Game tick every 80ms
};

export const P1_COLOR = '#00f3ff'; // Cyan
export const P2_COLOR = '#ff003c'; // Neon Red
export const P1_START_POS = { x: 10, y: 20 };
export const P2_START_POS = { x: 50, y: 20 }; // Relative to default 60 width

export const NEON_SHADOW_BLUR = 15;
export const WALL_COLOR = '#2a2a2a';
export const GRID_LINE_COLOR = '#111111';

export const WALKER_COUNT = 5;
export const WALKER_COLOR = '#fbbf24'; // Amber-400
export const WALKER_SPEED_MOD = 2; // Move every X frames (slower than players)