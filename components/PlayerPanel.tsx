
import React from 'react';
import { Player, PlayerId, SpecialAbility, PendingAction } from '../types';
import { ABILITY_DESCRIPTIONS } from '../gameConstants';
import { Icon } from './Icon';

interface PlayerPanelProps {
  players: Player[];
  currentPlayerId: PlayerId;
  dice: [number, number] | null;
  ability: SpecialAbility | null;
  onRollDice: () => void;
  onUseAbility: (ability: SpecialAbility) => void;
  onCancelAbility: () => void;
  onActivateShield: (allow: boolean) => void;
  onSkipTurn: () => void;
  pendingAction: PendingAction;
  hasValidMoves: boolean;
}

const PlayerStatus: React.FC<{ player: Player; isCurrent: boolean }> = ({ player, isCurrent }) => {
  const piecesHome = player.pieces.filter(p => p.state === 'HOME').length;
  
  return (
    <div className={`border-2 p-2 mb-2 transition-all duration-300 ${isCurrent ? 'border-yellow-400 shadow-[0_0_10px_theme(colors.yellow.400)]' : 'border-[#00ff00] opacity-60'}`} style={{'--p-color': player.color} as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-[var(--p-color)] p-1 shrink-0">
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt={`${player.name} Avatar`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-700 animate-pulse flex items-center justify-center text-xs">GEN...</div>
          )}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-center">
            <h3 className="text-xl">{player.name}</h3>
            {player.hasShield && <Icon name={SpecialAbility.SHIELD} className="w-6 h-6 text-cyan-400 animate-pulse" />}
          </div>
          <div className="text-sm">Pieces Home: {piecesHome}/4</div>
        </div>
      </div>
    </div>
  );
};

const DiceDisplay: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-16 h-16 border-2 border-yellow-400 flex items-center justify-center text-4xl bg-black">
    {value}
  </div>
);

const AbilityDisplay: React.FC<{ ability: SpecialAbility }> = ({ ability }) => (
  <div className="w-16 h-16 border-2 border-yellow-400 flex items-center justify-center text-4xl bg-black p-2">
    <Icon name={ability} className="w-10 h-10" />
  </div>
);


export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  players,
  currentPlayerId,
  dice,
  ability,
  onRollDice,
  onUseAbility,
  onCancelAbility,
  onActivateShield,
  onSkipTurn,
  pendingAction,
  hasValidMoves,
}) => {
    const currentPlayer = players.find(p => p.id === currentPlayerId)!;
    
    // Override description for Gold Token to emphasize stacking
    const abilityDesc = ability === SpecialAbility.GOLD_TOKEN 
        ? "SHORTCUT: Free Action! Move a piece from Start to board. Then take your normal move."
        : ability ? ABILITY_DESCRIPTIONS[ability] : "";

    const renderActionControls = () => {
        if (pendingAction?.type === 'roll') {
            return <button onClick={onRollDice} className="w-full p-3 bg-yellow-400 text-black text-2xl border-2 border-black hover:bg-yellow-300">ROLL DICE</button>;
        }
        
        if (pendingAction?.type === 'move' && ability && ability !== SpecialAbility.NONE) {
            return (
                <div className='text-center'>
                    <p className="mb-2 text-yellow-400">{abilityDesc}</p>
                    <p className='mb-2'>Choose your action:</p>
                    <button onClick={() => onUseAbility(ability)} className="w-full p-2 mb-2 bg-purple-500 text-white text-xl border-2 border-black hover:bg-purple-400">USE ABILITY: {ability}</button>
                    <button onClick={onCancelAbility} className="w-full p-2 bg-gray-500 text-white text-xl border-2 border-black hover:bg-gray-400">USE DICE ROLL ONLY</button>
                </div>
            );
        }

        if (pendingAction?.type === 'move') {
             if (!hasValidMoves) {
                 return (
                     <div className="text-center animate-pulse">
                         <p className="text-red-500 mb-4 text-xl">NO VALID MOVES DETECTED</p>
                         <button onClick={onSkipTurn} className="w-full p-3 bg-red-900/80 text-white text-2xl border-2 border-red-500 hover:bg-red-800">
                            PASS TURN
                         </button>
                     </div>
                 );
             }
             return <p className="text-center text-lg animate-pulse">Select a piece to move...</p>;
        }

        if (pendingAction?.type === 'use_ability') {
             return <p className="text-center text-lg animate-pulse text-purple-400">Select target for ability...</p>;
        }

        if (pendingAction?.type === 'shield_defense' && pendingAction.defenderId === currentPlayerId) {
             return (
                <div className='text-center'>
                    <p className="mb-2 text-red-500 animate-pulse">INCOMING ATTACK!</p>
                    <p className="mb-2">Activate your shield to defend?</p>
                    <button onClick={() => onActivateShield(true)} className="w-full p-2 mb-2 bg-cyan-500 text-white text-xl border-2 border-black hover:bg-cyan-400">ACTIVATE SHIELD</button>
                    <button onClick={() => onActivateShield(false)} className="w-full p-2 bg-red-600 text-white text-xl border-2 border-black hover:bg-red-500">DO NOT DEFEND</button>
                </div>
            );
        }

        return <p className="text-center text-lg animate-pulse">Awaiting player move...</p>;
    };

  return (
    <div className="bg-black bg-opacity-70 border-2 border-[#00ff00] p-2 window-glare h-full flex flex-col">
      <div className="absolute top-0 left-2 text-lg">:: Command Console ::</div>
      <div className="mt-8 flex-grow">
        {players.map(p => (
          <PlayerStatus key={p.id} player={p} isCurrent={p.id === currentPlayerId} />
        ))}
      </div>
      <div className="border-t-2 border-[#00ff00] mt-4 pt-4">
        <h3 className="text-center text-2xl mb-2 text-yellow-400">-- TURN: {currentPlayer.name} --</h3>
        
        <div className="flex justify-center gap-4 my-4">
            {dice && <DiceDisplay value={dice[0]} />}
            {ability && <AbilityDisplay ability={ability} />}
        </div>

        <div className="mt-4">
            {renderActionControls()}
        </div>

      </div>
    </div>
  );
};
