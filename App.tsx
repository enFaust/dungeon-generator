
import React, { useState, useCallback, useEffect } from 'react';
import { generateDungeonLayout, rollRoomContents, generateLocalDungeonContent } from './services/dungeonGenerator';
import { generateDungeonDetails } from './services/geminiService';
import { generateParty, rollReaction, parseMonsters, rollDie } from './services/gameRules';
import { DungeonMap, GeneratedRoomContent, StockingType, DungeonLore, GeneratedTrapContent, Adventurer, Point, ActiveEncounter, EncounterState, RoomData } from './types';
import { MapViewer } from './components/MapViewer';
import { CharacterCard } from './components/CharacterCard';
import { EncounterModal } from './components/EncounterModal';
import { StartScreen } from './components/StartScreen';
import { GameMenu } from './components/GameMenu';
import jsPDF from 'jspdf';

const App: React.FC = () => {
    const [dungeon, setDungeon] = useState<DungeonMap | null>(null);
    const [roomContents, setRoomContents] = useState<GeneratedRoomContent[]>([]);
    const [trapContents, setTrapContents] = useState<GeneratedTrapContent[]>([]);
    const [lore, setLore] = useState<DungeonLore | null>(null);
    
    const [isGenerating, setIsGenerating] = useState(false); 
    const [gameStarted, setGameStarted] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // AI State
    const [useAI, setUseAI] = useState(false);

    // Game Logic State
    const [party, setParty] = useState<Adventurer[]>(generateParty());
    const [logs, setLogs] = useState<string[]>([]);
    const [viewingCharId, setViewingCharId] = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(undefined);
    const [discoveredTraps, setDiscoveredTraps] = useState<Set<string>>(new Set());
    const [lootedChests, setLootedChests] = useState<Set<number>>(new Set());
    const [stepsTaken, setStepsTaken] = useState(0);
    
    // Combat State
    const [activeEncounter, setActiveEncounter] = useState<ActiveEncounter | null>(null);

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 20));
    };

    const handleStartAdventure = async (config: { level: number; roomCount: number; useAI: boolean; theme: string; details: string }) => {
        setIsGenerating(true);
        setGameStarted(false);
        setUseAI(config.useAI);
        
        // Reset Game State
        setParty(generateParty()); // New party for new adventure
        setLogs([]);
        setDiscoveredTraps(new Set());
        setLootedChests(new Set());
        setActiveEncounter(null);
        setSelectedRoomId(undefined);
        setStepsTaken(0);

        try {
            // 1. Layout
            const newDungeon = generateDungeonLayout(config.roomCount);
            setDungeon(newDungeon);
            
            // 2. Content
            const preRolledTypes = newDungeon.rooms.map(() => rollRoomContents());
            let generatedLore: DungeonLore;
            let generatedRooms: GeneratedRoomContent[];
            let generatedTraps: GeneratedTrapContent[];

            if (config.useAI) {
                const result = await generateDungeonDetails(
                    config.level, 
                    config.theme, 
                    config.details, 
                    newDungeon.rooms, 
                    preRolledTypes, 
                    newDungeon.traps
                );
                generatedLore = result.lore;
                generatedRooms = result.rooms;
                generatedTraps = result.traps.map(t => ({...t, discovered: false}));
            } else {
                const result = generateLocalDungeonContent(config.level, newDungeon, preRolledTypes);
                generatedLore = result.lore;
                generatedRooms = result.rooms;
                generatedTraps = result.traps;
            }

            setLore(generatedLore);
            setRoomContents(generatedRooms);
            setTrapContents(generatedTraps);

            // 3. Place Party
            const entrance = newDungeon.rooms.find(r => r.id === 1);
            if (entrance) {
                const cx = Math.floor(entrance.x + entrance.w/2);
                const cy = Math.floor(entrance.y + entrance.h/2);
                setParty(prev => prev.map(p => ({...p, position: {x: cx, y: cy}})));
                setSelectedRoomId(1);
            }

            setGameStarted(true);
            addLog("Приключение начинается...");

        } catch (e) {
            console.error(e);
            alert("Ошибка при генерации подземелья. Если API ключ не задан, попробуйте режим 'Таблицы'.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExit = () => {
        setGameStarted(false);
        setShowMenu(false);
        setDungeon(null);
    };

    // --- DOWNLOADS ---
    const handleDownloadMD = () => {
        if (!dungeon || !lore) return;
        let content = `# ${lore.name}\n\n`;
        content += `> ${lore.backstory}\n\n`;
        content += `**Environment:** ${lore.environment}\n\n`;
        content += `## Rooms\n\n`;
        roomContents.forEach(r => {
            content += `### ${r.roomId}. ${r.title}\n`;
            content += `*${r.description}*\n\n`;
            if (r.monsters !== "Нет") content += `- **Monsters:** ${r.monsters}\n`;
            if (r.treasure !== "Нет") content += `- **Treasure:** ${r.treasure}\n`;
            content += `- **DM Notes:** ${r.dmNotes}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dungeon_${Date.now()}.md`;
        a.click();
    };

    const handleDownloadPDF = () => {
        if (!dungeon || !lore) return;
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text(lore.name, 10, 20);
        
        doc.setFontSize(12);
        doc.text(doc.splitTextToSize(lore.backstory, 180), 10, 30);
        
        let y = 60;
        doc.setFontSize(16);
        doc.text("Room Keys", 10, y);
        y += 10;

        doc.setFontSize(10);
        roomContents.forEach(r => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", 'bold');
            doc.text(`${r.roomId}. ${r.title}`, 10, y);
            y += 5;
            doc.setFont("helvetica", 'normal');
            const desc = doc.splitTextToSize(r.description, 170);
            doc.text(desc, 15, y);
            y += desc.length * 4 + 5;
        });

        doc.save('dungeon-map.pdf');
    };

    // --- GAME LOGIC ---

    const handleUpdateCharacter = (updatedChar: Adventurer) => {
        setParty(party.map(p => p.id === updatedChar.id ? updatedChar : p));
    };

    const handleEncounterEnd = () => {
        // Safe check to update dungeon status if we had a victory
        if (activeEncounter && dungeon) {
            if (activeEncounter.state === EncounterState.VICTORY) {
                if (activeEncounter.roomId > 0) {
                    const newRooms = dungeon.rooms.map(r => 
                        r.id === activeEncounter.roomId ? { ...r, monstersDefeated: true } : r
                    );
                    setDungeon({ ...dungeon, rooms: newRooms });
                    addLog(`Комната ${activeEncounter.roomId} зачищена.`);
                } else {
                    addLog(`Бродячие монстры побеждены.`);
                }
            } else if (activeEncounter.state === EncounterState.FLED) {
                addLog("Группа сбежала!");
            }
        }
        
        // UNCONDITIONALLY clear the encounter state to unlock movement
        setActiveEncounter(null);
        
        // Use setTimeout to allow React to unmount the modal before we force focus
        setTimeout(() => {
            // Force blur any active element (like buttons in the now-closed modal if they persisted)
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            // Bring focus back to the window/body to capture keydown events
            window.focus();
        }, 0);
    };

    const handlePartyMove = (target: Point) => {
        if (!dungeon || activeEncounter) return;

        let encounterTriggered = false;
        const leader = party[0];
        const trapKey = `${target.x},${target.y}`;
        const trap = dungeon.traps.find(t => `${t.x},${t.y}` === trapKey);
        
        if (trap && !discoveredTraps.has(trapKey)) {
            const trapInfo = trapContents.find(t => t.id === trapKey) || { name: "Скрытая Ловушка", description: "Щелчок!", mechanism: "1d6 урона" };
            addLog(`⚠️ ЛОВУШКА! ${leader.name} наступает на ${trapInfo.name}.`);
            setDiscoveredTraps(prev => new Set(prev).add(trapKey));
            return; 
        }

        const room = dungeon.rooms.find(r => 
            target.x >= r.x && target.x < r.x + r.w && 
            target.y >= r.y && target.y < r.y + r.h
        );
        
        if (room) {
            setSelectedRoomId(room.id);
            const content = roomContents.find(rc => rc.roomId === room.id);
            if (content && !room.monstersDefeated && (content.type === StockingType.MONSTER || content.type === StockingType.MONSTER_TREASURE)) {
                const wasInRoom = dungeon.rooms.find(r => 
                    leader.position.x >= r.x && leader.position.x < r.x + r.w && 
                    leader.position.y >= r.y && leader.position.y < r.y + r.h
                );

                if (wasInRoom?.id !== room.id) {
                    encounterTriggered = true;
                    const monsters = parseMonsters(content.monsters, 1); // Assuming level 1 for now, passed in Start
                    const reaction = rollReaction();
                    
                    setActiveEncounter({
                        roomId: room.id,
                        monsters: monsters,
                        state: EncounterState.REACTION,
                        reactionRoll: reaction.result,
                        round: 0,
                        chatHistory: [],
                        combatLog: []
                    });
                }
            }
        } else {
            setSelectedRoomId(undefined);
        }

        if (encounterTriggered) return;

        // Snake Movement
        const newParty = [...party];
        let prevPos = { ...newParty[0].position };
        newParty[0].position = target;
        for (let i = 1; i < newParty.length; i++) {
            const temp = { ...newParty[i].position };
            newParty[i].position = prevPos;
            prevPos = temp;
        }
        setParty(newParty);

        // Wandering Monster Check (INCREASED FREQUENCY)
        // Check every 3 steps, 50% chance (1-3 on d6)
        const newSteps = stepsTaken + 1;
        setStepsTaken(newSteps);

        if (newSteps % 3 === 0 && lore) {
            if (rollDie(6) <= 3) { // 50% chance every 3 steps (Very Frequent)
                const randomEncounter = lore.randomEncounters[rollDie(6) - 1];
                if (randomEncounter) {
                    const monsters = parseMonsters(randomEncounter.creature, 1);
                    const reaction = rollReaction();
                    
                    addLog("⚠️ СЛУЧАЙНАЯ ВСТРЕЧА! " + randomEncounter.creature);
                    
                    setActiveEncounter({
                        roomId: -1, // Wandering
                        monsters: monsters,
                        state: EncounterState.REACTION,
                        reactionRoll: reaction.result,
                        round: 0,
                        chatHistory: [],
                        combatLog: [`Вы натыкаетесь на бродячих монстров: ${randomEncounter.creature}`, `Ситуация: ${randomEncounter.situation}`]
                    });
                }
            }
        }
    };

    const handleChestLoot = (roomId: number) => {
        const room = dungeon?.rooms.find(r => r.id === roomId);
        const content = roomContents.find(r => r.roomId === roomId);
        
        if (content && (content.type === StockingType.MONSTER || content.type === StockingType.MONSTER_TREASURE)) {
             if (!room?.monstersDefeated) {
                 addLog("⛔ Нельзя открыть сундук, пока монстры рядом!");
                 return;
             }
        }

        setLootedChests(prev => new Set(prev).add(roomId));
        if (content) {
            addLog(`💰 Группа открывает сундук: ${content.treasure}`);
        }
    };

    const handleReorderParty = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= party.length) return;
        const newParty = [...party];
        const [moved] = newParty.splice(fromIndex, 1);
        newParty.splice(toIndex, 0, moved);
        setParty(newParty);
        addLog(`Порядок изменен: ${moved.name} теперь на позиции ${toIndex + 1}`);
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-black relative">
            
            {/* START SCREEN */}
            {!gameStarted && (
                <div className="absolute inset-0 z-50">
                    <StartScreen 
                        onStart={handleStartAdventure} 
                        isGenerating={isGenerating}
                    />
                </div>
            )}

            {/* GAME VIEW */}
            {gameStarted && dungeon && (
                <>
                    <div className="w-full h-full">
                        <MapViewer 
                            dungeon={dungeon} 
                            roomContents={roomContents}
                            trapContents={trapContents}
                            selectedRoomId={selectedRoomId}
                            onRoomSelect={setSelectedRoomId}
                            party={party}
                            onPartyMove={handlePartyMove}
                            onSelectCharacter={setViewingCharId}
                            logs={logs}
                            discoveredTraps={discoveredTraps}
                            lootedChests={lootedChests}
                            onLootChest={handleChestLoot}
                            readOnly={false}
                            onReorderParty={handleReorderParty}
                        />
                    </div>

                    {/* Menu Button */}
                    <button 
                        onClick={() => setShowMenu(true)}
                        className="absolute top-4 left-4 z-40 bg-[#2c241b] text-[#eaddcf] border-2 border-[#8b4513] px-3 py-2 rounded shadow-lg hover:bg-[#3e2b1f] flex items-center gap-2 font-bold uppercase text-xs"
                    >
                        📜 Меню / Журнал
                    </button>

                    {/* Floating Log for Game Events */}
                    <div className="absolute bottom-20 left-4 z-30 w-80 pointer-events-none">
                        <div className="flex flex-col-reverse gap-1">
                            {logs.slice(0, 5).map((log, i) => (
                                <div key={i} className="bg-black/70 text-white px-2 py-1 text-xs rounded border-l-2 border-blue-500 backdrop-blur-sm animate-in slide-in-from-left-2">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            
            {/* MODALS */}
            
            {/* Character Modal */}
            {viewingCharId && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto relative border-4 border-[#8b4513]">
                            <button 
                            onClick={() => setViewingCharId(null)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-red-600 z-10 text-2xl font-bold"
                        >
                            ✕
                        </button>
                        <CharacterCard 
                            char={party.find(p => p.id === viewingCharId)!}
                            onUpdate={handleUpdateCharacter}
                            onLog={addLog}
                            compact={true}
                        />
                    </div>
                </div>
            )}

            {/* Encounter Modal */}
            {activeEncounter && (
                <EncounterModal 
                    encounter={activeEncounter}
                    party={party}
                    updateEncounter={setActiveEncounter}
                    updateParty={setParty}
                    onClose={handleEncounterEnd}
                    useAI={useAI} 
                />
            )}

            {/* Game Menu Modal */}
            <GameMenu 
                isOpen={showMenu}
                onClose={() => setShowMenu(false)}
                lore={lore}
                onDownloadMD={handleDownloadMD}
                onDownloadPDF={handleDownloadPDF}
                onExit={handleExit}
            />
        </div>
    );
};

export default App;
