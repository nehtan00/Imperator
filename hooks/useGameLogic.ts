
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Player, Piece, GameState, SpecialAbility, PlayerId, PieceState, PendingAction, BoardSpace, BoardSpaceType } from '../types';
import { PLAYER_COUNT, PIECES_PER_PLAYER, MAIN_CIRCUIT_SIZE, HOME_PATH_SIZE, PLAYER_CONFIG, ABILITY_DIE_FACES, createBoardLayout } from '../gameConstants';
import { generatePlayerAvatar } from '../services/geminiService';
import { createGameSession, joinGameSession, subscribeToGame, updateRemoteGameState } from '../services/firebase';

export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LANDING);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [board, setBoard] = useState<BoardSpace[] | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<PlayerId>(1);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [ability, setAbility] = useState<SpecialAbility | null>(null);
  const [winners, setWinners] = useState<PlayerId[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  
  // Multiplayer State
  const [gameId, setGameId] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId | null>(null);
  const isMultiplayer = !!gameId;

  const resetGame = useCallback(() => {
    setGameState(GameState.LANDING);
    setPlayers(null);
    setBoard(null);
    setCurrentPlayerId(1);
    setDice(null);
    setAbility(null);
    setWinners([]);
    setPendingAction(null);
    setGameId(null);
    setLocalPlayerId(null);
  }, []);
  
  // Helper to broadcast state updates to Firebase
  const broadcastState = useCallback(async (updates: any) => {
      if (gameId) {
          await updateRemoteGameState(gameId, updates);
      }
  }, [gameId]);

  // Listener for Firebase updates
  useEffect(() => {
      if (gameId) {
          const unsubscribe = subscribeToGame(gameId, (data) => {
              if (data.players) setPlayers(data.players);
              if (data.gameState) setGameState(data.gameState);
              if (data.currentPlayerId) setCurrentPlayerId(data.currentPlayerId);
              if (data.dice !== undefined) setDice(data.dice);
              if (data.ability !== undefined) setAbility(data.ability as SpecialAbility);
              if (data.pendingAction !== undefined) setPendingAction(data.pendingAction);
              if (data.winners) setWinners(data.winners);
          });
          return () => unsubscribe();
      }
  }, [gameId]);

  const initializeGame = useCallback(async (config: { 
      colors: { [key in PlayerId]: string }, 
      names: { [key in PlayerId]: string },
      isComputer: { [key in PlayerId]: boolean },
      hostMode?: boolean,
      gameId?: string,
      existingPlayers?: Player[]
  }) => {
    setPendingAction({ type: 'initializing' });
    const newBoard = createBoardLayout();
    setBoard(newBoard);

    const isHost = config.hostMode;
    let gId = config.gameId;
    
    const newPlayers: Player[] = await Promise.all(
      Array.from({ length: PLAYER_COUNT }, async (_, i) => {
        const id = (i + 1) as PlayerId;
        
        // If starting from lobby, preserve existing player details (name, avatar, color)
        const existing = config.existingPlayers?.find(p => p.id === id);
        
        // Only generate avatar if we don't have one from the lobby
        const avatarUrl = existing?.avatarUrl || await generatePlayerAvatar(config.colors[id]);
        
        return {
          id,
          name: existing?.name || config.names[id] || `Player ${id}`,
          color: existing?.color || config.colors[id],
          pieces: Array.from({ length: PIECES_PER_PLAYER }, (_, j) => ({
            id: i * PIECES_PER_PLAYER + j,
            playerId: id,
            state: PieceState.START,
            position: -1,
          })),
          avatarUrl: avatarUrl,
          hasShield: false,
          isComputer: config.isComputer[id],
        };
      })
    );

    setPlayers(newPlayers);

    // Randomize starting player
    const startingPlayer = (Math.floor(Math.random() * PLAYER_COUNT) + 1) as PlayerId;
    setCurrentPlayerId(startingPlayer);
    setPendingAction({ type: 'roll' });

    if (isHost) {
        // If we are host but no gameId passed, create new session (shouldn't happen in HOST_ONLINE flow usually)
        if (!gId) {
             gId = await createGameSession(newPlayers[0]);
        }
        
        setGameId(gId);
        setLocalPlayerId(1);
        
        // Push full initialized state to the EXISTING session
        await updateRemoteGameState(gId!, { 
            players: newPlayers, 
            gameState: GameState.PLAYING, 
            currentPlayerId: startingPlayer,
            pendingAction: { type: 'roll' }
        });
    }

    setGameState(GameState.PLAYING);
    
  }, [broadcastState]);

  const joinOnlineGame = useCallback(async (code: string, playerName: string, color: string) => {
      setPendingAction({ type: 'initializing' });
      const newBoard = createBoardLayout();
      setBoard(newBoard);
      setGameId(code);
      setGameState(GameState.PLAYING);
  }, []);


  const nextTurn = useCallback(() => {
    // Calculate next state locally
    const finishedPlayerIds = new Set(winners);
    let nextPlayerId = currentPlayerId;
    do {
      nextPlayerId = (nextPlayerId % PLAYER_COUNT + 1) as PlayerId;
    } while (finishedPlayerIds.has(nextPlayerId) && finishedPlayerIds.size < PLAYER_COUNT)

    let nextGameState = gameState;
    let nextPendingAction: PendingAction = { type: 'roll' };

    if (finishedPlayerIds.size >= PLAYER_COUNT - 1) {
        nextGameState = GameState.GAME_OVER;
        nextPendingAction = {type: 'game_over'};
    }

    // Update Local
    setDice(null);
    setAbility(null);
    setCurrentPlayerId(nextPlayerId);
    setPendingAction(nextPendingAction);
    setGameState(nextGameState);

    // Broadcast
    broadcastState({
        dice: null,
        ability: null,
        currentPlayerId: nextPlayerId,
        pendingAction: nextPendingAction,
        gameState: nextGameState
    });

  }, [currentPlayerId, winners, gameState, broadcastState]);

  const checkForWinner = useCallback((updatedPlayers: Player[]) => {
    const newWinners = [...winners];
    updatedPlayers.forEach(p => {
        if (!newWinners.includes(p.id) && p.pieces.every(pc => pc.state === PieceState.HOME)) {
            newWinners.push(p.id);
        }
    });
    
    // We return the new winners array for use in logic, also set it
    if (JSON.stringify(newWinners) !== JSON.stringify(winners)) {
        setWinners(newWinners);
        broadcastState({ winners: newWinners });
    }
    
    if(newWinners.length >= PLAYER_COUNT - 1) {
        setGameState(GameState.GAME_OVER);
        setPendingAction({ type: 'game_over' });
        broadcastState({ gameState: GameState.GAME_OVER, pendingAction: { type: 'game_over' } });
    }
  }, [winners, broadcastState]);

  // Core logic to check if a specific move is valid without applying it
  const canMovePiece = useCallback((piece: Piece, moveAmount: number, currentPlayers: Player[]): boolean => {
      if (piece.state === PieceState.START) {
          // Allow exit on 6 or 1
          if (moveAmount !== 6 && moveAmount !== 1) return false;
          const startPos = PLAYER_CONFIG[piece.playerId].startPosition;
          // Check valid if blocked by own piece
          const ownPiece = currentPlayers.flatMap(p => p.pieces).find(p => p.position === startPos && p.playerId === piece.playerId);
          return !ownPiece;
      }

      if (piece.state === PieceState.HOME) {
          const currentStep = piece.position % 100;
          const targetStep = currentStep + moveAmount;
          if (targetStep > HOME_PATH_SIZE) return false;
          
          const newPos = 100 * piece.playerId + targetStep;
          const blocking = currentPlayers.flatMap(p => p.pieces).find(p => p.position === newPos);
          return !blocking;
      }

      // In play
      const homeEntry = PLAYER_CONFIG[piece.playerId].homeEntryPosition;
      const dist = (homeEntry - piece.position + MAIN_CIRCUIT_SIZE) % MAIN_CIRCUIT_SIZE;
      
      if (moveAmount > dist) {
          const stepsPast = moveAmount - dist;
          if (stepsPast > HOME_PATH_SIZE) return false;
          const newPos = 100 * piece.playerId + stepsPast;
          const blocking = currentPlayers.flatMap(p => p.pieces).find(p => p.position === newPos);
          return !blocking;
      }

      const targetPos = (piece.position + moveAmount) % MAIN_CIRCUIT_SIZE;
      const ownBlocking = currentPlayers.flatMap(p => p.pieces).find(p => p.position === targetPos && p.playerId === piece.playerId);
      
      return !ownBlocking;
  }, []);


  const movePiece = useCallback((pieceToMove: Piece, moveAmount: number, isBackward: boolean = false) => {
    // If online and not our turn/piece, ignore (double check)
    if (isMultiplayer && pieceToMove.playerId !== localPlayerId && localPlayerId !== null) return;

    setPlayers(currentPlayers => {
        if (!currentPlayers || !board) return currentPlayers;
        let playersAfterMove = [...currentPlayers.map(p => ({...p, pieces: [...p.pieces.map(pc => ({...pc}))]}))];
        
        const piece = playersAfterMove.flatMap(p => p.pieces).find(p => p.id === pieceToMove.id)!;
        let newPosition: number;

        if (isBackward) {
            if (piece.state === PieceState.HOME) {
                 return currentPlayers; 
            }
            newPosition = (piece.position - moveAmount + MAIN_CIRCUIT_SIZE) % MAIN_CIRCUIT_SIZE;
        } else {
            const homeEntry = PLAYER_CONFIG[piece.playerId].homeEntryPosition;
            let passedHomeEntry = false;
            let stepsPastEntry = 0;

            if (piece.state === PieceState.HOME) {
                const currentStep = piece.position % 100;
                const targetStep = currentStep + moveAmount;
                if (targetStep > HOME_PATH_SIZE) return currentPlayers;
                newPosition = 100 * piece.playerId + targetStep;
                const blockingPiece = playersAfterMove.flatMap(p => p.pieces).find(p => p.position === newPosition);
                if (blockingPiece) return currentPlayers;

            } else {
                const distanceToEntry = (homeEntry - piece.position + MAIN_CIRCUIT_SIZE) % MAIN_CIRCUIT_SIZE;
                if (moveAmount > distanceToEntry) {
                    passedHomeEntry = true;
                    stepsPastEntry = moveAmount - distanceToEntry;
                }

                if (passedHomeEntry) {
                    if (stepsPastEntry <= HOME_PATH_SIZE) {
                         newPosition = 100 * piece.playerId + stepsPastEntry;
                         const blockingPiece = playersAfterMove.flatMap(p => p.pieces).find(p => p.position === newPosition);
                         if (blockingPiece) return currentPlayers;
                    } else {
                         return currentPlayers;
                    }
                } else {
                    newPosition = (piece.position + moveAmount) % MAIN_CIRCUIT_SIZE;
                }
            }
        }
        
        piece.position = newPosition;
        
        if(newPosition > 100) {
             if (newPosition === 100 * piece.playerId + HOME_PATH_SIZE) {
                 piece.state = PieceState.HOME;
             } else {
                 piece.state = PieceState.HOME; 
             }
        } else {
          piece.state = PieceState.IN_PLAY;
        }
        
        let turnEnds = true;
        
        const landedSpace = board.find(s => s.position === newPosition);
        if (landedSpace && landedSpace.type === BoardSpaceType.GO_AGAIN) {
          turnEnds = false;
        }
        if (landedSpace && landedSpace.type === BoardSpaceType.WARP && landedSpace.warpTarget !== undefined) {
          piece.position = landedSpace.warpTarget;
        }

        if (newPosition < 100) {
            const finalPosition = piece.position;
            const defendingPiece = playersAfterMove
              .flatMap(p => p.pieces)
              .find(p => p.position === finalPosition && p.playerId !== piece.playerId);

            if (defendingPiece) {
              const defender = playersAfterMove.find(p => p.id === defendingPiece.playerId)!;
              if (defender.hasShield) {
                setPendingAction({ type: 'shield_defense', attackerId: piece.playerId, defenderId: defender.id, position: finalPosition });
                broadcastState({ 
                    players: playersAfterMove, 
                    pendingAction: { type: 'shield_defense', attackerId: piece.playerId, defenderId: defender.id, position: finalPosition } 
                });
                return playersAfterMove;
              } else {
                defendingPiece.position = -1;
                defendingPiece.state = PieceState.START;
              }
            }
        }

        checkForWinner(playersAfterMove);
        
        // 6 always gives a bonus turn
        if (dice && dice[0] === 6) turnEnds = false;
        
        // Broadcast the move result
        const updates: any = { players: playersAfterMove };
        
        if (turnEnds) {
             // Next turn triggers separately
        } else {
           updates.pendingAction = {type: 'roll'};
           setPendingAction({type: 'roll'});
        }
        
        broadcastState(updates);
        
        if (turnEnds) {
            nextTurn();
        }

        return playersAfterMove;
    });
  }, [board, dice, nextTurn, checkForWinner, isMultiplayer, localPlayerId, broadcastState]);

  const rollDice = useCallback(() => {
    // Check turn
    if (isMultiplayer && currentPlayerId !== localPlayerId) return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6);
    const newAbility = ABILITY_DIE_FACES[d2];
    
    // Update local immediately
    setDice([d1, 0]);
    setAbility(newAbility);
    setPendingAction({ type: 'move', pieceId: null, validMoves: [d1] });

    // Handle Shield Reset
    setPlayers(currentPlayers => {
        if (!currentPlayers) return null;
        const playersWithShield = currentPlayers.map(p => ({...p, hasShield: false }));
        if (newAbility === SpecialAbility.SHIELD) {
            const player = playersWithShield.find(p => p.id === currentPlayerId);
            if(player) player.hasShield = true;
        }
        
        broadcastState({
            dice: [d1, 0],
            ability: newAbility,
            pendingAction: { type: 'move', pieceId: null, validMoves: [d1] },
            players: playersWithShield
        });
        
        return playersWithShield;
    });

  }, [currentPlayerId, isMultiplayer, localPlayerId, broadcastState]);

  const cancelAbility = useCallback(() => {
    if (isMultiplayer && currentPlayerId !== localPlayerId) return;
    
    setAbility(null);
    if (dice) {
        setPendingAction({ type: 'move', pieceId: null, validMoves: [dice[0]] });
        broadcastState({
            ability: null,
            pendingAction: { type: 'move', pieceId: null, validMoves: [dice[0]] }
        });
    }
  }, [dice, isMultiplayer, localPlayerId, currentPlayerId, broadcastState]);

  const handlePieceClick = useCallback((piece: Piece) => {
    if (!players || !pendingAction) return;
    // Strict turn check for online
    if (isMultiplayer && currentPlayerId !== localPlayerId) return;
    
    // Must be active player's piece
    if (piece.playerId !== currentPlayerId) return;

    if (pendingAction.type === 'move' && dice) {
        if (piece.state === PieceState.START) {
             // Allow exit on 6 or 1
             if (dice[0] === 6 || dice[0] === 1) {
                 setPlayers(currentPlayers => {
                     if (!currentPlayers) return null;
                     const playersAfterMove = [...currentPlayers.map(p => ({...p, pieces: [...p.pieces.map(pc => ({...pc}))]}))];
                     const targetPiece = playersAfterMove.flatMap(p => p.pieces).find(p => p.id === piece.id)!;
                     const startPos = PLAYER_CONFIG[currentPlayerId].startPosition;
                     
                     const ownPiece = playersAfterMove.flatMap(p => p.pieces).find(p => p.position === startPos && p.playerId === currentPlayerId);
                     if (ownPiece) return currentPlayers; 

                     const enemyPiece = playersAfterMove.flatMap(p => p.pieces).find(p => p.position === startPos && p.playerId !== currentPlayerId);
                     if (enemyPiece) {
                         enemyPiece.position = -1;
                         enemyPiece.state = PieceState.START;
                     }

                     targetPiece.position = startPos;
                     targetPiece.state = PieceState.IN_PLAY;
                     
                     const updates: any = { players: playersAfterMove };

                     if (dice[0] === 6) {
                         updates.pendingAction = { type: 'roll' };
                         setPendingAction({ type: 'roll' });
                     } else {
                         // Will call nextTurn
                     }
                     
                     broadcastState(updates);
                     
                     if (dice[0] !== 6) {
                         nextTurn();
                     }
                     return playersAfterMove;
                 });
             } else {
                 return;
             }
        } else {
            movePiece(piece, dice[0]);
        }
    } else if (pendingAction.type === 'use_ability' && pendingAction.ability === SpecialAbility.SWORD && dice) {
       setPlayers(currentPlayers => {
           if(!currentPlayers) return null;
           const newPlayers = [...currentPlayers.map(p => ({...p, pieces: [...p.pieces.map(pc => ({...pc}))]}))];
           const targetPiece = newPlayers.flatMap(p => p.pieces).find(p => p.id === piece.id)!;
           targetPiece.position = (targetPiece.position - dice[0] + MAIN_CIRCUIT_SIZE) % MAIN_CIRCUIT_SIZE;
           
           broadcastState({ players: newPlayers });
           nextTurn();
           return newPlayers;
       });
    }
  }, [players, pendingAction, dice, movePiece, nextTurn, currentPlayerId, isMultiplayer, localPlayerId, broadcastState]);

  const useAbility = useCallback((abilityToUse: SpecialAbility) => {
    if (isMultiplayer && currentPlayerId !== localPlayerId) return;
    if (!dice) return;
    
    switch(abilityToUse) {
        case SpecialAbility.PLUS_ONE:
            setDice([dice[0] + 1, 0]);
            setAbility(null);
            setPendingAction({ type: 'move', pieceId: null, validMoves: [dice[0] + 1] });
            broadcastState({
                dice: [dice[0] + 1, 0],
                ability: null,
                pendingAction: { type: 'move', pieceId: null, validMoves: [dice[0] + 1] }
            });
            break;
        case SpecialAbility.BACK_FORTH:
            setPendingAction({ type: 'move', pieceId: null, validMoves: [dice[0], -dice[0]] });
            setAbility(null);
            broadcastState({
                ability: null,
                pendingAction: { type: 'move', pieceId: null, validMoves: [dice[0], -dice[0]] }
            });
            break;
        case SpecialAbility.GOLD_TOKEN:
            setPlayers(currentPlayers => {
                if(!currentPlayers) return null;
                const newPlayers = [...currentPlayers.map(p => ({...p, pieces: [...p.pieces.map(pc => ({...pc}))]}))];
                const player = newPlayers.find(p => p.id === currentPlayerId)!;
                const pieceFromStart = player.pieces.find(p => p.state === PieceState.START);
                
                if (pieceFromStart) {
                    const startPos = PLAYER_CONFIG[currentPlayerId].startPosition;
                    const enemy = newPlayers.flatMap(p=>p.pieces).find(p => p.position === startPos && p.playerId !== currentPlayerId);
                    if(enemy) { enemy.position = -1; enemy.state = PieceState.START; }
                    const self = newPlayers.flatMap(p=>p.pieces).find(p => p.position === startPos && p.playerId === currentPlayerId);
                    if(self) {
                        return currentPlayers; 
                    }

                    pieceFromStart.state = PieceState.IN_PLAY;
                    pieceFromStart.position = startPos;
                }
                
                // Broadcast players update
                broadcastState({ players: newPlayers, ability: null, pendingAction: { type: 'move', pieceId: null, validMoves: [dice[0]] } });
                
                return newPlayers;
            });
            setAbility(null);
            setPendingAction({ type: 'move', pieceId: null, validMoves: [dice[0]] });
            break;
        case SpecialAbility.SWORD:
            setPendingAction({type: 'use_ability', ability: SpecialAbility.SWORD });
            setAbility(null);
            broadcastState({
                pendingAction: {type: 'use_ability', ability: SpecialAbility.SWORD },
                ability: null
            });
            break;
        default:
            nextTurn();
    }
  }, [dice, currentPlayerId, nextTurn, isMultiplayer, localPlayerId, broadcastState]);

  const activateShield = useCallback((allow: boolean) => {
    if (pendingAction?.type !== 'shield_defense') return;
    // Only defender can activate
    if (isMultiplayer && pendingAction.defenderId !== localPlayerId) return;

    const { attackerId, defenderId, position } = pendingAction;
    
    setPlayers(currentPlayers => {
        if (!currentPlayers) return null;
        const newPlayers = [...currentPlayers.map(p => ({...p, pieces: [...p.pieces.map(pc => ({...pc}))]}))];
        const attacker = newPlayers.find(p => p.id === attackerId)!;
        const defender = newPlayers.find(p => p.id === defenderId)!;
        const attackingPiece = attacker.pieces.find(p => p.position === position)!;
        const defendingPiece = defender.pieces.find(p => p.position === position && p.id !== attackingPiece.id)!;
        
        defender.hasShield = false;
        if(allow){
            attackingPiece.position = (attackingPiece.position - (dice?.[0] || 0) + MAIN_CIRCUIT_SIZE) % MAIN_CIRCUIT_SIZE; 
        } else {
            defendingPiece.position = -1;
            defendingPiece.state = PieceState.START;
        }
        
        const updates: any = { players: newPlayers };
        
        if (dice && dice[0] === 6) {
            setPendingAction({ type: 'roll' });
            updates.pendingAction = { type: 'roll' };
        } else {
            // nextTurn will be called and broadcast
        }
        
        broadcastState(updates);
        
        if (!dice || dice[0] !== 6) {
             nextTurn();
        }

        return newPlayers;
    });
  }, [pendingAction, nextTurn, dice, isMultiplayer, localPlayerId, broadcastState]);

  const skipTurn = useCallback(() => {
    if (isMultiplayer && currentPlayerId !== localPlayerId) return;

    if (dice && dice[0] === 6) {
         setPendingAction({ type: 'roll' });
         broadcastState({ pendingAction: { type: 'roll' } });
    } else {
         nextTurn();
    }
  },[nextTurn, dice, isMultiplayer, localPlayerId, broadcastState]);
  
  // Check if current player has any valid moves
  const hasValidMoves = useMemo(() => {
      if (gameState !== GameState.PLAYING || !players || pendingAction?.type !== 'move' || currentPlayerId === undefined) return false;
      
      const player = players.find(p => p.id === currentPlayerId);
      if (!player) return false;
      
      const movesToCheck = pendingAction.validMoves || (dice ? [dice[0]] : []);
      if (movesToCheck.length === 0) return false;
      return player.pieces.some(p => movesToCheck.some(move => canMovePiece(p, move, players)));
  }, [gameState, players, currentPlayerId, pendingAction, canMovePiece, dice]);

  // AI LOGIC EFFECT
  useEffect(() => {
      if (gameState !== GameState.PLAYING || !players) return;
      
      // In Multiplayer, only Host runs AI? Or we disable AI for non-local?
      // If isMultiplayer, only run AI if it's a computer AND we are the host (or the one who owns the slot? simpler if host runs bots)
      if (isMultiplayer && localPlayerId !== 1) return;

      const currentPlayer = players.find(p => p.id === currentPlayerId);
      if (!currentPlayer || !currentPlayer.isComputer) return;

      let timeoutId: ReturnType<typeof setTimeout>;

      // Phase 1: Roll Dice
      if (pendingAction?.type === 'roll') {
          timeoutId = setTimeout(() => {
              rollDice();
          }, 1500);
      }
      // Phase 2: Decide Move or Ability
      else if (pendingAction?.type === 'move' && dice) {
          timeoutId = setTimeout(() => {
              const roll = dice[0];
              const myPieces = currentPlayer.pieces;
              const validPieces = myPieces.filter(p => canMovePiece(p, roll, players));

              // AI Logic for Gold Token
              if (ability === SpecialAbility.GOLD_TOKEN && myPieces.some(p => p.state === PieceState.START)) {
                  useAbility(SpecialAbility.GOLD_TOKEN);
                  return;
              }

              if (validPieces.length === 0) {
                  skipTurn();
                  return;
              }

              // Heuristics
              let chosenPiece: Piece | null = null;

              // 1. If any piece can capture
              if (!chosenPiece) {
                  chosenPiece = validPieces.find(p => {
                     if (p.state === PieceState.START) return false;
                     const dest = (p.position + roll) % MAIN_CIRCUIT_SIZE;
                     return players.some(pl => pl.id !== currentPlayerId && pl.pieces.some(enemy => enemy.position === dest));
                  }) || null;
              }

              // 2. If rolled 6 OR 1 and can exit start
              if (!chosenPiece && (roll === 6 || roll === 1)) {
                  chosenPiece = validPieces.find(p => p.state === PieceState.START) || null;
              }

              // 3. Move piece closest to home (but not yet in home if possible, to cycle)
              if (!chosenPiece) {
                   chosenPiece = validPieces[0];
              }

              if (chosenPiece) {
                  handlePieceClick(chosenPiece);
              } else {
                  skipTurn();
              }

          }, 1500);
      }
      // Phase 3: Defense
      else if (pendingAction?.type === 'shield_defense' && pendingAction.defenderId === currentPlayerId) {
           timeoutId = setTimeout(() => {
               activateShield(true);
           }, 1000);
      }
      
      return () => clearTimeout(timeoutId);
  }, [gameState, players, currentPlayerId, pendingAction, dice, rollDice, handlePieceClick, skipTurn, activateShield, canMovePiece, ability, useAbility, isMultiplayer, localPlayerId]);

  // Memoize actions to avoid excessive re-renders in consuming components
  const actions = useMemo(() => ({
      initializeGame,
      joinOnlineGame,
      rollDice,
      handlePieceClick,
      useAbility,
      cancelAbility,
      activateShield,
      resetGame,
      skipTurn,
      setGameState,
  }), [initializeGame, joinOnlineGame, rollDice, handlePieceClick, useAbility, cancelAbility, activateShield, resetGame, skipTurn, setGameState]);

  return {
    gameState,
    players,
    currentPlayerId,
    dice,
    ability,
    board,
    winners,
    pendingAction,
    hasValidMoves,
    gameId,
    localPlayerId,
    setLocalPlayerId,
    setGameId,
    actions,
  };
};
