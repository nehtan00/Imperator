
import React, { useState, useEffect } from 'react';
import { GameBoard } from './components/GameBoard';
import { PlayerPanel } from './components/PlayerPanel';
import { SetupScreen } from './components/SetupScreen';
import { LandingPage } from './components/LandingPage';
import { GameOverModal } from './components/GameOverModal';
import { useGameLogic } from './hooks/useGameLogic';
import { PlayerId, GameState, GameMode, Player } from './types';
import { subscribeToGame } from './services/firebase';

const App: React.FC = () => {
  const {
    gameState,
    players,
    currentPlayerId,
    dice,
    ability,
    board,
    winners,
    actions,
    pendingAction,
    hasValidMoves,
    gameId,
    setGameId,
    setLocalPlayerId,
    localPlayerId
  } = useGameLogic();
  
  const [showBootScreen, setShowBootScreen] = useState(true);
  const [gameMode, setGameMode] = useState<GameMode>('LOCAL_MULTI');

  // Check for URL params for joining
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('game');
      if (joinCode) {
          setGameMode('JOIN_ONLINE');
          actions.setGameState(GameState.SETUP);
      }
  }, [actions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBootScreen(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);


  const handleModeSelect = (mode: GameMode) => {
      setGameMode(mode);
      actions.setGameState(GameState.SETUP);
  };

  const handleGameStart = async (config: { 
      colors: { [key in PlayerId]: string }, 
      names: { [key in PlayerId]: string },
      isComputer: { [key in PlayerId]: boolean },
      hostMode?: boolean,
      gameId?: string,
      existingPlayers?: Player[]
  }) => {
    
    if (gameMode === 'JOIN_ONLINE') {
        handleJoinStart(config);
    } else {
        await actions.initializeGame(config);
    }
  };
  
  const handleJoinStart = async (config: any) => {
      const c = config as any;
      if (c.gameId && c.myId) {
           setGameId(c.gameId);
           setLocalPlayerId(c.myId);
           actions.setGameState(GameState.PLAYING);
      } else {
          await actions.initializeGame(config);
      }
  };

  if (showBootScreen) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-2xl md:text-4xl text-center">
                <p>IMPERATOR BIOS</p>
                <p className="my-4">INITIALIZING RETRO GAMING PROTOCOL...</p>
                <p>LOADING <span className="animate-pulse">IMPERATOR.EXE</span></p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen text-[#00ff00] p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="scanline pointer-events-none fixed inset-0 z-10 opacity-20 animate-[scanline_8s_linear_infinite]"></div>

      <header className="w-full max-w-7xl mb-4 z-20 relative">
        <div className="border-2 border-[#00ff00] bg-black bg-opacity-50 p-2 text-center relative">
          <h1 className="text-3xl md:text-6xl tracking-[0.2em] font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">IMPERATOR</h1>
          {gameState !== GameState.LANDING && (
             <button 
               onClick={actions.resetGame}
               className="absolute top-1/2 right-2 md:right-4 -translate-y-1/2 text-[#00ff00] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-3 py-1 text-sm md:text-base font-bold tracking-widest transition-colors uppercase"
             >
               Main Menu
             </button>
          )}
          {gameId && (
             <div className="absolute top-full right-0 bg-black border border-[#00ff00] text-xs px-2 py-1">
                 SESSION: {gameId}
             </div>
          )}
        </div>
      </header>

      <div className="z-20 w-full flex justify-center">
        {gameState === GameState.LANDING && <LandingPage onSelectMode={handleModeSelect} />}
        
        {gameState === GameState.SETUP && (
            <SetupScreen 
                onStart={handleGameStart} 
                onBack={actions.resetGame}
                isLoading={pendingAction?.type === 'initializing'} 
                gameMode={gameMode}
            />
        )}
        
        {gameState === GameState.PLAYING && players && board && (
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full max-w-7xl">
            <div className="lg:col-span-2">
                <GameBoard
                board={board}
                players={players}
                onPieceClick={actions.handlePieceClick}
                selectedPiece={pendingAction?.type === 'move' ? pendingAction.pieceId : null}
                validMoves={pendingAction?.type === 'move' ? pendingAction.validMoves : null}
                currentPlayerId={currentPlayerId}
                />
            </div>
            <div>
                <PlayerPanel
                players={players}
                currentPlayerId={currentPlayerId}
                dice={dice}
                ability={ability}
                onRollDice={actions.rollDice}
                onUseAbility={actions.useAbility}
                onCancelAbility={actions.cancelAbility}
                onActivateShield={actions.activateShield}
                onSkipTurn={actions.skipTurn}
                pendingAction={pendingAction}
                hasValidMoves={hasValidMoves}
                />
                {localPlayerId && (
                    <div className="mt-2 text-center text-xs text-gray-500">
                        PLAYING AS PLAYER {localPlayerId}
                    </div>
                )}
            </div>
            </main>
        )}

        {gameState === GameState.GAME_OVER && players && <GameOverModal winners={winners} players={players} onRestart={actions.resetGame} />}
      </div>

    </div>
  );
};

export default App;
