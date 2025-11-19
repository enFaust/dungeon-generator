
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { DungeonMap, TileType, GeneratedRoomContent, GeneratedTrapContent, Adventurer, Point } from '../types';
import { rollReaction, getBestStrMod, rollDie } from '../services/gameRules';

interface MapViewerProps {
    dungeon: DungeonMap;
    roomContents: GeneratedRoomContent[];
    trapContents?: GeneratedTrapContent[];
    selectedRoomId?: number;
    onRoomSelect: (id: number) => void;
    party: Adventurer[];
    onPartyMove: (pos: Point) => void;
    onSelectCharacter: (charId: string) => void;
    logs: string[];
    discoveredTraps: Set<string>;
    lootedChests: Set<number>;
    onLootChest: (roomId: number) => void;
    readOnly?: boolean;
    onReorderParty: (from: number, to: number) => void;
}

const CELL_SIZE = 24;

const CLASS_ICONS: Record<string, string> = {
    'Fighter': '⚔️',
    'Cleric': '⚕️',
    'Magic-User': '🔮',
    'Thief': '🗝️'
};

const CLASS_COLORS: Record<string, string> = {
    'Fighter': '#b91c1c',
    'Cleric': '#f59e0b',
    'Magic-User': '#9333ea',
    'Thief': '#4b5563'
};

// RECURSIVE SHADOWCASTING
function calculateFOV(dungeon: DungeonMap, start: Point, radius: number, openedDoors: Set<string>): Set<string> {
    const visible = new Set<string>();
    visible.add(`${start.x},${start.y}`);

    function castLight(cx: number, cy: number, row: number, start_slope: number, end_slope: number, xx: number, xy: number, yx: number, yy: number) {
        if (start_slope < end_slope) return;
        let next_start_slope = start_slope;
        
        for (let i = row; i <= radius; i++) {
            let blocked = false;
            for (let dx = -i, dy = -i; dx <= 0; dx++) {
                const l_slope = (dx - 0.5) / (dy + 0.5);
                const r_slope = (dx + 0.5) / (dy - 0.5);
                
                if (start_slope < r_slope) continue;
                if (end_slope > l_slope) break;

                const sax = dx * xx + dy * xy;
                const say = dx * yx + dy * yy;
                
                if ((sax < 0 && Math.abs(sax) > i) || (say < 0 && Math.abs(say) > i)) continue;

                const mapX = cx + sax;
                const mapY = cy + say;

                if (mapX >= 0 && mapX < dungeon.width && mapY >= 0 && mapY < dungeon.height) {
                    const distanceSq = (mapX - cx) ** 2 + (mapY - cy) ** 2;
                    if (distanceSq <= radius ** 2) {
                         visible.add(`${mapX},${mapY}`);
                    }

                    const tile = dungeon.grid[mapY][mapX];
                    const key = `${mapX},${mapY}`;

                    const isClosedDoor = tile === TileType.DOOR && !openedDoors.has(key);
                    const isBlocking = tile === TileType.WALL || tile === TileType.SECRET_DOOR || isClosedDoor;

                    if (blocked) {
                        if (isBlocking) {
                            next_start_slope = r_slope;
                            continue;
                        } else {
                            blocked = false;
                            start_slope = next_start_slope;
                        }
                    } else if (isBlocking && i < radius) {
                        blocked = true;
                        next_start_slope = r_slope;
                        castLight(cx, cy, i + 1, start_slope, l_slope, xx, xy, yx, yy);
                    }
                }
            }
            if (blocked) break;
        }
    }

    const multipliers = [
        [1, 0, 0, -1, -1, 0, 0, 1],
        [0, 1, -1, 0, 0, -1, 1, 0],
        [0, 1, 1, 0, 0, -1, -1, 0],
        [1, 0, 0, 1, -1, 0, 0, -1]
    ];

    for (let i = 0; i < 8; i++) {
        castLight(start.x, start.y, 1, 1.0, 0.0, multipliers[0][i], multipliers[1][i], multipliers[2][i], multipliers[3][i]);
    }

    return visible;
}

