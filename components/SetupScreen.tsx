
import React, { useState, useEffect } from 'react';
import { PlayerId, GameMode, Player, GameState } from '../types';
import { PLAYER_CONFIG } from '../gameConstants';
import { createGameSession, joinGameSession, subscribeToGame, getGameSession } from '../services/firebase';
import { generatePlayerAvatar } from '../services/geminiService';

interface SetupScreenProps {
  onStart: (config: { 
      colors: { [key in PlayerId]: string }; 
      names: { [key in PlayerId]: string }; 
      isComputer: { [key in PlayerId]: boolean }; 
      hostMode?: boolean;
      gameId?: string;
      existingPlayers?: Player[];
      myId?: PlayerId;
  }) => void;
  onBack: () => void;
  isLoading: boolean;
  gameMode: GameMode;
}

const defaultColors: { [key in PlayerId]: string } = {
  1: PLAYER_CONFIG[1].color,
  2: PLAYER_CONFIG[2].color,
  3: PLAYER_CONFIG[3].color,
  4: PLAYER_CONFIG[4].color,
};

const defaultNames: { [key in PlayerId]: string } = {
  1: 'Player 1',
  2: 'Player 2',
  3: 'Player 3',
  4: 'Player 4',
};

const RED_RISING_NAMES = [
    "Darrow", "Sevro", "Mustang", "Cassius", "Victra", 
    "Ragnar", "Adrius", "Roque", "Tactus", "Kavax", 
    "Pax", "Fitchner", "Lorn", "Nero", "Octavia",
    "Lysander", "Diomedes", "Ajax", "Atalantia"
];

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, onBack, isLoading, gameMode }) => {
  const [colors, setColors] = useState(defaultColors);
  const [names, setNames] = useState(defaultNames);
  
  // Multiplayer State
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isJoinLobby, setIsJoinLobby] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Initialize names based on mode
  useEffect(() => {
      if (gameMode === 'SINGLE_PLAYER') {
          const shuffled = [...RED_RISING_NAMES].sort(() => 0.5 - Math.random());
          setNames(prev => ({
              ...prev,
              2: shuffled[0],
              3: shuffled[1],
              4: shuffled[2]
          }));
      }
  }, [gameMode]);

  // Check for auto-join code
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('game');
      if (code && gameMode === 'JOIN_ONLINE' && !joinCode) {
          setJoinCode(code);
      }
  }, [gameMode]);

  // Host Initialization
  useEffect(() => {
      const initHost = async () => {
          if (gameMode === 'HOST_ONLINE' && !lobbyCode) {
              setIsGeneratingAvatar(true);
              const p1Avatar = await generatePlayerAvatar(defaultColors[1]);
              setIsGeneratingAvatar(false);
              
              const hostPlayer: Player = {
                  id: 1,
                  name: names[1],
                  color: colors[1],
                  pieces: [], 
                  avatarUrl: p1Avatar,
                  hasShield: false,
                  isComputer: false
              };
              
              const code = await createGameSession(hostPlayer);
              setLobbyCode(code);
              setMyPlayerId(1);
          }
      };
      initHost();
  }, [gameMode, lobbyCode]);

  // Subscription for Lobby Updates (Host & Joiner)
  useEffect(() => {
      if (!lobbyCode) return;

      const unsubscribe = subscribeToGame(lobbyCode, (data) => {
          setConnectedPlayers(data.players || []);
          
          // Auto-start for joiners when game enters PLAYING state
          if (isJoinLobby && data.gameState === GameState.PLAYING && myPlayerId) {
               onStart({ 
                 colors: colors, // Note: Colors might be desynced for joiner until full sync, but that's ok
                 names: names,
                 isComputer: { 1: false, 2: false, 3: false, 4: false },
                 gameId: lobbyCode,
                 myId: myPlayerId
             });
          }
      });
      return () => unsubscribe();
  }, [lobbyCode, isJoinLobby, myPlayerId]);

  const handleColorChange = (playerId: PlayerId, color: string) => {
    setColors(prev => ({ ...prev, [playerId]: color }));
  };

  const handleNameChange = (playerId: PlayerId, name: string) => {
    setNames(prev => ({ ...prev, [playerId]: name }));
  };
  
  const handleJoinSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!joinCode) return;
      
      setIsGeneratingAvatar(true);
      
      try {
        const session = await getGameSession(joinCode);
        
        if (!session) {
             alert("Game not found! Check the code.");
             setIsGeneratingAvatar(false);
             return;
        }
        
        const takenIds = (session.players || []).map(p => p.id);
        let myId: PlayerId | null = null;
        if (!takenIds.includes(2)) myId = 2;
        else if (!takenIds.includes(3)) myId = 3;
        else if (!takenIds.includes(4)) myId = 4;
        
        if (!myId) {
             alert("Lobby Full!");
             setIsGeneratingAvatar(false);
             return;
        }

        const avatar = await generatePlayerAvatar(colors[1]); 
        
        const me: Player = {
             id: myId,
             name: names[1], 
             color: colors[1], 
             pieces: [],
             avatarUrl: avatar,
             hasShield: false,
             isComputer: false
        };
         
        await joinGameSession(joinCode, me);
        
        setMyPlayerId(myId);
        setLobbyCode(joinCode);
        setIsJoinLobby(true);
        
      } catch (error) {
          console.error(error);
          alert("Connection failed.");
      } finally {
          setIsGeneratingAvatar(false);
      }
  };
  
  const handleHostStart = () => {
      // Determine which slots are computers (empty slots)
      const isComputer: { [key in PlayerId]: boolean } = { 1: false, 2: false, 3: false, 4: false };
      const takenIds = connectedPlayers.map(p => p.id);
      
      [1, 2, 3, 4].forEach(num => {
          const id = num as PlayerId;
          if (!takenIds.includes(id)) {
              isComputer[id] = true;
          }
      });

      if (lobbyCode) {
        onStart({ 
            colors, 
            names, 
            isComputer, 
            hostMode: true,
            gameId: lobbyCode,
            existingPlayers: connectedPlayers
        });
      }
  };
  
  const handleShare = async () => {
      const link = `${window.location.origin}?game=${lobbyCode}`;
      let shared = false;

      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'Join Imperator',
                  text: `Join my Imperator game! Code: ${lobbyCode}`,
                  url: link
              });
              shared = true;
          } catch (err) {
              // User cancelled or failed, try clipboard
          }
      } 
      
      if (!shared) {
          try {
              await navigator.clipboard.writeText(link);
              setCopyFeedback(true);
              setTimeout(() => setCopyFeedback(false), 2000);
          } catch (err) {
              // Manual Fallback for non-secure contexts
              prompt("Copy this link to share:", link);
          }
      }
  };

  // Render Lobby (Host or Joiner waiting)
  if (lobbyCode) {
      return (
        <div className="w-full max-w-2xl bg-black bg-opacity-90 border-2 border-yellow-400 p-8 text-center shadow-[0_0_30px_rgba(250,204,21,0.2)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgNDBMMDQgMGgydjQwaC0yWiIgZmlsbD0iI2ZmZiIvPgo8L3N2Zz4=')]"></div>
            
            <h2 className="text-3xl mb-2 text-yellow-400 font-black tracking-widest relative z-10">
                {isJoinLobby ? 'LOBBY ACCESS GRANTED' : 'LOBBY STATUS: ACTIVE'}
            </h2>
            <p className="text-xs text-yellow-600 font-mono mb-6 relative z-10">
                {isJoinLobby ? 'WAITING FOR COMMANDER TO LAUNCH...' : 'WAITING FOR UPLINK...'}
            </p>
            
            <div className="bg-gray-900/80 border border-yellow-400/50 p-6 mb-8 relative z-10">
                <p className="text-gray-400 mb-2 text-xs tracking-widest">SECURE CHANNEL CODE</p>
                <div className="flex items-center justify-center gap-4">
                    <div className="text-6xl font-mono tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                        {lobbyCode}
                    </div>
                </div>
                <button 
                    onClick={handleShare} 
                    className={`mt-4 text-xs px-4 py-2 rounded border transition-all duration-200 ${copyFeedback ? 'bg-green-500 text-black border-green-500' : 'bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-200 border-yellow-400/50'}`}
                >
                    {copyFeedback ? 'LINK COPIED!' : 'SHARE LOBBY LINK'}
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                {[1, 2, 3, 4].map(num => {
                    const id = num as PlayerId;
                    const p = connectedPlayers.find(pl => pl.id === id);
                    const isMe = id === myPlayerId;
                    return (
                        <div key={id} className={`p-3 border ${p ? 'border-green-500 bg-green-900/20' : 'border-gray-800 bg-gray-900/50'} flex items-center gap-3 relative`}>
                            <div className={`w-3 h-3 rounded-full ${p ? 'bg-green-500 shadow-[0_0_5px_#0f0]' : 'bg-gray-700'}`}></div>
                            <span className={p ? 'text-white' : 'text-gray-600'}>
                                {p ? p.name : `SLOT ${id} ${!isJoinLobby ? '(AUTO-BOT)' : ''}`}
                            </span>
                            {isMe && <span className="absolute right-2 text-[10px] text-yellow-400">YOU</span>}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-4 relative z-10">
                 <button 
                    onClick={onBack}
                    className="flex-1 p-3 bg-red-900/20 text-red-500 font-bold border-2 border-red-900 hover:bg-red-900/40"
                >
                    DISCONNECT
                </button>
                {!isJoinLobby && (
                    <button 
                        onClick={handleHostStart} 
                        className="flex-1 p-3 bg-yellow-400 text-black font-bold hover:bg-yellow-300 border-2 border-yellow-400"
                    >
                        LAUNCH GAME
                    </button>
                )}
            </div>
        </div>
      );
  }

  // Join Entry Screen
  if (gameMode === 'JOIN_ONLINE') {
      return (
        <div className="w-full max-w-md bg-black bg-opacity-80 border-2 border-[#00ff00] p-8 text-center window-glare">
            <h2 className="text-3xl mb-6 text-[#00ff00]">JOIN SERVER</h2>
            <form onSubmit={handleJoinSubmit} className="space-y-6">
                <div>
                    <label className="block text-left text-sm mb-2 text-gray-400">ACCESS CODE</label>
                    <input 
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-900 border border-[#00ff00] p-3 text-center text-2xl tracking-widest uppercase text-[#00ff00] focus:outline-none focus:shadow-[0_0_10px_#00ff00]"
                        placeholder="ABCDEF"
                        maxLength={6}
                    />
                </div>
                <div>
                    <label className="block text-left text-sm mb-2 text-gray-400">PILOT NAME</label>
                    <input 
                        value={names[1]}
                        onChange={(e) => handleNameChange(1, e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 p-2 text-[#00ff00]"
                        maxLength={12}
                    />
                </div>
                 <div>
                    <label className="block text-left text-sm mb-2 text-gray-400">COLOR</label>
                     <input
                        type="color"
                        value={colors[1]}
                        onChange={(e) => handleColorChange(1, e.target.value)}
                        className="w-full h-10 p-0 border border-gray-600 bg-transparent cursor-pointer"
                      />
                </div>
                
                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={onBack} className="flex-1 p-3 border border-gray-600 hover:bg-gray-800 text-gray-400">BACK</button>
                    <button type="submit" disabled={isGeneratingAvatar} className="flex-1 p-3 bg-[#00ff00] text-black font-bold hover:bg-green-400 disabled:opacity-50">
                        {isGeneratingAvatar ? 'CONNECTING...' : 'CONNECT'}
                    </button>
                </div>
            </form>
        </div>
      );
  }

  // Standard Setup (Single/Local)
  const isComputer: { [key in PlayerId]: boolean } = {
      1: false,
      2: gameMode === 'SINGLE_PLAYER',
      3: gameMode === 'SINGLE_PLAYER',
      4: gameMode === 'SINGLE_PLAYER'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ colors, names, isComputer });
  };

  if (isLoading || isGeneratingAvatar) {
    return (
        <div className="w-full max-w-2xl bg-black bg-opacity-70 border-2 border-[#00ff00] p-6 window-glare text-center">
            <h2 className="text-3xl mb-4 text-yellow-400 animate-pulse">ESTABLISHING NEURAL LINK...</h2>
            <p className="text-xl">Generating Pilot Identity...</p>
            <div className="mt-4 w-full bg-gray-700 h-4 border-2 border-[#00ff00] overflow-hidden">
                <div className="bg-yellow-400 h-full w-full animate-[progress_2s_ease-in-out_infinite]"></div>
            </div>
            <style>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-black bg-opacity-70 border-2 border-[#00ff00] p-6 window-glare">
      <div className="absolute top-0 left-2 text-lg">:: Game Setup :: {gameMode === 'SINGLE_PLAYER' ? 'SINGLE PLAYER' : 'MULTIPLAYER'}</div>
      <form onSubmit={handleSubmit} className="mt-6">
        <h2 className="text-2xl text-center mb-6">Configure Pilots</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(Object.keys(colors)).map((key) => {
            const id = parseInt(key) as PlayerId;
            const isCpu = gameMode === 'SINGLE_PLAYER' && id !== 1;
            
            return (
            <div key={id} className={`flex flex-col gap-2 p-3 border ${isCpu ? 'border-gray-700 bg-gray-900/50 opacity-70' : 'border-gray-600'}`}>
              <div className="flex justify-between items-center">
                  <label htmlFor={`player-${id}-name`} className="text-lg text-yellow-400">
                    Player {id} {isCpu && '(CPU)'}
                  </label>
                  <input
                    id={`player-${id}-color`}
                    type="color"
                    value={colors[id]}
                    disabled={isCpu}
                    onChange={(e) => handleColorChange(id, e.target.value)}
                    className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer"
                  />
              </div>
              <input 
                id={`player-${id}-name`}
                type="text"
                value={names[id]}
                disabled={isCpu}
                onChange={(e) => handleNameChange(id, e.target.value)}
                maxLength={12}
                className="bg-black border-b border-gray-500 focus:border-[#00ff00] outline-none text-[#00ff00] w-full uppercase"
                placeholder={`PLAYER ${id}`}
              />
            </div>
          )})}
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
          <button
             type="button"
             onClick={onBack}
             className="p-3 px-8 bg-transparent text-[#00ff00] text-2xl border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black w-full md:w-auto"
             disabled={isLoading}
          >
             BACK
          </button>
          <button
            type="submit"
            className="p-3 px-8 bg-yellow-400 text-black text-2xl border-2 border-black hover:bg-yellow-300 disabled:bg-gray-500 disabled:cursor-not-allowed w-full md:w-auto"
            disabled={isLoading}
          >
            LAUNCH MISSION
          </button>
        </div>
      </form>
    </div>
  );
};
