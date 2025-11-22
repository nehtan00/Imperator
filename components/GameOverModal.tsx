
import React from 'react';
import { Player, PlayerId } from '../types';

interface GameOverModalProps {
  winners: PlayerId[];
  players: Player[];
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ winners, players, onRestart }) => {
    const finalRankings = [...winners];
    players.forEach(p => {
        if(!finalRankings.includes(p.id)) {
            finalRankings.push(p.id);
        }
    });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-black border-4 border-yellow-400 p-8 window-glare text-center">
        <h2 className="text-5xl text-yellow-400 mb-6 animate-pulse">GAME OVER</h2>
        <div className="space-y-4 text-2xl">
            {finalRankings.map((id, index) => {
                const player = players.find(p => p.id === id);
                if(!player) return null;
                return (
                    <div key={id} className="flex items-center justify-between p-2" style={{color: player.color}}>
                        <span>{index + 1}. {player.name}</span>
                        <span>{index === 0 ? 'WINNER' : index === 1 ? '2ND' : index === 2 ? '3RD' : '4TH'}</span>
                    </div>
                )
            })}
        </div>
        <button
          onClick={onRestart}
          className="mt-8 p-3 px-8 bg-yellow-400 text-black text-2xl border-2 border-black hover:bg-yellow-300"
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
};