export const MapViewer: React.FC<MapViewerProps> = ({ 
    dungeon, roomContents, trapContents = [], selectedRoomId, onRoomSelect,
    party, onPartyMove, onSelectCharacter, logs, discoveredTraps, lootedChests, onLootChest, readOnly = false, onReorderParty
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [scale, setScale] = useState(1.8); 
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const [explored, setExplored] = useState<Set<string>>(new Set());
    const [visible, setVisible] = useState<Set<string>>(new Set());

    const [openedDoors, setOpenedDoors] = useState<Set<string>>(new Set());
    const [doorAttempt, setDoorAttempt] = useState<{x: number, y: number, isSecret: boolean} | null>(null);

    const [showOrder, setShowOrder] = useState(true);

    const leader = party[0];

    useEffect(() => {
        if (readOnly) {
            const all = new Set<string>();
            for(let y=0; y<dungeon.height; y++) for(let x=0; x<dungeon.width; x++) all.add(`${x},${y}`);
            setVisible(all);
            setExplored(all);
            return;
        }

        const fov = calculateFOV(dungeon, leader.position, 8, openedDoors);
        setVisible(fov);
        setExplored(prev => {
            const next = new Set(prev);
            fov.forEach(k => next.add(k));
            return next;
        });
    }, [leader.position, dungeon, readOnly, openedDoors]);

    useEffect(() => {
        if (containerRef.current && !isDragging) {
            const { clientWidth, clientHeight } = containerRef.current;
            const targetX = leader.position.x * CELL_SIZE + CELL_SIZE / 2;
            const targetY = leader.position.y * CELL_SIZE + CELL_SIZE / 2;
            
            setPan({
                x: clientWidth / 2 - targetX * scale,
                y: clientHeight / 2 - targetY * scale
            });
        }
    }, [leader.position, scale, dungeon]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    const handleTileClick = (x: number, y: number) => {
        if (readOnly) return;
        
        const dist = Math.abs(x - leader.position.x) + Math.abs(y - leader.position.y);
        if (dist > 1) return;

        const tile = dungeon.grid[y][x];
        const doorKey = `${x},${y}`;
        
        const isClosedDoor = (tile === TileType.DOOR || tile === TileType.SECRET_DOOR) && !openedDoors.has(doorKey);

        if (isClosedDoor) {
            setDoorAttempt({ x, y, isSecret: tile === TileType.SECRET_DOOR });
        } else {
            onPartyMove({ x, y });
        }
    };

    const handleChestClick = (roomId: number) => {
        if (readOnly) return;
        onLootChest(roomId);
        onRoomSelect(roomId);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (readOnly || doorAttempt) return;
            let dx = 0; let dy = 0;
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': dy = -1; break;
                case 'ArrowDown': case 's': case 'S': dy = 1; break;
                case 'ArrowLeft': case 'a': case 'A': dx = -1; break;
                case 'ArrowRight': case 'd': case 'D': dx = 1; break;
                default: return;
            }
            
            const nx = leader.position.x + dx;
            const ny = leader.position.y + dy;

            if (nx >= 0 && nx < dungeon.width && ny >= 0 && ny < dungeon.height) {
                const tile = dungeon.grid[ny][nx];
                if (tile !== TileType.WALL) {
                    handleTileClick(nx, ny);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [leader.position, readOnly, doorAttempt, dungeon, openedDoors]);

    const attemptOpenDoor = () => {
        if (!doorAttempt) return;
        const { mod } = getBestStrMod(party);
        const roll = rollDie(6);
        const chance = 2 + mod;
        if (roll <= chance) {
            const key = `${doorAttempt.x},${doorAttempt.y}`;
            const newSet = new Set(openedDoors);
            newSet.add(key);
            setOpenedDoors(newSet);
            setDoorAttempt(null);
        } else {
             setDoorAttempt(null);
        }
    };

    const widthPx = dungeon.width * CELL_SIZE;
    const heightPx = dungeon.height * CELL_SIZE;

    return (
        <div className="relative w-full h-full overflow-hidden font-sans bg-black">
            
            {/* MARCHING ORDER UI */}
            {!readOnly && (
                <div className={`absolute top-20 left-4 z-30 transition-transform duration-300 ${showOrder ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="bg-white/90 backdrop-blur border-2 border-[#8b4513] p-2 rounded shadow-lg w-48">
                        <div className="flex justify-between items-center mb-2 border-b border-gray-300 pb-1">
                            <h3 className="text-xs font-bold uppercase text-[#5e2f0d]">Строй Отряда</h3>
                            <button onClick={() => setShowOrder(false)} className="text-xs text-gray-500">◀</button>
                        </div>
                        <div className="space-y-2">
                            {party.map((p, i) => (
                                <div key={p.id} className={`flex items-center gap-2 p-1 rounded border ${i === 0 ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                    <span className="text-[10px] font-bold w-3">{i+1}.</span>
                                    <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs" style={{borderColor: CLASS_COLORS[p.class], color: CLASS_COLORS[p.class], background: 'white'}}>
                                        {CLASS_ICONS[p.class]}
                                    </div>
                                    <span className="text-xs truncate w-16">{p.name}</span>
                                    <div className="flex flex-col ml-auto">
                                        {i > 0 && <button onClick={() => onReorderParty(i, i-1)} className="text-[8px] hover:text-blue-600">▲</button>}
                                        {i < party.length - 1 && <button onClick={() => onReorderParty(i, i+1)} className="text-[8px] hover:text-blue-600">▼</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowOrder(!showOrder)}
                        className={`absolute -right-6 top-0 bg-white border border-[#8b4513] rounded-r w-6 h-8 flex items-center justify-center text-xs shadow-md ${!showOrder ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    >
                        👥
                    </button>
                </div>
            )}
            {!showOrder && !readOnly && (
                <button 
                    onClick={() => setShowOrder(true)}
                    className="absolute top-20 left-0 z-30 bg-white border border-[#8b4513] rounded-r px-2 py-1 shadow-md text-xs"
                >
                    👥 Строй
                </button>
            )}

            <div 
                ref={containerRef}
                className={`w-full h-full ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={(e) => {
                    const delta = -e.deltaY * 0.001;
                    setScale(s => Math.min(Math.max(0.5, s + delta), 4));
                }}
            >
                <div 
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    <svg 
                        width={widthPx} 
                        height={heightPx} 
                        viewBox={`0 0 ${widthPx} ${heightPx}`}
                        style={{ backgroundColor: '#000000' }}
                    >
                        <defs>
                            {/* --- TEXTURE PATTERNS --- */}
                            <pattern id="floorPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                                <rect width="24" height="24" fill="#dcdcdc" />
                                <path d="M0 0h24v24h-24z" fill="none" stroke="#c0c0c0" strokeWidth="1" opacity="0.5" />
                                <rect x="2" y="2" width="9" height="9" fill="#e6e6e6" />
                                <rect x="13" y="13" width="9" height="9" fill="#e6e6e6" />
                                <rect x="13" y="2" width="9" height="9" fill="#d4d4d4" />
                                <rect x="2" y="13" width="9" height="9" fill="#d4d4d4" />
                            </pattern>

                            <pattern id="wallPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                                <rect width="24" height="24" fill="#404040" />
                                <path d="M0 12h24" stroke="#222" strokeWidth="2" />
                                <path d="M12 0v12" stroke="#222" strokeWidth="2" />
                                <path d="M6 12v12" stroke="#222" strokeWidth="2" />
                                <path d="M18 12v12" stroke="#222" strokeWidth="2" />
                            </pattern>

                             <pattern id="doorPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                                <rect width="24" height="24" fill="#8B4513" />
                                <path d="M4 0v24 M8 0v24 M12 0v24 M16 0v24 M20 0v24" stroke="#5e2f0d" strokeWidth="1" />
                                <circle cx="20" cy="12" r="2" fill="#ccaa00" />
                            </pattern>

                            {/* Fog of War / Memory Filter */}
                            <filter id="dimFilter">
                                <feComponentTransfer>
                                    <feFuncR type="linear" slope="0.3" />
                                    <feFuncG type="linear" slope="0.3" />
                                    <feFuncB type="linear" slope="0.3" />
                                </feComponentTransfer>
                            </filter>

                             <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="1"/>
                                <feOffset dx="1" dy="1" result="offsetblur"/>
                                <feMerge> 
                                  <feMergeNode/>
                                  <feMergeNode in="SourceGraphic"/> 
                                </feMerge>
                            </filter>
                        </defs>

                        {/* RENDER TILES */}
                        {dungeon.grid.map((row, y) => 
                            row.map((cell, x) => {
                                const key = `${x},${y}`;
                                const isVisible = visible.has(key);
                                const isExplored = explored.has(key);

                                if (!isExplored && !readOnly) return null; 

                                const isDimmed = !isVisible && !readOnly;
                                const filter = isDimmed ? "url(#dimFilter)" : "none";

                                if (cell === TileType.WALL) {
                                    return <rect key={key} x={x*CELL_SIZE} y={y*CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="url(#wallPattern)" filter={filter} stroke="#111" strokeWidth="0.5" />;
                                }

                                if (cell === TileType.FLOOR || cell === TileType.CORRIDOR) {
                                    return (
                                        <g key={key}>
                                            <rect 
                                                x={x*CELL_SIZE} y={y*CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} 
                                                fill="url(#floorPattern)"
                                                filter={filter}
                                                onClick={(e) => { e.stopPropagation(); handleTileClick(x, y); }}
                                            />
                                        </g>
                                    );
                                }

                                if (cell === TileType.DOOR || cell === TileType.SECRET_DOOR) {
                                    const isOpen = openedDoors.has(key);
                                    
                                    if (cell === TileType.SECRET_DOOR && !isOpen) {
                                        // Secret door looks like a wall if closed
                                        return <rect key={key} x={x*CELL_SIZE} y={y*CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="url(#wallPattern)" filter={filter} />;
                                    }

                                    // Door Render
                                    return (
                                        <g key={key} onClick={(e) => { e.stopPropagation(); handleTileClick(x, y); }}>
                                            <rect x={x*CELL_SIZE} y={y*CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="url(#floorPattern)" filter={filter} />
                                            {!isOpen && (
                                                <rect 
                                                    x={x*CELL_SIZE + 2} 
                                                    y={y*CELL_SIZE + 2} 
                                                    width={CELL_SIZE - 4} 
                                                    height={CELL_SIZE - 4} 
                                                    fill="url(#doorPattern)" 
                                                    stroke="#3e1f08"
                                                    strokeWidth="1"
                                                    filter={filter}
                                                />
                                            )}
                                            {isOpen && (
                                                <path d={`M${x*CELL_SIZE},${y*CELL_SIZE} L${x*CELL_SIZE+CELL_SIZE},${y*CELL_SIZE}`} stroke="#5e2f0d" strokeWidth="4" opacity={0.5} />
                                            )}
                                        </g>
                                    );
                                }
                                return null;
                            })
                        )}

                        {/* RENDER OBJECTS (Chests, Stairs) */}
                        {dungeon.rooms.map(r => {
                            const cx = Math.floor(r.x + r.w/2);
                            const cy = Math.floor(r.y + r.h/2);
                            const centerKey = `${cx},${cy}`;
                            
                            // Need the specific tile to be visible/explored to see contents
                            const isVisible = visible.has(centerKey);
                            const isExplored = explored.has(centerKey);
                            
                            if (!isExplored) return null; 

                            const opacity = isVisible ? 1 : 0.3; 

                            return (
                                <g key={`room-obj-${r.id}`} style={{ opacity }}>
                                    {/* Stairs */}
                                    {(r.id === 1 || r.isExit) && (
                                        <text 
                                            x={cx * CELL_SIZE + CELL_SIZE/2} 
                                            y={cy * CELL_SIZE + CELL_SIZE - 4} 
                                            textAnchor="middle" 
                                            fontSize="16"
                                            fill={isVisible ? "white" : "gray"}
                                            stroke="black"
                                            strokeWidth="0.5"
                                        >
                                            {r.id === 1 ? "🔼" : "🔽"}
                                        </text>
                                    )}
                                    
                                    {/* Chest */}
                                    {r.hasChest && (
                                        <g 
                                            onClick={(e) => { e.stopPropagation(); handleChestClick(r.id); }}
                                            className="cursor-pointer"
                                        >
                                            <text 
                                                x={cx * CELL_SIZE + CELL_SIZE/2} 
                                                y={cy * CELL_SIZE + CELL_SIZE/2 + 6} 
                                                textAnchor="middle" 
                                                fontSize="18"
                                                filter="url(#dropShadow)"
                                            >
                                                {lootedChests.has(r.id) ? "📦" : "🎁"}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}

                        {/* RENDER TRAPS (If discovered) */}
                        {dungeon.traps.map((t, i) => {
                            const key = `${t.x},${t.y}`;
                            if (!discoveredTraps.has(key)) return null; 
                            if (!visible.has(key)) return null; 

                            return (
                                <g key={`trap-${i}`} transform={`translate(${t.x * CELL_SIZE}, ${t.y * CELL_SIZE})`}>
                                    <line x1="2" y1="2" x2="22" y2="22" stroke="red" strokeWidth="2" />
                                    <line x1="22" y1="2" x2="2" y2="22" stroke="red" strokeWidth="2" />
                                </g>
                            );
                        })}

                        {/* RENDER PARTY TOKENS */}
                        {[...party].reverse().map((p, i) => {
                            if (!visible.has(`${p.position.x},${p.position.y}`) && !readOnly) return null;

                            const realIndex = party.indexOf(p);
                            const isLeader = realIndex === 0;
                            
                            return (
                                <g 
                                    key={p.id} 
                                    transform={`translate(${p.position.x * CELL_SIZE}, ${p.position.y * CELL_SIZE})`}
                                    className="transition-all duration-200"
                                    onClick={(e) => { e.stopPropagation(); onSelectCharacter(p.id); }}
                                >
                                    <circle 
                                        cx={CELL_SIZE/2} 
                                        cy={CELL_SIZE/2} 
                                        r={CELL_SIZE/2 - 2} 
                                        fill="white" 
                                        stroke={CLASS_COLORS[p.class]} 
                                        strokeWidth={isLeader ? 3 : 1} 
                                        filter="url(#dropShadow)"
                                    />
                                    <text 
                                        x={CELL_SIZE/2} 
                                        y={CELL_SIZE/2 + 4} 
                                        textAnchor="middle" 
                                        fontSize="14"
                                        pointerEvents="none"
                                    >
                                        {CLASS_ICONS[p.class]}
                                    </text>
                                    {isLeader && (
                                        <circle cx={CELL_SIZE-4} cy={4} r={3} fill="#ef4444" />
                                    )}
                                </g>
                            );
                        })}

                    </svg>
                </div>
            </div>

            {/* Door Modal */}
            {doorAttempt && !readOnly && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 bg-[#eaddcf] border-4 border-[#8b4513] shadow-2xl p-4 rounded-lg z-50 text-center">
                    <h3 className="font-bold text-[#5e2f0d] mb-2">{doorAttempt.isSecret ? "Тайный проход" : "Дверь"}</h3>
                    <p className="text-xs mb-4">Попытаться открыть силой?</p>
                    <div className="flex gap-2">
                        <button onClick={attemptOpenDoor} className="flex-1 bg-[#8b4513] text-white py-1 rounded text-xs">Да (d6)</button>
                        <button onClick={() => setDoorAttempt(null)} className="flex-1 border border-[#8b4513] py-1 rounded text-xs">Нет</button>
                    </div>
                 </div>
            )}

            {/* Room Info Overlay */}
            {selectedRoomId && !readOnly && (
                <div className="absolute top-16 right-4 w-80 bg-white/95 border-2 border-gray-300 shadow-xl p-4 rounded z-20 max-h-[70vh] overflow-y-auto animate-in slide-in-from-right-4">
                    {(() => {
                        const r = roomContents.find(rc => rc.roomId === selectedRoomId);
                        if (!r) return null;
                        const roomObj = dungeon.rooms.find(ro => ro.id === selectedRoomId);
                        const showLoot = !roomObj?.hasChest || lootedChests.has(selectedRoomId);

                        return (
                            <>
                                <div className="flex justify-between border-b pb-2 mb-2 border-gray-200">
                                    <h3 className="font-bold text-[#5e2f0d]">{r.title}</h3>
                                    <button onClick={() => onRoomSelect(0)} className="text-gray-400 hover:text-red-500">✕</button>
                                </div>
                                <p className="text-sm italic text-gray-700 mb-3 leading-relaxed">{r.description}</p>
                                
                                {r.monsters !== "Нет" && <div className="text-xs text-white bg-red-700 font-bold p-1 rounded mb-2 text-center uppercase tracking-wider">⚠ {r.monsters}</div>}
                                
                                {roomObj?.hasChest && !showLoot && (
                                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 text-center rounded shadow-inner">
                                        <p className="text-sm font-bold text-yellow-800 mb-1">Закрытый сундук</p>
                                        <button 
                                            onClick={() => onLootChest(selectedRoomId)}
                                            className="bg-yellow-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-yellow-700 transition-colors"
                                        >
                                            Открыть
                                        </button>
                                    </div>
                                )}

                                {showLoot && r.treasure !== "Нет" && (
                                    <div className="text-xs text-amber-800 font-bold mt-2 bg-amber-50 p-2 rounded border border-amber-100">💰 {r.treasure}</div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
