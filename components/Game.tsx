import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode, GameStatus, Player, Direction, GameConfig, Walker } from '../types';
import { INITIAL_CONFIG, P1_COLOR, P2_COLOR, P1_START_POS, P2_START_POS, NEON_SHADOW_BLUR, WALL_COLOR, GRID_LINE_COLOR, WALKER_COUNT, WALKER_COLOR, WALKER_SPEED_MOD } from '../constants';
import { getNextPosition, checkCollision, getAIMove, getWalkerMove } from '../utils/gameLogic';
import { initAudio, playTurnSound, playCrashSound, playGameStartSound, startBGM, setMute } from '../utils/audio';
import { Button } from './Button';
import { Monitor, Users, Volume2, VolumeX } from 'lucide-react';

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [mode, setMode] = useState<GameMode>(GameMode.PVE);
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [isMuted, setIsMuted] = useState(false);

  // Game State Refs (for Loop)
  const playersRef = useRef<Player[]>([]);
  const walkersRef = useRef<Walker[]>([]);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isGameOverRef = useRef(false);
  
  // Input Queue to prevent multiple turns in one tick
  const inputQueueRef = useRef<{ [key: number]: Direction[] }>({ 1: [], 2: [] });

  // Initialize Audio on Mount/Interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      startBGM();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    setMute(newState);
  };

  // Initialize Game
  const initGame = useCallback(() => {
    const p1: Player = {
      id: 1,
      name: "Player 1",
      color: P1_COLOR,
      head: { ...P1_START_POS },
      trail: [{ ...P1_START_POS }],
      direction: Direction.RIGHT,
      isDead: false,
      score: 0,
    };

    const p2: Player = {
      id: 2,
      name: mode === GameMode.PVE ? "CPU" : "Player 2",
      color: P2_COLOR,
      head: { ...P2_START_POS },
      trail: [{ ...P2_START_POS }],
      direction: Direction.LEFT,
      isDead: false,
      score: 0,
    };

    // Initialize Walkers at random positions (away from start zones roughly)
    const newWalkers: Walker[] = [];
    for (let i = 0; i < WALKER_COUNT; i++) {
      let valid = false;
      let pos = { x: 0, y: 0 };
      while (!valid) {
        pos = {
          x: Math.floor(Math.random() * config.gridWidth),
          y: Math.floor(Math.random() * config.gridHeight)
        };
        // Avoid start zones
        if (Math.abs(pos.x - P1_START_POS.x) > 5 && Math.abs(pos.x - P2_START_POS.x) > 5) {
          valid = true;
        }
      }
      newWalkers.push({ id: i, position: pos, moveTimer: Math.floor(Math.random() * WALKER_SPEED_MOD) });
    }

    playersRef.current = [p1, p2];
    walkersRef.current = newWalkers;
    inputQueueRef.current = { 1: [], 2: [] };
    isGameOverRef.current = false;
    setWinner(null);
  }, [mode, config]);

  const startGame = () => {
    initGame();
    playGameStartSound();
    setStatus(GameStatus.PLAYING);
  };

  const setGameMode = (m: GameMode) => {
    setMode(m);
    setScores({ p1: 0, p2: 0 });
  };

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;

      const p1 = playersRef.current[0];
      const p2 = playersRef.current[1];
      
      const registerTurn = (playerId: number, turn: 'left' | 'right') => {
        const queue = inputQueueRef.current[playerId];
        // Limit queue size to prevent input lag buildup
        if (queue.length > 2) return;
        
        // Determine last planned direction (current dir or last queued)
        let lastDir = queue.length > 0 ? queue[queue.length - 1] : (playerId === 1 ? p1.direction : p2.direction);
        
        let newDir = lastDir;
        if (turn === 'left') newDir = (lastDir + 3) % 4;
        if (turn === 'right') newDir = (lastDir + 1) % 4;

        if (newDir !== lastDir) {
           playTurnSound();
           queue.push(newDir);
        }
      };

      // Player 1 Controls (A / D)
      if (e.code === 'KeyA') registerTurn(1, 'left');
      if (e.code === 'KeyD') registerTurn(1, 'right');

      // Player 2 Controls (ArrowLeft / ArrowRight) - Only in PVP
      if (mode === GameMode.PVP) {
        if (e.code === 'ArrowLeft') registerTurn(2, 'left');
        if (e.code === 'ArrowRight') registerTurn(2, 'right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, mode]);

  // Game Loop
  const loop = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) {
       requestRef.current = requestAnimationFrame(loop);
       return;
    }

    const deltaTime = time - lastTimeRef.current;
    
    if (deltaTime >= config.speed) {
      lastTimeRef.current = time;
      updateGame();
    }
    
    drawGame();
    requestRef.current = requestAnimationFrame(loop);
  }, [status, config]);

  // Start/Stop Loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [loop]);

  const updateGame = () => {
    if (isGameOverRef.current) return;

    const players = playersRef.current;
    const walkers = walkersRef.current;
    
    // 1. Process Inputs and AI
    players.forEach(p => {
      if (p.isDead) return;

      // Update Direction from Queue
      if (inputQueueRef.current[p.id].length > 0) {
        p.direction = inputQueueRef.current[p.id].shift()!;
      }

      // AI Logic for P2 if PVE
      if (mode === GameMode.PVE && p.id === 2) {
        const newDir = getAIMove(p, players, config.gridWidth, config.gridHeight);
        if (newDir !== p.direction) {
          p.direction = newDir;
        }
      }
    });

    // 2. Move Walkers
    walkers.forEach(w => {
      w.moveTimer++;
      if (w.moveTimer >= WALKER_SPEED_MOD) {
        w.moveTimer = 0;
        w.position = getWalkerMove(w.position, config.gridWidth, config.gridHeight, new Set());
      }
    });

    // 3. Move Players
    players.forEach(p => {
      if (p.isDead) return;
      const nextHead = getNextPosition(p.head, p.direction);
      p.trail.push(p.head); // Add current head to trail
      p.head = nextHead;
    });

    // 4. Collision Detection
    const deaths: number[] = [];

    players.forEach(p => {
      if (p.isDead) return;
      
      // Check wall/trail collision
      if (checkCollision(p.head, config.gridWidth, config.gridHeight, players)) {
        deaths.push(p.id);
      }
      
      // Check collision with walkers
      for (const w of walkers) {
        if (p.head.x === w.position.x && p.head.y === w.position.y) {
          if (!deaths.includes(p.id)) deaths.push(p.id);
        }
      }
      
      // Check head-to-head specific case
      const opponent = players.find(op => op.id !== p.id);
      if (opponent && !opponent.isDead && p.head.x === opponent.head.x && p.head.y === opponent.head.y) {
         if (!deaths.includes(p.id)) deaths.push(p.id);
         if (!deaths.includes(opponent.id)) deaths.push(opponent.id);
      }
    });

    if (deaths.length > 0) {
      playCrashSound();
    }

    // Apply deaths
    deaths.forEach(id => {
      const p = players.find(pl => pl.id === id);
      if (p) p.isDead = true;
    });

    // Check Win Condition
    const alivePlayers = players.filter(p => !p.isDead);
    
    if (alivePlayers.length === 0) {
      isGameOverRef.current = true;
      setWinner("DRAW");
      setStatus(GameStatus.GAME_OVER);
    } else if (alivePlayers.length === 1) {
      isGameOverRef.current = true;
      const winnerPlayer = alivePlayers[0];
      setWinner(winnerPlayer.name);
      setStatus(GameStatus.GAME_OVER);
      setScores(prev => ({
        ...prev,
        [winnerPlayer.id === 1 ? 'p1' : 'p2']: prev[winnerPlayer.id === 1 ? 'p1' : 'p2'] + 1
      }));
    }
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    
    const cellW = cw / config.gridWidth;
    const cellH = ch / config.gridHeight;
    
    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, cw, ch);

    // Draw Grid Lines
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= config.gridWidth; x++) {
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, ch);
    }
    for (let y = 0; y <= config.gridHeight; y++) {
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(cw, y * cellH);
    }
    ctx.stroke();

    // Draw Border
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, cw, ch);

    // Draw Walkers (Smiley Faces)
    walkersRef.current.forEach(w => {
      const x = w.position.x * cellW;
      const y = w.position.y * cellH;
      const cx = x + cellW/2;
      const cy = y + cellH/2;
      const radius = Math.min(cellW, cellH) * 0.4;

      ctx.shadowBlur = NEON_SHADOW_BLUR;
      ctx.shadowColor = WALKER_COLOR;
      ctx.fillStyle = WALKER_COLOR;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;

      // Face
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.35, cy - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
      ctx.arc(cx + radius * 0.35, cy - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset
    });

    // Draw Players
    playersRef.current.forEach(p => {
      ctx.shadowBlur = NEON_SHADOW_BLUR;
      ctx.shadowColor = p.color;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.lineWidth = 3;

      // Draw Trail
      if (p.trail.length > 0) {
        ctx.beginPath();
        // Move to first point
        ctx.moveTo(p.trail[0].x * cellW + cellW/2, p.trail[0].y * cellH + cellH/2);
        
        for (let i = 1; i < p.trail.length; i++) {
           ctx.lineTo(p.trail[i].x * cellW + cellW/2, p.trail[i].y * cellH + cellH/2);
        }
        // Line to current head
        ctx.lineTo(p.head.x * cellW + cellW/2, p.head.y * cellH + cellH/2);
        
        ctx.stroke();
      }

      // Draw Head
      ctx.fillRect(p.head.x * cellW, p.head.y * cellH, cellW, cellH);
      
      // Reset Shadow
      ctx.shadowBlur = 0;
    });
  };

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
         // Make canvas take parent size
         const parent = canvasRef.current.parentElement;
         if (parent) {
            canvasRef.current.width = parent.clientWidth;
            canvasRef.current.height = parent.clientHeight;
            drawGame();
         }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [drawGame]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-zinc-950">
      
      {/* HUD */}
      <div className="absolute top-4 left-0 right-0 px-8 flex justify-between items-center z-10 pointer-events-none">
         <div className="flex items-center gap-4">
             <div className="w-4 h-4 rounded-full shadow-[0_0_10px_#00f3ff]" style={{ backgroundColor: P1_COLOR }}></div>
             <div className="flex flex-col">
                <span className="text-cyan-400 font-bold tracking-widest text-xl drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">PLAYER 1</span>
                <span className="text-3xl font-mono font-black text-cyan-200 leading-none filter drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">{scores.p1.toString().padStart(2, '0')}</span>
             </div>
         </div>
         
         <div className="flex flex-col items-center gap-2 pointer-events-auto">
             <div className="text-zinc-600 font-mono text-sm opacity-50">NEON CYCLE v1.1</div>
             <button 
                onClick={toggleMute}
                className="text-zinc-500 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-zinc-900/50"
                title={isMuted ? "Unmute Sound" : "Mute Sound"}
             >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
             </button>
         </div>
         
         <div className="flex items-center gap-4 text-right">
             <div className="flex flex-col items-end">
                <span className="text-red-500 font-bold tracking-widest text-xl drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">
                    {mode === GameMode.PVE ? 'CPU' : 'PLAYER 2'}
                </span>
                <span className="text-3xl font-mono font-black text-red-300 leading-none filter drop-shadow-[0_0_8px_rgba(220,38,38,0.6)]">{scores.p2.toString().padStart(2, '0')}</span>
             </div>
             <div className="w-4 h-4 rounded-full shadow-[0_0_10px_#ff003c]" style={{ backgroundColor: P2_COLOR }}></div>
         </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative w-full h-full max-w-7xl max-h-[80vh] p-4">
        <div className="w-full h-full border border-zinc-800 rounded-lg shadow-2xl bg-black overflow-hidden relative">
           <canvas ref={canvasRef} className="block w-full h-full" />
           
           {/* Menus Overlay */}
           {status !== GameStatus.PLAYING && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                
                {status === GameStatus.MENU && (
                  <div className="flex flex-col gap-8 items-center animate-in fade-in zoom-in duration-300">
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                      NEON CYCLE
                    </h1>
                    <div className="flex flex-col md:flex-row gap-6 mt-8">
                       <button 
                         onClick={() => setGameMode(GameMode.PVE)}
                         className={`flex flex-col items-center p-8 border-2 rounded-xl transition-all ${mode === GameMode.PVE ? 'border-cyan-500 bg-cyan-900/20 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                       >
                          <Monitor size={48} className={mode === GameMode.PVE ? 'text-cyan-400' : 'text-zinc-500'} />
                          <span className="mt-4 text-xl font-bold">VS CPU</span>
                          <span className="text-xs text-zinc-500 mt-2">Practice your skills</span>
                       </button>

                       <button 
                         onClick={() => setGameMode(GameMode.PVP)}
                         className={`flex flex-col items-center p-8 border-2 rounded-xl transition-all ${mode === GameMode.PVP ? 'border-red-500 bg-red-900/20 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                       >
                          <Users size={48} className={mode === GameMode.PVP ? 'text-red-500' : 'text-zinc-500'} />
                          <span className="mt-4 text-xl font-bold">VS PLAYER</span>
                          <span className="text-xs text-zinc-500 mt-2">Local Multiplayer</span>
                       </button>
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-2 text-zinc-400 text-sm font-mono bg-zinc-900/50 p-4 rounded border border-zinc-800">
                      <div className="flex gap-8">
                        <div className="text-center">
                          <p className="text-cyan-400 font-bold mb-1">PLAYER 1</p>
                          <p>Turn Left: <span className="text-white border border-zinc-600 px-1 rounded">A</span></p>
                          <p>Turn Right: <span className="text-white border border-zinc-600 px-1 rounded">D</span></p>
                        </div>
                        {mode === GameMode.PVP && (
                          <div className="text-center">
                            <p className="text-red-500 font-bold mb-1">PLAYER 2</p>
                            <p>Turn Left: <span className="text-white border border-zinc-600 px-1 rounded">←</span></p>
                            <p>Turn Right: <span className="text-white border border-zinc-600 px-1 rounded">→</span></p>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-yellow-400 text-xs">⚠️ AVOID THE SMILEY WALKERS!</p>
                    </div>

                    <Button label="START ENGINE" onClick={startGame} className="mt-4 w-64 text-lg" />
                  </div>
                )}

                {status === GameStatus.GAME_OVER && (
                   <div className="flex flex-col gap-6 items-center animate-in fade-in zoom-in duration-300">
                      <h2 className="text-5xl font-bold text-white mb-2">GAME OVER</h2>
                      <div className="text-3xl font-black tracking-widest uppercase" style={{ color: winner === 'Player 1' ? P1_COLOR : (winner === 'DRAW' ? '#fff' : P2_COLOR) }}>
                         {winner === 'DRAW' ? 'DOUBLE CRASH' : `${winner} WINS`}
                      </div>
                      <div className="text-zinc-400 font-mono text-xl mt-2 flex gap-8 border border-zinc-800 p-4 rounded bg-zinc-900/80">
                         <div className="text-cyan-400">P1 SCORE: <span className="text-white">{scores.p1}</span></div>
                         <div className="w-px bg-zinc-700"></div>
                         <div className="text-red-500">P2 SCORE: <span className="text-white">{scores.p2}</span></div>
                      </div>
                      <div className="flex gap-4 mt-8">
                        <Button label="REMATCH" onClick={startGame} />
                        <Button label="MENU" variant="secondary" onClick={() => setStatus(GameStatus.MENU)} />
                      </div>
                   </div>
                )}
             </div>
           )}
        </div>
      </div>
      
      {/* Mobile Controls Hint (Visible only on small screens) */}
      <div className="md:hidden absolute bottom-8 text-center text-zinc-500 text-xs px-4">
        Physical keyboard required for best experience.
      </div>

    </div>
  );
};