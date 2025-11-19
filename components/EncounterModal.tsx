
import React, { useState, useEffect, useRef } from 'react';
import { ActiveEncounter, Adventurer, EncounterState, Monster } from '../types';
import { rollDie, resolveAttack, getAbilityMod, checkPersuasion } from '../services/gameRules';
import { chatWithMonster, getMonsterCombatBark } from '../services/geminiService';

interface EncounterModalProps {
    encounter: ActiveEncounter;
    party: Adventurer[];
    updateEncounter: (e: ActiveEncounter) => void;
    updateParty: (p: Adventurer[]) => void;
    onClose: () => void; // Called on Victory/Flee
    useAI: boolean;
}

type ActionMode = 'attack' | 'spells' | null;

export const EncounterModal: React.FC<EncounterModalProps> = ({ encounter, party, updateEncounter, updateParty, onClose, useAI }) => {
    const [input, setInput] = useState("");
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [activeCharId, setActiveCharId] = useState<string | null>(null);
    const [actionMode, setActionMode] = useState<ActionMode>(null);

    // Scroll log to bottom
    const logRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [encounter.combatLog]);

    // --- INITIAL SETUP & AUTO COMBAT ---
    useEffect(() => {
        if (encounter.state === EncounterState.REACTION && encounter.combatLog.length === 0) {
            const roll = encounter.reactionRoll;
            let msg = `Реакция: ${roll} (2d6). `;
            
            if (roll <= 5) {
                // HOSTILE: Start Combat Immediately with Initiative
                const partyRoll = rollDie(6);
                const enemyRoll = rollDie(6);
                const winner = partyRoll >= enemyRoll ? 'party' : 'monsters';
                
                msg += "Монстры атакуют немедленно!";
                
                updateEncounter({
                    ...encounter,
                    state: EncounterState.COMBAT,
                    initiative: winner,
                    round: 1,
                    combatLog: [msg, `--- РАУНД 1 ---`, `Инициатива: Герои ${partyRoll} vs Враги ${enemyRoll}.`]
                });
            } else {
                // PARLEY: Wait for player
                if (roll <= 8) {
                    msg += "Монстры насторожены. Можно говорить.";
                } else {
                    msg += "Монстры дружелюбны.";
                }
                
                updateEncounter({
                    ...encounter,
                    state: EncounterState.PARLEY,
                    combatLog: [msg]
                });
            }
        }
    }, []); // Run once on mount

    // --- MONSTER TURN AUTOMATION ---
    useEffect(() => {
        if (encounter.state === EncounterState.COMBAT && encounter.initiative === 'monsters') {
            const timer = setTimeout(() => {
                executeMonsterTurn();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [encounter.state, encounter.initiative, encounter.round]);

    // --- COMBAT LOGIC ---

    const startCombat = () => {
        const partyRoll = rollDie(6);
        const enemyRoll = rollDie(6);
        const winner = partyRoll >= enemyRoll ? 'party' : 'monsters';
        
        updateEncounter({
            ...encounter,
            state: EncounterState.COMBAT,
            initiative: winner,
            round: 1,
            combatLog: [...encounter.combatLog, `--- РАУНД 1 ---`, `Инициатива: Герои ${partyRoll} vs Враги ${enemyRoll}. Победа: ${winner === 'party' ? "ГЕРОИ" : "ВРАГИ"}`]
        });
    };

    const executeMonsterTurn = async () => {
        const livingParty = party.filter(p => !p.isDead);
        const livingMonsters = encounter.monsters.filter(m => !m.isDead);
        
        if (livingParty.length === 0) {
             updateEncounter({ ...encounter, state: EncounterState.DEFEAT, combatLog: [...encounter.combatLog, "ГЕРОИ ПАЛИ..."] });
             return;
        }
        if (livingMonsters.length === 0) {
             updateEncounter({ ...encounter, state: EncounterState.VICTORY, combatLog: [...encounter.combatLog, "ПОБЕДА!"] });
             return;
        }

        // AI BARK LOGIC
        let extraLog: string[] = [];
        if (useAI) {
            const leader = livingMonsters[0];
            setIsAiThinking(true);
            try {
                const bark = await getMonsterCombatBark(leader.name);
                extraLog.push(`🗣️ ${leader.name}: "${bark}"`);
            } catch(e) {}
            setIsAiThinking(false);
        }

        const logs: string[] = [...extraLog];
        const newParty = [...party];

        encounter.monsters.forEach(m => {
            if (m.isDead) return;
            // Pick random target
            const livingTargets = newParty.filter(p => !p.isDead);
            if (livingTargets.length === 0) return;

            const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
            if (!target) return;

            // Attack
            const result = resolveAttack(m.name, m.thac0, target.ac, m.damage);
            logs.push(result.msg);
            
            if (result.hit) {
                const pIndex = newParty.findIndex(p => p.id === target.id);
                if (pIndex !== -1) {
                    newParty[pIndex] = { ...newParty[pIndex], hp: Math.max(0, newParty[pIndex].hp - result.dmg) };
                    if (newParty[pIndex].hp === 0) {
                        newParty[pIndex].isDead = true;
                        logs.push(`☠️ ${target.name} падает замертво!`);
                    }
                }
            }
        });

        updateParty(newParty);
        
        // Check Defeat
        if (newParty.every(p => p.isDead)) {
             updateEncounter({
                ...encounter,
                state: EncounterState.DEFEAT,
                combatLog: [...encounter.combatLog, ...logs, "ВЕСЬ ОТРЯД ПОГИБ..."]
            });
            return;
        }

        // Next Round Setup
        const partyRoll = rollDie(6);
        const enemyRoll = rollDie(6);
        const nextWinner = partyRoll >= enemyRoll ? 'party' : 'monsters';

        updateEncounter({
            ...encounter,
            initiative: nextWinner,
            round: encounter.round + 1,
            combatLog: [...encounter.combatLog, ...logs, `--- РАУНД ${encounter.round + 1} ---`, `Инициатива: ${partyRoll} vs ${enemyRoll}. Ход: ${nextWinner === 'party' ? "ГЕРОИ" : "ВРАГИ"}`]
        });
    };

    const handlePlayerAttack = (attacker: Adventurer, targetId: string) => {
        if (encounter.initiative !== 'party') return;

        const targetIndex = encounter.monsters.findIndex(m => m.id === targetId);
        const target = encounter.monsters[targetIndex];
        
        const thac0 = 19; // Lvl 1 fighter roughly
        const strMod = getAbilityMod(attacker.abilities.str);
        const effThac0 = thac0 - strMod; 
        const dmgStr = attacker.class === 'Fighter' ? '1d8' : '1d6'; 
        
        const result = resolveAttack(attacker.name, effThac0, target.ac, dmgStr);
        
        const newMonsters = [...encounter.monsters];
        const logs = [result.msg];

        if (result.hit) {
            const totalDmg = Math.max(1, result.dmg + strMod);
            newMonsters[targetIndex] = { ...target, hp: target.hp - totalDmg };
            logs[0] = `${attacker.name} наносит ${totalDmg} урона по ${target.name}!`;

            if (newMonsters[targetIndex].hp <= 0) {
                newMonsters[targetIndex].isDead = true;
                logs.push(`💀 ${target.name} уничтожен!`);
            }
        }

        // Check if all monsters dead immediately
        if (newMonsters.every(m => m.isDead)) {
            updateEncounter({
                ...encounter,
                monsters: newMonsters,
                state: EncounterState.VICTORY,
                combatLog: [...encounter.combatLog, ...logs, "ПОБЕДА!"]
            });
            return;
        }

        updateEncounter({
            ...encounter,
            monsters: newMonsters,
            combatLog: [...encounter.combatLog, ...logs]
        });
        
        setActiveCharId(null);
        setActionMode(null);
    };

    const handleCastSpell = (spellIndex: number) => {
        const caster = party.find(p => p.id === activeCharId);
        if (!caster || !caster.spells) return;

        const spell = caster.spells[spellIndex];
        if (spell.used) return;

        // Mark spell as used
        const newSpells = [...caster.spells];
        newSpells[spellIndex] = { ...spell, used: true };
        const newParty = party.map(p => p.id === activeCharId ? { ...p, spells: newSpells } : p);
        updateParty(newParty);

        // Effect Logic
        let log = `${caster.name} колдует ${spell.name}!`;
        let dmg = 0;
        
        let newMonsters = [...encounter.monsters];
        let stateUpdate: Partial<ActiveEncounter> = {};

        if (spell.name === "Magic Missile") {
            dmg = rollDie(4) + 1;
            // Auto hit first living monster
            const targetIndex = newMonsters.findIndex(m => !m.isDead);
            if (targetIndex !== -1) {
                const m = newMonsters[targetIndex];
                newMonsters[targetIndex] = { ...m, hp: m.hp - dmg };
                log += ` Снаряд сжигает ${m.name} на ${dmg} урона.`;
                if (newMonsters[targetIndex].hp <= 0) {
                    newMonsters[targetIndex].isDead = true;
                    log += ` ${m.name} погибает.`;
                }
            }
        } else if (spell.name === "Sleep") {
            log += " Вспышка магического песка!";
            // Simplistic Sleep: Kill/KO 1 low level monster
            const targetIndex = newMonsters.findIndex(m => !m.isDead && m.hp < 5);
            if (targetIndex !== -1) {
                newMonsters[targetIndex] = { ...newMonsters[targetIndex], isDead: true };
                log += ` ${newMonsters[targetIndex].name} падает и засыпает (побежден).`;
            } else {
                log += " Но монстры слишком сильны.";
            }
        } else if (spell.name === "Cure Light Wounds") {
            const heal = rollDie(8);
            // Updates active caster in local scope (party is already updated via setParty above, but we need to be careful)
            // We already updated party spells. Now update HP.
            // Re-map newParty
            const healedParty = newParty.map(p => p.id === activeCharId ? { ...p, hp: Math.min(p.maxHp, p.hp + heal) } : p);
            updateParty(healedParty);
            log += ` Восстановлено ${heal} HP.`;
        } 

        if (newMonsters.every(m => m.isDead)) {
            stateUpdate.state = EncounterState.VICTORY;
            log += " ПОБЕДА!";
        }

        updateEncounter({
            ...encounter,
            ...stateUpdate,
            monsters: newMonsters,
            combatLog: [...encounter.combatLog, log]
        });

        setActiveCharId(null);
        setActionMode(null);
    };

    const handleFlee = () => {
        const roll = rollDie(6);
        if (roll <= 3) { 
             updateEncounter({
                ...encounter,
                state: EncounterState.FLED,
                combatLog: [...encounter.combatLog, "Группа успешно сбежала!"]
            });
            setTimeout(onClose, 1000);
        } else {
             updateEncounter({
                ...encounter,
                combatLog: [...encounter.combatLog, "Не удалось сбежать! Монстры перехватывают инициативу!"],
                initiative: 'monsters'
            });
        }
    };

    const endPlayerTurn = () => {
        setActiveCharId(null);
        setActionMode(null);
        updateEncounter({ ...encounter, initiative: 'monsters' });
    };

    // --- INTERACTION LOGIC ---

    const handleSendChat = async () => {
        if (!input.trim()) return;
        setIsAiThinking(true);
        const userMsg = input;
        setInput("");

        const newHistory = [...encounter.chatHistory, { sender: 'user' as const, text: userMsg }];
        updateEncounter({
            ...encounter,
            chatHistory: newHistory,
            combatLog: [...encounter.combatLog, `Вы: "${userMsg}"`]
        });

        const result = await chatWithMonster(encounter.monsters[0].name, userMsg, encounter.chatHistory);

        updateEncounter({
            ...encounter,
            state: result.isHostile ? EncounterState.COMBAT : EncounterState.PARLEY,
            chatHistory: [...newHistory, { sender: 'monster' as const, text: result.response }],
            combatLog: [...encounter.combatLog, `Монстр: "${result.response}"`, result.isHostile ? "Они АТАКУЮТ!" : "Они слушают..."]
        });
        setIsAiThinking(false);

        if (result.isHostile) {
            // Transition to combat
            setTimeout(startCombat, 1500);
        }
    };

    const handleManualPersuasion = () => {
        const check = checkPersuasion(party);
        if (check.success) {
             updateEncounter({
                ...encounter,
                state: EncounterState.VICTORY, // Pacified
                combatLog: [...encounter.combatLog, `${check.roller} убеждает монстров отступить! (Roll: ${check.roll} <= CHA ${check.cha})`]
            });
        } else {
             updateEncounter({
                ...encounter,
                state: EncounterState.COMBAT,
                combatLog: [...encounter.combatLog, `${check.roller} не смог договориться... (Roll: ${check.roll} > CHA ${check.cha})`, "К БОЮ!"]
            });
            // Small delay then start
            setTimeout(startCombat, 1000);
        }
    };

    // --- RENDER HELPERS ---

    const isCombat = encounter.state === EncounterState.COMBAT;
    const isParley = encounter.state === EncounterState.PARLEY || encounter.state === EncounterState.REACTION;
    const isVictory = encounter.state === EncounterState.VICTORY;
    const isDefeat = encounter.state === EncounterState.DEFEAT;
    const isPartyTurn = isCombat && encounter.initiative === 'party';

    const activeHero = party.find(p => p.id === activeCharId);

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#eaddcf] w-full max-w-6xl h-[700px] rounded-lg border-4 border-[#8b4513] shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Header */}
                <div className="bg-[#2c241b] text-white p-4 flex justify-between items-center border-b-4 border-[#8b4513]">
                    <h2 className="text-2xl font-bold uppercase tracking-widest">
                        {isCombat ? "⚔️ БИТВА" : isVictory ? "🏆 ПОБЕДА" : isDefeat ? "☠️ ПОРАЖЕНИЕ" : "💬 ВСТРЕЧА"}
                    </h2>
                    <div className="text-sm opacity-70">Раунд: {encounter.round}</div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    
                    {/* LEFT: BATTLEFIELD */}
                    <div className="flex-1 p-6 bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')] overflow-y-auto relative flex flex-col">
                        
                        {/* Monsters Area */}
                        <div className="flex-1 flex items-center justify-center p-4 border-b-2 border-[#8b4513]/30 mb-4 bg-red-900/5 rounded-lg">
                            <div className="flex flex-wrap justify-center gap-6">
                                {encounter.monsters.map(m => (
                                    <div 
                                        key={m.id}
                                        onClick={() => {
                                            if (isCombat && activeCharId) {
                                                handlePlayerAttack(party.find(p => p.id === activeCharId)!, m.id);
                                            }
                                        }}
                                        className={`
                                            relative w-40 h-56 border-4 rounded-xl flex flex-col items-center justify-between p-3 shadow-xl transition-all cursor-pointer bg-white
                                            ${m.isDead ? 'opacity-40 grayscale bg-gray-300 border-gray-500' : 'border-red-800 hover:scale-105 hover:shadow-2xl'}
                                            ${activeCharId && !m.isDead ? 'ring-4 ring-red-600 animate-pulse cursor-crosshair' : ''}
                                        `}
                                    >
                                        {!m.isDead && (
                                            <div className="w-full bg-gray-300 h-3 rounded-full overflow-hidden border border-gray-500 mb-2">
                                                <div className="bg-red-600 h-full transition-all duration-300" style={{width: `${(m.hp/m.maxHp)*100}%`}}></div>
                                            </div>
                                        )}
                                        <div className="text-6xl flex-1 flex items-center justify-center drop-shadow-md">
                                            {m.isDead ? "💀" : "👹"}
                                        </div>
                                        <div className="w-full text-center">
                                            <div className="text-sm font-bold leading-tight bg-red-50 border border-red-200 rounded py-1 px-2 line-clamp-2 h-10 flex items-center justify-center">
                                                {m.name}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono mt-1">AC: {m.ac}</div>
                                        </div>
                                        {m.isDead && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-900 font-black text-2xl -rotate-12 border-4 border-red-900 px-2 rounded opacity-80">DEAD</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Party Area */}
                        <div className="h-32 mt-auto">
                            <h3 className="text-[#5e2f0d] font-bold uppercase mb-2 text-center text-sm tracking-wider opacity-70">Герои</h3>
                            <div className="flex justify-center gap-4">
                                {party.map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => {
                                            if (!p.isDead && isPartyTurn) {
                                                setActiveCharId(activeCharId === p.id ? null : p.id);
                                                setActionMode(null);
                                            }
                                        }}
                                        className={`
                                            w-24 h-28 border-2 rounded-lg flex flex-col items-center justify-center p-2 shadow-md transition-all cursor-pointer bg-white
                                            ${p.isDead ? 'opacity-40 grayscale bg-gray-300' : 'border-blue-800 hover:bg-blue-50'}
                                            ${activeCharId === p.id ? 'ring-4 ring-blue-500 -translate-y-2 z-10 shadow-xl' : ''}
                                            ${!isPartyTurn && !p.isDead ? 'opacity-70 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        <div className="text-3xl mb-1">{p.class === 'Fighter' ? '⚔️' : p.class === 'Cleric' ? '⚕️' : p.class === 'Magic-User' ? '🔮' : '🗝️'}</div>
                                        <div className="text-xs font-bold text-center truncate w-full">{p.name}</div>
                                        <div className={`text-[10px] font-bold mt-1 px-2 rounded ${p.hp < p.maxHp/3 ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>{p.hp}/{p.maxHp} HP</div>
                                        {activeCharId === p.id && <div className="absolute -top-2 bg-blue-600 text-white text-[10px] px-2 rounded-full font-bold animate-bounce">ВАШ ХОД</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: LOG & CHAT */}
                    <div className="w-1/3 bg-white border-l-4 border-[#8b4513] flex flex-col">
                        <div ref={logRef} className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-[#f9f9f9]">
                            {encounter.combatLog.map((msg, i) => (
                                <div key={i} className={`border-b border-gray-200 pb-1 px-1
                                    ${msg.includes("ПОБЕДА") ? "text-green-700 font-bold text-lg bg-green-50 p-2 rounded border border-green-200 text-center" : ""}
                                    ${msg.includes("ПОРАЖЕНИЕ") ? "text-red-700 font-bold text-lg bg-red-50 p-2 rounded border border-red-200 text-center" : ""}
                                    ${msg.includes("🗣️") ? "text-purple-800 italic font-serif text-sm bg-purple-50 p-2 rounded" : ""}
                                    ${msg.includes("АТАКУЮТ") ? "text-red-600 font-bold" : ""}
                                `}>
                                    {msg}
                                </div>
                            ))}
                            {isAiThinking && (
                                <div className="flex items-center gap-2 text-gray-500 italic p-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    Монстр рычит...
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="p-4 bg-gray-100 border-t border-gray-300 shadow-inner min-h-[200px]">
                            {isParley && (
                                <div className="flex flex-col gap-3">
                                    {useAI ? (
                                        <div className="flex gap-2">
                                            <input 
                                                value={input} 
                                                onChange={e => setInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                                                placeholder="Говорите с монстром..."
                                                className="flex-1 p-3 rounded border border-gray-300 text-sm shadow-inner focus:outline-none focus:border-blue-500"
                                            />
                                            <button onClick={handleSendChat} disabled={isAiThinking} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded font-bold shadow">➤</button>
                                        </div>
                                    ) : (
                                        <button onClick={handleManualPersuasion} className="w-full bg-blue-600 text-white py-3 rounded font-bold text-sm hover:bg-blue-700 shadow">
                                            🎲 Убеждение (Харизма)
                                        </button>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={startCombat} className="flex-1 bg-red-600 text-white py-3 rounded font-bold text-sm hover:bg-red-700 shadow-md">
                                            ⚔️ АТАКА!
                                        </button>
                                        <button onClick={handleFlee} className="flex-1 bg-gray-500 text-white py-3 rounded font-bold text-sm hover:bg-gray-600 shadow-md">
                                            🏃 СБЕЖАТЬ (50%)
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isVictory && (
                                <button onClick={onClose} className="w-full bg-green-600 text-white py-4 rounded font-bold uppercase shadow-lg hover:bg-green-700 animate-bounce tracking-wide border-2 border-green-400">
                                    💰 Забрать сокровища
                                </button>
                            )}

                            {isDefeat && (
                                <button onClick={onClose} className="w-full bg-black text-red-500 py-4 rounded font-bold uppercase shadow-lg hover:bg-gray-900 tracking-wide border-2 border-red-600">
                                    ☠️ GAME OVER (Закрыть)
                                </button>
                            )}

                            {isCombat && encounter.initiative === 'monsters' && !isDefeat && (
                                <div className="text-center bg-red-50 border border-red-200 p-3 rounded text-red-700 font-bold animate-pulse flex items-center justify-center gap-2">
                                    <span>⚠️</span> ХОД ВРАГА... <span>⚠️</span>
                                </div>
                            )}

                            {isCombat && !encounter.initiative && (
                                 <div className="flex flex-col gap-2">
                                    <div className="text-center text-red-500 font-bold text-xs mb-2">Ошибка: Нет Инициативы</div>
                                    <button onClick={startCombat} className="w-full bg-yellow-600 text-white py-3 rounded font-bold uppercase">🎲 Бросить Инициативу</button>
                                 </div>
                            )}

                            {isPartyTurn && (
                                <div className="flex flex-col gap-2">
                                    {activeHero ? (
                                        <>
                                            <div className="flex justify-between items-center mb-1">
                                                 <div className="text-xs font-bold uppercase text-gray-500">Действия: <span className="text-black">{activeHero.name}</span></div>
                                                 <button onClick={() => { setActiveCharId(null); setActionMode(null); }} className="text-[10px] text-red-500 underline">Отмена</button>
                                            </div>
                                            
                                            {actionMode === null ? (
                                                <>
                                                    <button onClick={() => setActionMode('attack')} className="w-full py-3 bg-red-600 text-white font-bold rounded hover:bg-red-700 shadow flex items-center justify-center gap-2">
                                                        ⚔️ АТАКА
                                                    </button>
                                                    {activeHero.spells && activeHero.spells.length > 0 && (
                                                        <button onClick={() => setActionMode('spells')} className="w-full py-3 bg-purple-600 text-white font-bold rounded hover:bg-purple-700 shadow flex items-center justify-center gap-2">
                                                            ✨ МАГИЯ
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col gap-2 animate-in slide-in-from-right-4">
                                                    {actionMode === 'attack' && (
                                                        <>
                                                            <div className="text-xs text-center text-gray-500 italic mb-1">Выберите цель:</div>
                                                            {encounter.monsters.map(m => !m.isDead && (
                                                                <button key={m.id} onClick={() => handlePlayerAttack(activeHero, m.id)} className="w-full py-2 bg-white border border-red-300 text-red-900 font-bold rounded hover:bg-red-50 text-xs text-left px-3 flex justify-between">
                                                                    <span>{m.name}</span>
                                                                    <span className="text-gray-500 font-normal">AC: {m.ac}</span>
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                    {actionMode === 'spells' && activeHero.spells && (
                                                         <>
                                                            <div className="text-xs text-center text-gray-500 italic mb-1">Выберите заклинание:</div>
                                                            <div className="max-h-40 overflow-y-auto border rounded p-1 bg-white">
                                                                {activeHero.spells.map((spell, idx) => (
                                                                    <button key={idx} onClick={() => handleCastSpell(idx)} disabled={spell.used} className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-100 ${spell.used ? 'text-gray-400 bg-gray-50 line-through' : 'text-purple-900 hover:bg-purple-50'}`}>
                                                                        {spell.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                         </>
                                                    )}
                                                    <button onClick={() => setActionMode(null)} className="w-full py-1 bg-gray-200 text-gray-600 font-bold rounded hover:bg-gray-300 text-xs mt-2">◀ Назад</button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-center p-4 border-2 border-dashed border-gray-400 rounded mb-2 bg-white/50">
                                                <div className="text-sm font-bold text-gray-800 animate-pulse">ВАШ ХОД</div>
                                                <div className="text-xs text-gray-600">Выберите героя снизу</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={endPlayerTurn} className="flex-1 py-3 bg-[#8b4513] text-white font-bold rounded hover:bg-[#5e2f0d] shadow text-xs">ЗАКОНЧИТЬ ХОД</button>
                                                <button onClick={handleFlee} className="flex-1 py-3 bg-gray-600 text-white font-bold rounded hover:bg-gray-700 shadow text-xs">🏃 БЕЖАТЬ (50%)</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
