
import React from 'react';
import { GameMode } from '../types';

interface LandingPageProps {
  onSelectMode: (mode: GameMode) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectMode }) => {
  return (
    <div className="w-full max-w-3xl flex flex-col gap-8 items-center justify-center">
      <div className="text-center space-y-4 animate-pulse">
        <h2 className="text-xl text-[#00ff00] tracking-[1em]">SYSTEM READY</h2>
        <p className="text-sm text-gray-400">SELECT OPERATION MODE</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
        <button 
          onClick={() => onSelectMode('SINGLE_PLAYER')}
          className="group relative p-6 border-2 border-[#00ff00] bg-black hover:bg-[#00ff00] hover:text-black transition-all duration-300 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center text-2xl font-bold">1</div>
          <span className="text-xl font-bold tracking-widest">SINGLE</span>
          <span className="text-xs opacity-70 group-hover:opacity-100">VS CPU</span>
        </button>

        <button 
          onClick={() => onSelectMode('LOCAL_MULTI')}
          className="group relative p-6 border-2 border-cyan-400 bg-black hover:bg-cyan-400 hover:text-black text-cyan-400 transition-all duration-300 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center text-2xl font-bold">4</div>
          <span className="text-xl font-bold tracking-widest">LOCAL</span>
          <span className="text-xs opacity-70 group-hover:opacity-100">PASS & PLAY</span>
        </button>

        <button 
          onClick={() => onSelectMode('HOST_ONLINE')}
          className="group relative p-6 border-2 border-yellow-400 bg-black hover:bg-yellow-400 hover:text-black text-yellow-400 transition-all duration-300 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center text-2xl font-bold">@</div>
          <span className="text-xl font-bold tracking-widest">HOST</span>
          <span className="text-xs opacity-70 group-hover:opacity-100">CREATE LOBBY</span>
        </button>
        
        <button 
          onClick={() => onSelectMode('JOIN_ONLINE')}
          className="group relative p-6 border-2 border-purple-500 bg-black hover:bg-purple-500 hover:text-black text-purple-500 transition-all duration-300 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center text-2xl font-bold">{'>'}</div>
          <span className="text-xl font-bold tracking-widest">JOIN</span>
          <span className="text-xs opacity-70 group-hover:opacity-100">ENTER CODE</span>
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-8 font-mono">
        VERSION 2.6.0 // IMPERATOR KERNEL // NETLINK ONLINE
      </div>
    </div>
  );
};
