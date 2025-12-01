import { Coordinate, Direction, GameConfig, Player } from '../types';

export const getNextPosition = (head: Coordinate, direction: Direction): Coordinate => {
  switch (direction) {
    case Direction.UP:
      return { x: head.x, y: head.y - 1 };
    case Direction.DOWN:
      return { x: head.x, y: head.y + 1 };
    case Direction.LEFT:
      return { x: head.x - 1, y: head.y };
    case Direction.RIGHT:
      return { x: head.x + 1, y: head.y };
  }
};

export const checkCollision = (
  pos: Coordinate,
  width: number,
  height: number,
  players: Player[]
): boolean => {
  // Wall collision
  if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) {
    return true;
  }

  // Trail collision
  for (const player of players) {
    // Check against trail
    for (const segment of player.trail) {
      if (pos.x === segment.x && pos.y === segment.y) {
        return true;
      }
    }
  }

  return false;
};

// AI Logic: Simple Flood Fill Heuristic
// Determines the "openness" of a direction
const floodFillCount = (
  start: Coordinate,
  width: number,
  height: number,
  obstacles: Set<string>,
  depth: number = 20
): number => {
  let count = 0;
  const queue: Coordinate[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  let steps = 0;
  while (queue.length > 0 && steps < depth * 5) {
    const curr = queue.shift()!;
    count++;
    steps++;

    const neighbors = [
      { x: curr.x + 1, y: curr.y },
      { x: curr.x - 1, y: curr.y },
      { x: curr.x, y: curr.y + 1 },
      { x: curr.x, y: curr.y - 1 },
    ];

    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (
        n.x >= 0 &&
        n.x < width &&
        n.y >= 0 &&
        n.y < height &&
        !obstacles.has(key) &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  return count;
};

export const getAIMove = (
  aiPlayer: Player,
  players: Player[],
  width: number,
  height: number
): Direction => {
  const head = aiPlayer.head;
  const currentDir = aiPlayer.direction;
  
  // Possible relative moves: Left, Straight, Right
  // Calculate absolute directions for these relative moves
  const turnLeftDir = (currentDir + 3) % 4;
  const turnRightDir = (currentDir + 1) % 4;
  const straightDir = currentDir;

  const possibleMoves = [
    { dir: straightDir, name: 'straight' },
    { dir: turnLeftDir, name: 'left' },
    { dir: turnRightDir, name: 'right' },
  ];

  // Build obstacle map
  const obstacles = new Set<string>();
  for (const p of players) {
    for (const t of p.trail) {
      obstacles.add(`${t.x},${t.y}`);
    }
    obstacles.add(`${p.head.x},${p.head.y}`);
  }

  let bestMove = currentDir;
  let maxSpace = -1;

  // Shuffle to add randomness when scores are equal
  possibleMoves.sort(() => Math.random() - 0.5);

  for (const move of possibleMoves) {
    const nextPos = getNextPosition(head, move.dir);
    
    // Immediate collision check
    if (
      nextPos.x < 0 || nextPos.x >= width ||
      nextPos.y < 0 || nextPos.y >= height ||
      obstacles.has(`${nextPos.x},${nextPos.y}`)
    ) {
      continue; // This move kills us immediately
    }

    // Flood fill score
    const space = floodFillCount(nextPos, width, height, obstacles);
    
    if (space > maxSpace) {
      maxSpace = space;
      bestMove = move.dir;
    }
  }

  return bestMove;
};

// Walker logic: Random walk avoiding walls
export const getWalkerMove = (
  currentPos: Coordinate,
  width: number,
  height: number,
  obstacles: Set<string> // Optional: Pass player trails if walkers should avoid them too
): Coordinate => {
  const possibleMoves = [
    { x: currentPos.x + 1, y: currentPos.y },
    { x: currentPos.x - 1, y: currentPos.y },
    { x: currentPos.x, y: currentPos.y + 1 },
    { x: currentPos.x, y: currentPos.y - 1 },
  ];

  // Filter valid moves
  const validMoves = possibleMoves.filter(m => 
    m.x >= 0 && m.x < width && 
    m.y >= 0 && m.y < height
    // Walkers can optionally avoid trails here if passed in obstacles
    // For now, let's say they just bounce off walls but might walk into trails?
    // Or simpler: they are ghosts that float over trails but players crash into them.
    // Let's implement: they stay in bounds.
  );

  if (validMoves.length === 0) return currentPos;

  // Pick random
  return validMoves[Math.floor(Math.random() * validMoves.length)];
};