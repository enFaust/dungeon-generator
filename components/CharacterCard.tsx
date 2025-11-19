
import React, { useState } from 'react';
import { Adventurer, ClassType } from '../types';
import { getAbilityMod, rollDie, generateAdventurer } from '../services/gameRules';

interface CharacterCardProps {
    char: Adventurer;
    onUpdate: (updatedChar: Adventurer) => void;
    onLog: (msg: string) => void;
    compact?: boolean; // For modal view
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ char, onUpdate, onLog, compact = false }) => {
    const [confirmDeath, setConfirmDeath] = useState(false);
    const [showReplacement, setShowReplacement] = useState(false);

    // --- ACTIONS ---

    const rollAttack = () => {
        if (char.isDead) return;
        const roll = rollDie(20);
        const strMod = getAbilityMod(char.abilities.str);
        const total = roll + strMod;
        const crit = roll === 20 ? " (КРИТ!)" : roll === 1 ? " (ПРОВАЛ!)" : "";
        onLog(`${char.name} атака: d20(${roll})${crit} + ${strMod} = ${total}`);
    };

    const rollDamage = () => {
        if (char.isDead) return;
        let die = 6;
        if (char.class === 'Fighter') die = 8;
        if (char.class === 'Thief' || char.class === 'Magic-User') die = 4;
        
        const dmg = rollDie(die);
        const strMod = getAbilityMod(char.abilities.str);
        const total = Math.max(1, dmg + strMod);
        onLog(`${char.name} урон: d${die}(${dmg}) + ${strMod} = ${total}`);
    };

    const updateHp = (delta: number) => {
        const newHp = Math.min(char.maxHp, Math.max(0, char.hp + delta));
        onUpdate({ ...char, hp: newHp });
    };

    const toggleSpell = (spellIndex: number) => {
        if (!char.spells) return;
        const newSpells = [...char.spells];
        const spell = newSpells[spellIndex];
        
        newSpells[spellIndex] = { ...spell, used: !spell.used };
        
        if (!spell.used) {
            onLog(`${char.name} колдует: ${spell.name}!`);
        } else {
            onLog(`${char.name} восстанавливает: ${spell.name}.`);
        }
        onUpdate({ ...char, spells: newSpells });
    };

    const handleTurnUndead = () => {
        if (char.isDead) return;
        const roll = rollDie(6) + rollDie(6);
        onLog(`${char.name} Изгнание Нежити: 2d6(${roll})`);
    };

    const rollThiefSkill = (skillName: string, chance: number, isD6: boolean = false) => {
        if (char.isDead) return;
        if (isD6) {
            const roll = rollDie(6);
            const success = roll <= chance;
            onLog(`${char.name} ${skillName}: ${roll} из 6 (${success ? "УСПЕХ" : "НЕУДАЧА"})`);
        } else {
            const roll = rollDie(100);
            const success = roll <= chance;
            onLog(`${char.name} ${skillName}: ${roll}% / ${chance}% (${success ? "УСПЕХ" : "НЕУДАЧА"})`);
        }
    };

    const rollSave = (saveName: string, target: number) => {
        if (char.isDead) return;
        const roll = rollDie(20);
        const success = roll >= target;
        onLog(`${char.name} Спасбросок (${saveName}): ${roll} (нужно ${target}) -> ${success ? "УСПЕХ!" : "ПРОВАЛ..."}`);
    };

    const killCharacter = () => {
        onLog(`☠️ ${char.name} погибает смертью храбрых.`);
        onUpdate({ ...char, hp: 0, isDead: true });
        setConfirmDeath(false);
    };

    const replaceCharacter = (newClass: ClassType) => {
        const newCharRaw = generateAdventurer(newClass);
        // IMPORTANT: We must preserve the original ID of the character slot
        const newChar = { ...newCharRaw, id: char.id };
        
        onLog(`Прибыло подкрепление: ${newChar.name} (${newClass})!`);
        onUpdate(newChar);
        setShowReplacement(false);
    };

    return (
        <div className={`border-2 rounded p-3 shadow-md relative transition-all ${char.isDead ? 'bg-gray-200 border-gray-400 opacity-90' : 'bg-white border-gray-800'} ${compact ? 'max-w-md mx-auto' : ''}`}>
            
            {/* DEATH OVERLAY / STATUS */}
            {char.isDead && (
                <div className="absolute top-2 right-2 z-10">
                    <span className="text-4xl grayscale opacity-50">☠️</span>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-2 mb-2">
                <div>
                    <div className={`font-bold text-lg uppercase ${char.isDead ? 'line-through text-gray-500' : ''}`}>{char.name}</div>
                    <div className="text-xs font-bold text-gray-600 uppercase">{char.class} Lvl {char.level}</div>
                </div>
                
                {!char.isDead ? (
                    <div className="text-right">
                        <div className={`font-bold text-xl border-2 px-2 rounded ${char.hp < char.maxHp / 3 ? 'bg-red-100 border-red-500 text-red-700 animate-pulse' : 'bg-gray-50 border-gray-800'}`}>
                            HP: {char.hp}/{char.maxHp}
                        </div>
                        <div className="flex gap-1 mt-1 justify-end">
                            <button onClick={() => updateHp(-1)} className="w-6 h-6 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded border border-red-300">-</button>
                            <button onClick={() => updateHp(1)} className="w-6 h-6 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-800 font-bold rounded border border-green-300">+</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-right mt-1">
                        <button 
                            onClick={() => setShowReplacement(true)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold uppercase shadow hover:bg-blue-700 animate-bounce"
                        >
                            Нанять Героя
                        </button>
                    </div>
                )}
            </div>

            {/* Stats */}
            {!char.isDead && (
                <>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2 bg-gray-50 p-2 rounded">
                        <div><div className="text-gray-400 text-[9px]">STR</div><b>{char.abilities.str}</b><span className="text-gray-500 text-[9px] ml-1">({getAbilityMod(char.abilities.str)})</span></div>
                        <div><div className="text-gray-400 text-[9px]">DEX</div><b>{char.abilities.dex}</b><span className="text-gray-500 text-[9px] ml-1">({getAbilityMod(char.abilities.dex)})</span></div>
                        <div><div className="text-gray-400 text-[9px]">CON</div><b>{char.abilities.con}</b><span className="text-gray-500 text-[9px] ml-1">({getAbilityMod(char.abilities.con)})</span></div>
                        <div><div className="text-gray-400 text-[9px]">INT</div><b>{char.abilities.int}</b></div>
                        <div><div className="text-gray-400 text-[9px]">WIS</div><b>{char.abilities.wis}</b></div>
                        <div><div className="text-gray-400 text-[9px]">CHA</div><b>{char.abilities.cha}</b></div>
                    </div>

                    <div className="flex justify-between items-center text-xs mb-2 px-1">
                        <span className="font-bold bg-gray-200 px-2 py-0.5 rounded">AC: {char.ac}</span>
                        <span className="italic text-gray-600">{char.weapon}</span>
                    </div>

                    {/* Actions Row 1: Combat */}
                    <div className="flex gap-2 mb-2">
                        <button onClick={rollAttack} className="flex-1 bg-gray-800 text-white py-1.5 px-2 text-xs font-bold uppercase rounded hover:bg-black transition-colors">⚔️ Атака</button>
                        <button onClick={rollDamage} className="flex-1 bg-white border border-gray-800 text-gray-800 py-1.5 px-2 text-xs font-bold uppercase rounded hover:bg-gray-100 transition-colors">🩸 Урон</button>
                    </div>

                    {/* Actions Row 2: Saving Throws */}
                    {char.saves && (
                         <div className="grid grid-cols-5 gap-1 mb-3">
                            <button onClick={() => rollSave("Яд/Смерть", char.saves.poison)} className="bg-green-50 border border-green-200 text-green-800 text-[10px] py-1 rounded hover:bg-green-100 flex flex-col items-center leading-tight" title="Спасбросок: Яд / Смертельная Магия">
                                <span>☠️</span>
                                <span className="font-bold">{char.saves.poison}</span>
                            </button>
                            <button onClick={() => rollSave("Жезлы", char.saves.wands)} className="bg-purple-50 border border-purple-200 text-purple-800 text-[10px] py-1 rounded hover:bg-purple-100 flex flex-col items-center leading-tight" title="Спасбросок: Магические жезлы">
                                <span>🪄</span>
                                <span className="font-bold">{char.saves.wands}</span>
                            </button>
                            <button onClick={() => rollSave("Паралич/Камень", char.saves.paralysis)} className="bg-gray-50 border border-gray-200 text-gray-800 text-[10px] py-1 rounded hover:bg-gray-100 flex flex-col items-center leading-tight" title="Спасбросок: Паралич / Окаменение">
                                <span>🗿</span>
                                <span className="font-bold">{char.saves.paralysis}</span>
                            </button>
                            <button onClick={() => rollSave("Дыхание", char.saves.breath)} className="bg-red-50 border border-red-200 text-red-800 text-[10px] py-1 rounded hover:bg-red-100 flex flex-col items-center leading-tight" title="Спасбросок: Дыхание Дракона">
                                <span>🔥</span>
                                <span className="font-bold">{char.saves.breath}</span>
                            </button>
                             <button onClick={() => rollSave("Заклинания", char.saves.spells)} className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] py-1 rounded hover:bg-blue-100 flex flex-col items-center leading-tight" title="Спасбросок: Посохи / Заклинания">
                                <span>⚡</span>
                                <span className="font-bold">{char.saves.spells}</span>
                            </button>
                        </div>
                    )}

                    {/* Spells (Cleric/MU) */}
                    {char.spells && char.spells.length > 0 && (
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-[10px] font-bold text-blue-800 uppercase mb-1 flex justify-between items-center">
                                <span>Магия</span>
                                {char.class === 'Cleric' && (
                                        <button onClick={handleTurnUndead} className="text-[9px] bg-white border border-blue-300 px-1 rounded hover:bg-blue-100">Turn Undead</button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {char.spells.map((spell, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => toggleSpell(idx)}
                                        className={`text-xs px-2 py-1 rounded border transition-all ${
                                            spell.used 
                                                ? "bg-gray-200 text-gray-500 line-through border-gray-300" 
                                                : "bg-white text-blue-900 font-bold border-blue-300 hover:bg-blue-100 shadow-sm"
                                        }`}
                                    >
                                        {spell.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Thief Skills */}
                    {char.thiefSkills && (
                        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-[10px] font-bold text-yellow-800 uppercase mb-1">Навыки Вора</div>
                            <div className="grid grid-cols-2 gap-1">
                                <button onClick={() => rollThiefSkill("Взлом", char.thiefSkills!.openLocks)} className="text-[10px] bg-white border border-yellow-300 px-1 py-1 rounded hover:bg-yellow-100 text-left">
                                    🔓 Взлом ({char.thiefSkills.openLocks}%)
                                </button>
                                <button onClick={() => rollThiefSkill("Ловушки", char.thiefSkills!.findTraps)} className="text-[10px] bg-white border border-yellow-300 px-1 py-1 rounded hover:bg-yellow-100 text-left">
                                    🕸 Ловушки ({char.thiefSkills.findTraps}%)
                                </button>
                                <button onClick={() => rollThiefSkill("Тихо", char.thiefSkills!.moveSilently)} className="text-[10px] bg-white border border-yellow-300 px-1 py-1 rounded hover:bg-yellow-100 text-left">
                                    🤫 Тишина ({char.thiefSkills.moveSilently}%)
                                </button>
                                <button onClick={() => rollThiefSkill("Скрыться", char.thiefSkills!.hideInShadows)} className="text-[10px] bg-white border border-yellow-300 px-1 py-1 rounded hover:bg-yellow-100 text-left">
                                    🌑 Тень ({char.thiefSkills.hideInShadows}%)
                                </button>
                                <button onClick={() => rollThiefSkill("Слух", char.thiefSkills!.hearNoise, true)} className="text-[10px] bg-white border border-yellow-300 px-1 py-1 rounded hover:bg-yellow-100 text-left col-span-2">
                                    👂 Слух (1-{char.thiefSkills.hearNoise} на d6)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Kill Button */}
                    <div className="mt-2 border-t pt-2 text-right">
                        {confirmDeath ? (
                            <div className="flex gap-2 justify-end items-center animate-in fade-in">
                                <span className="text-xs font-bold text-red-700">Точно мертв?</span>
                                <button onClick={killCharacter} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold">ДА</button>
                                <button onClick={() => setConfirmDeath(false)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Нет</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmDeath(true)} className="text-[10px] text-red-400 hover:text-red-600 underline">
                                Персонаж погиб
                            </button>
                        )}
                    </div>
                </>
            )}
            
            {/* Replacement Modal (Inline) */}
            {showReplacement && (
                    <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-4 rounded">
                    <h4 className="font-bold text-gray-900 mb-3 text-center">Кого встретила группа?</h4>
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <button onClick={() => replaceCharacter('Fighter')} className="p-2 bg-red-100 border border-red-300 rounded hover:bg-red-200 font-bold text-xs">Боец</button>
                        <button onClick={() => replaceCharacter('Cleric')} className="p-2 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 font-bold text-xs">Клирик</button>
                        <button onClick={() => replaceCharacter('Magic-User')} className="p-2 bg-purple-100 border border-purple-300 rounded hover:bg-purple-200 font-bold text-xs">Маг</button>
                        <button onClick={() => replaceCharacter('Thief')} className="p-2 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 font-bold text-xs">Вор</button>
                    </div>
                    <button onClick={() => setShowReplacement(false)} className="mt-3 text-xs text-gray-500 underline">Отмена</button>
                    </div>
            )}
        </div>
    );
};
