export enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3,
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Player {
  id: number;
  color: string;
  head: Coordinate;
  trail: Coordinate[];
  direction: Direction;
  isDead: boolean;
  score: number;
  name: string;
}

export interface Walker {
  id: number;
  position: Coordinate;
  moveTimer: number;
}

export enum GameMode {
  PVP = 'PVP',
  PVE = 'PVE',
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  speed: number; // ms per frame
}