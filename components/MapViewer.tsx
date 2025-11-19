
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { DungeonMap, TileType, GeneratedRoomContent, GeneratedTrapContent } from '../types';

interface MapViewerProps {
    dungeon: DungeonMap;
    roomContents: GeneratedRoomContent[];
    trapContents?: GeneratedTrapContent[];
    selectedRoomId?: number;
    onRoomSelect: (id: number) => void;
}

const CELL_SIZE = 24;

export const MapViewer: React.FC<MapViewerProps> = ({ dungeon, roomContents, trapContents = [], selectedRoomId, onRoomSelect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Zoom & Pan State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // UI State
    const [showLegend, setShowLegend] = useState(false);
    const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null);

    // Door Interaction State (Set of "x,y" strings)
    const [openedDoors, setOpenedDoors] = useState<Set<string>>(new Set());

    // Center map on initial load
    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            const mapWidth = dungeon.width * CELL_SIZE;
            const mapHeight = dungeon.height * CELL_SIZE;
            
            setPan({
                x: (clientWidth - mapWidth) / 2,
                y: (clientHeight - mapHeight) / 2
            });
            setScale(1);
        }
    }, [dungeon]);

    // Mouse Event Handlers for Pan
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setSelectedTrapId(null); // Close trap popup on map click
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

    // Wheel Zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const zoomIntensity = 0.001;
        const delta = -e.deltaY * zoomIntensity;
        const newScale = Math.min(Math.max(0.2, scale + delta), 5);
        
        setScale(newScale);
    };

    const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.2));
    const handleReset = () => {
        if (containerRef.current) {
             const { clientWidth, clientHeight } = containerRef.current;
             const mapWidth = dungeon.width * CELL_SIZE;
             const mapHeight = dungeon.height * CELL_SIZE;
             setPan({ x: (clientWidth - mapWidth) / 2, y: (clientHeight - mapHeight) / 2 });
             setScale(1);
        }
    };

    const toggleDoor = (x: number, y: number, isSecret: boolean = false) => {
        const key = `${x},${y}`;
        const newSet = new Set(openedDoors);
        
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
            
            if (isSecret) {
                const neighbors = [{x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1}];
                let foundRoomId = 0;
                
                for(const n of neighbors) {
                    if(n.x < 0 || n.y < 0 || n.x >= dungeon.width || n.y >= dungeon.height) continue;
                    
                    const r = dungeon.rooms.find(room => 
                        n.x >= room.x && n.x < room.x + room.w &&
                        n.y >= room.y && n.y < room.y + room.h
                    );
                    
                    if (r) {
                        foundRoomId = r.id;
                        break;
                    }
                }
                
                if (foundRoomId !== 0) {
                    onRoomSelect(foundRoomId);
                }
            }
        }
        setOpenedDoors(newSet);
    };

    const widthPx = dungeon.width * CELL_SIZE;
    const heightPx = dungeon.height * CELL_SIZE;

    // Define styles for Classic mode (only)
    const styles = {
        container: {
            backgroundColor: '#e8e4dd',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`
        },
        svgBg: '#fcfaf2',
        wallStroke: '#2b2b2b',
        wallWidth: '3',
        floorFill: '#ffffff',
        roomGridColor: '#e8e8e8',
        secretDoorStroke: '#2b2b2b',
        textFill: '#2b2b2b',
        selectFill: 'rgba(245, 158, 11, 0.2)',
        selectStroke: '#b45309',
        filter: 'url(#handDrawn)',
        hatchFill: 'url(#hatch)',
        trapColor: '#b91c1c'
    };

    const wallSegments = useMemo(() => {
        const segments: React.ReactElement[] = [];
        const grid = dungeon.grid;
        
        const isWalkable = (x: number, y: number) => {
            if (x < 0 || y < 0 || x >= dungeon.width || y >= dungeon.height) return false;
            const t = grid[y][x];
            return t === TileType.FLOOR || t === TileType.CORRIDOR || t === TileType.DOOR || t === TileType.SECRET_DOOR;
        };

        for (let y = 0; y < dungeon.height; y++) {
            for (let x = 0; x < dungeon.width; x++) {
                if (isWalkable(x, y)) {
                    if (!isWalkable(x, y - 1)) segments.push(<line key={`t-${x}-${y}`} x1={x*CELL_SIZE} y1={y*CELL_SIZE} x2={(x+1)*CELL_SIZE} y2={y*CELL_SIZE} />);
                    if (!isWalkable(x, y + 1)) segments.push(<line key={`b-${x}-${y}`} x1={x*CELL_SIZE} y1={(y+1)*CELL_SIZE} x2={(x+1)*CELL_SIZE} y2={(y+1)*CELL_SIZE} />);
                    if (!isWalkable(x - 1, y)) segments.push(<line key={`l-${x}-${y}`} x1={x*CELL_SIZE} y1={y*CELL_SIZE} x2={x*CELL_SIZE} y2={(y+1)*CELL_SIZE} />);
                    if (!isWalkable(x + 1, y)) segments.push(<line key={`r-${x}-${y}`} x1={(x+1)*CELL_SIZE} y1={y*CELL_SIZE} x2={(x+1)*CELL_SIZE} y2={(y+1)*CELL_SIZE} />);
                }
            }
        }
        return segments;
    }, [dungeon]);

    const renderStairs = (room: any) => {
        if (room.id !== 1 && !room.isExit) return null;
        const cx = (room.x + room.w / 2) * CELL_SIZE;
        const cy = (room.y + room.h / 2) * CELL_SIZE;
        const steps = [];
        const strokeColor = styles.textFill;
        const label = room.id === 1 ? "ВХОД" : "ВНИЗ";

        for(let i = -10; i <= 10; i += 4) {
            steps.push(
                <line key={`st-${i}`} x1={cx - 8} y1={cy + i} x2={cx + 8} y2={cy + i} stroke={strokeColor} strokeWidth="1" />
            );
        }

        return (
            <g>
                 <rect x={cx - 10} y={cy - 12} width={20} height={24} fill="none" stroke={strokeColor} strokeWidth="1" />
                 {steps}
                 <text x={cx} y={cy - 18} textAnchor="middle" fontSize="8" fill={strokeColor} fontFamily="serif">{label}</text>
            </g>
        );
    };

    const selectedRoomData = useMemo(() => {
        if (!selectedRoomId) return null;
        return roomContents.find(r => r.roomId === selectedRoomId);
    }, [selectedRoomId, roomContents]);

    const selectedTrapData = useMemo(() => {
        if (!selectedTrapId) return null;
        // Find AI description for this trap ID
        const content = trapContents.find(t => t.id === selectedTrapId);
        return content || { name: "Ловушка", description: "Типичная ловушка подземелья.", mechanism: "1d6 урона" };
    }, [selectedTrapId, trapContents]);

    return (
        <div className="relative w-full h-full overflow-hidden">
            <div 
                ref={containerRef}
                className="w-full h-full cursor-move"
                style={styles.container}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
            >
                <div 
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    <svg 
                        id="dungeon-map-svg"
                        width={widthPx + 100} 
                        height={heightPx + 100} 
                        viewBox={`-50 -50 ${widthPx + 100} ${heightPx + 100}`}
                        style={{ backgroundColor: styles.svgBg }}
                        className="shadow-2xl"
                    >
                        <defs>
                            <filter id="handDrawn">
                                <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" result="noise" />
                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                            </filter>
                            <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                <line x1="0" y1="0" x2="0" y2="10" stroke="#d4cdc1" strokeWidth="1" />
                            </pattern>
                            <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
                                <rect width={CELL_SIZE} height={CELL_SIZE} fill="none" stroke={styles.roomGridColor} strokeWidth="0.5" />
                            </pattern>
                            <linearGradient id="woodGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#8B4513" />
                                <stop offset="20%" stopColor="#A0522D" />
                                <stop offset="40%" stopColor="#8B4513" />
                                <stop offset="60%" stopColor="#6B350F" />
                                <stop offset="100%" stopColor="#8B4513" />
                            </linearGradient>
                        </defs>

                        <rect x="-50" y="-50" width={widthPx + 100} height={heightPx + 100} fill={styles.hatchFill} />

                        <g filter={styles.filter}>
                            {/* Floor */}
                            {dungeon.grid.map((row, y) => 
                                row.map((cell, x) => {
                                    if (cell !== TileType.WALL) {
                                        return (
                                            <rect 
                                                key={`f-${x}-${y}`}
                                                x={x * CELL_SIZE}
                                                y={y * CELL_SIZE}
                                                width={CELL_SIZE + 1}
                                                height={CELL_SIZE + 1}
                                                fill={styles.floorFill}
                                                shapeRendering="auto"
                                            />
                                        );
                                    }
                                    return null;
                                })
                            )}

                            {/* Room Grids */}
                            {dungeon.rooms.map(r => (
                                <rect 
                                    key={`rg-${r.id}`} 
                                    x={r.x * CELL_SIZE} 
                                    y={r.y * CELL_SIZE} 
                                    width={r.w * CELL_SIZE} 
                                    height={r.h * CELL_SIZE} 
                                    fill="url(#grid)" 
                                    pointerEvents="none"
                                />
                            ))}

                            {/* Traps */}
                            {dungeon.traps.map((t, i) => (
                                <g 
                                    key={`trap-${i}`} 
                                    transform={`translate(${t.x * CELL_SIZE + CELL_SIZE/2}, ${t.y * CELL_SIZE + CELL_SIZE/2})`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTrapId(`${t.x},${t.y}`);
                                    }}
                                    className="cursor-pointer hover:opacity-70"
                                >
                                    <rect x="-12" y="-12" width="24" height="24" fill="transparent" /> {/* Hit area */}
                                    <line x1="-6" y1="-6" x2="6" y2="6" stroke={styles.trapColor} strokeWidth="2" />
                                    <line x1="6" y1="-6" x2="-6" y2="6" stroke={styles.trapColor} strokeWidth="2" />
                                    <circle r="8" fill="none" stroke={styles.trapColor} strokeWidth="1" />
                                </g>
                            ))}

                            {/* Doors */}
                            {dungeon.grid.map((row, y) => 
                                row.map((cell, x) => {
                                     if (cell === TileType.DOOR) {
                                        const isOpen = openedDoors.has(`${x},${y}`);
                                        
                                        const isWalkable = (cx: number, cy: number) => {
                                            if(cx < 0 || cx >= dungeon.width) return false;
                                            const t = dungeon.grid[cy][cx];
                                            return t !== TileType.WALL;
                                        };
                                        const horizontalPath = isWalkable(x-1, y) && isWalkable(x+1, y);
                                        const verticalPath = isWalkable(x, y-1) && isWalkable(x, y+1);
                                        const isHorizontalDoor = verticalPath && !horizontalPath;
                                        
                                        return (
                                            <g 
                                                key={`d-${x}-${y}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleDoor(x, y);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <rect x={x*CELL_SIZE} y={y*CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="transparent" />
                                                <g transform={`translate(${x*CELL_SIZE}, ${y*CELL_SIZE})`}>
                                                    <g 
                                                        style={{
                                                            transformOrigin: isHorizontalDoor ? '0 0' : '0 0', 
                                                            transform: isOpen 
                                                                ? (isHorizontalDoor ? 'rotate(-90deg)' : 'rotate(90deg)') 
                                                                : 'rotate(0deg)',
                                                            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }}
                                                    >
                                                        {isHorizontalDoor ? (
                                                            <g>
                                                                <rect x="0" y="0" width={CELL_SIZE} height={6} 
                                                                    fill="url(#woodGradient)" 
                                                                    stroke={styles.wallStroke} strokeWidth="1" />
                                                                {!isOpen && <circle cx={CELL_SIZE - 6} cy={3} r={1.5} fill="gold" />}
                                                            </g>
                                                        ) : (
                                                            <g>
                                                                <rect x="0" y="0" width={6} height={CELL_SIZE} 
                                                                    fill="url(#woodGradient)" 
                                                                    stroke={styles.wallStroke} strokeWidth="1" />
                                                                 {!isOpen && <circle cx={3} cy={CELL_SIZE - 6} r={1.5} fill="gold" />}
                                                            </g>
                                                        )}
                                                    </g>
                                                </g>
                                            </g>
                                        );
                                     } else if (cell === TileType.SECRET_DOOR) {
                                         const isOpen = openedDoors.has(`${x},${y}`);
                                         return (
                                            <g 
                                                key={`sd-${x}-${y}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleDoor(x, y, true);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <rect x={x * CELL_SIZE} y={y * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={styles.floorFill} />
                                                <text 
                                                    x={x*CELL_SIZE + CELL_SIZE/2} 
                                                    y={y*CELL_SIZE + CELL_SIZE/2 + 5} 
                                                    textAnchor="middle" 
                                                    fill={styles.secretDoorStroke}
                                                    fontWeight="bold"
                                                    fontSize="16"
                                                    fontFamily="monospace"
                                                    style={{
                                                        opacity: isOpen ? 0 : 1,
                                                        transition: 'opacity 0.5s ease'
                                                    }}
                                                >S</text>
                                                <rect x={x * CELL_SIZE} y={y * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={styles.selectStroke} opacity={isOpen ? 0.3 : 0} style={{ transition: 'opacity 0.5s ease' }} />
                                            </g>
                                         );
                                     }
                                     return null;
                                })
                            )}

                            {/* Walls */}
                            <g stroke={styles.wallStroke} strokeWidth={styles.wallWidth} strokeLinecap="round">
                                {wallSegments}
                            </g>
                        </g>

                        {/* Room Labels */}
                        {dungeon.rooms.map((room) => {
                            const isSelected = room.id === selectedRoomId;
                            const centerX = (room.x + room.w / 2) * CELL_SIZE;
                            const centerY = (room.y + room.h / 2) * CELL_SIZE;
                            
                            return (
                                <g 
                                    key={`lbl-${room.id}`} 
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        onRoomSelect(room.id);
                                    }}
                                    className="cursor-pointer"
                                    style={{ transition: 'all 0.2s' }}
                                >
                                     <rect
                                        x={room.x * CELL_SIZE}
                                        y={room.y * CELL_SIZE}
                                        width={room.w * CELL_SIZE}
                                        height={room.h * CELL_SIZE}
                                        fill={isSelected ? styles.selectFill : "transparent"}
                                        className="hover:fill-white/10"
                                    />
                                    {renderStairs(room)}
                                    {room.id !== 1 && (
                                        <>
                                            <circle cx={centerX} cy={centerY} r={11} fill={isSelected ? styles.selectStroke : "#ffffff"} stroke="#2b2b2b" strokeWidth="2" />
                                            <text
                                                x={centerX} y={centerY} dy="1"
                                                textAnchor="middle" dominantBaseline="middle"
                                                fontFamily="serif"
                                                fontSize={14} fontWeight="bold"
                                                fill={isSelected ? "#ffffff" : styles.textFill}
                                                className="pointer-events-none select-none"
                                            >
                                                {room.id}
                                            </text>
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* UI Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button onClick={() => setShowLegend(!showLegend)} className="w-10 h-10 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 font-bold text-xl text-gray-700 flex items-center justify-center" title="Легенда">?</button>
                <div className="h-2"></div>
                <button onClick={handleZoomIn} className="w-10 h-10 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 font-bold text-xl text-gray-700 flex items-center justify-center" title="Приблизить">+</button>
                <button onClick={handleZoomOut} className="w-10 h-10 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 font-bold text-xl text-gray-700 flex items-center justify-center" title="Отдалить">-</button>
                <button onClick={handleReset} className="w-10 h-10 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center justify-center" title="Сброс">⟲</button>
            </div>

            {/* Legend Overlay */}
            {showLegend && (
                <div className="absolute top-4 right-16 bg-white/95 border border-gray-300 rounded shadow-xl p-4 w-64 z-20 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold text-gray-800 mb-3 border-b pb-1">Условные Обозначения</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 border border-gray-400 bg-white"></div>
                            <span>Пол / Комната</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="w-6 h-1 bg-black" style={{ backgroundColor: '#2b2b2b' }}></div>
                             <span>Стена</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <svg width="24" height="24" viewBox="0 0 24 24">
                                <rect x="0" y="0" width="6" height="24" fill="#8B4513" stroke="black" strokeWidth="1" />
                             </svg>
                             <span>Дверь (Клик)</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <svg width="24" height="24" viewBox="0 0 24 24">
                                <text x="12" y="18" textAnchor="middle" fontWeight="bold" fontSize="16" fontFamily="monospace">S</text>
                             </svg>
                             <span>Секретная дверь</span>
                        </div>
                         <div className="flex items-center gap-3">
                             <svg width="24" height="24" viewBox="0 0 24 24">
                                <line x1="4" y1="4" x2="20" y2="20" stroke={styles.trapColor} strokeWidth="2" />
                                <line x1="20" y1="4" x2="4" y2="20" stroke={styles.trapColor} strokeWidth="2" />
                                <circle cx="12" cy="12" r="8" fill="none" stroke={styles.trapColor} strokeWidth="1" />
                             </svg>
                             <span>Ловушка (Клик)</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <svg width="24" height="24" viewBox="0 0 24 24">
                                <rect x="2" y="2" width="20" height="20" fill="none" stroke="black" strokeWidth="1" />
                                <line x1="2" y1="6" x2="22" y2="6" stroke="black" strokeWidth="1"/>
                                <line x1="2" y1="10" x2="22" y2="10" stroke="black" strokeWidth="1"/>
                             </svg>
                             <span>Лестница</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Trap Info Overlay */}
            {selectedTrapData && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-red-50 border-2 border-red-700 shadow-2xl p-4 rounded z-30 animate-in zoom-in-95 duration-200">
                     <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-red-900 flex items-center gap-2">
                            <span>⚠️</span> {selectedTrapData.name}
                        </h3>
                        <button onClick={() => setSelectedTrapId(null)} className="text-red-400 hover:text-red-700">×</button>
                    </div>
                    <div className="text-sm text-gray-800 mb-3 italic">
                        {selectedTrapData.description}
                    </div>
                    <div className="bg-white p-2 rounded border border-red-100 text-xs text-gray-700">
                        <span className="font-bold text-red-700 block mb-1">Механизм:</span>
                        {selectedTrapData.mechanism}
                    </div>
                </div>
            )}

            {/* Room Info Overlay */}
            {selectedRoomData && (
                <div className="absolute bottom-4 left-4 w-80 bg-white/95 backdrop-blur-sm border-2 border-gray-300 shadow-xl p-4 rounded z-20 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">
                            {selectedRoomData.roomId === 1 ? "Вход" : `#${selectedRoomData.roomId} ${selectedRoomData.title}`}
                        </h3>
                        <button 
                            onClick={() => onRoomSelect(0)} 
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                        >×</button>
                    </div>
                    
                    <div className="text-xs font-bold text-blue-600 uppercase mb-2 border-b pb-1">
                        {selectedRoomData.type}
                    </div>
                    
                    <p className="text-sm text-gray-800 italic mb-3 leading-relaxed max-h-32 overflow-y-auto">
                        "{selectedRoomData.description}"
                    </p>

                    <div className="space-y-2 text-xs">
                         {(selectedRoomData.monsters !== "None" && selectedRoomData.monsters !== "Нет") && (
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-red-700 shrink-0">Опасность:</span>
                                <span className="text-gray-900">{selectedRoomData.monsters}</span>
                            </div>
                        )}
                        {(selectedRoomData.treasure !== "None" && selectedRoomData.treasure !== "Нет") && (
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-amber-600 shrink-0">Сокровища:</span>
                                <span className="text-gray-900">{selectedRoomData.treasure}</span>
                            </div>
                        )}
                         {selectedRoomData.dmNotes && (
                            <div className="flex gap-2 items-start pt-2 border-t border-gray-200 mt-2">
                                <span className="font-bold text-purple-700 shrink-0">DM:</span>
                                <span className="text-gray-600">{selectedRoomData.dmNotes}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
