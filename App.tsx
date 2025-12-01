import React from 'react';
import { Game } from './components/Game';

const App: React.FC = () => {
  return (
    <main className="w-full h-screen bg-zinc-950 overflow-hidden text-white selection:bg-cyan-500/30">
      <Game />
    </main>
  );
};

export default App;
