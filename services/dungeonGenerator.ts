
import { DungeonMap, RoomData, StockingType, TileType, Rect, Point, GeneratedRoomContent, DungeonLore, GeneratedTrapContent } from '../types';
import { 
    MONSTER_TABLE, 
    TREASURE_TABLE, 
    TRAP_TABLE, 
    ROOM_ADJECTIVES, 
    ROOM_NOUNS, 
    ROOM_SMELLS, 
    ROOM_SOUNDS, 
    ROOM_FEATURES 
} from './tables';

const MAP_WIDTH = 51; // Odd width for maze alignment
const MAP_HEIGHT = 51; // Odd height for maze alignment
const MIN_ROOM_SIZE = 5;
const MAX_ROOM_SIZE = 11;

// Helper: Create a random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Get random item from array
function getRandom<T>(arr: T[]): T {
    return arr[randomInt(0, arr.length - 1)];
}

// AD&D 1e Random Stocking Table
export function rollRoomContents(): StockingType {
    const roll = randomInt(1, 100);
    if (roll <= 60) return StockingType.EMPTY;
    if (roll <= 70) return StockingType.MONSTER;
    if (roll <= 75) return StockingType.MONSTER_TREASURE;
    if (roll <= 80) return StockingType.SPECIAL;
    if (roll <= 85) return StockingType.TRAP;
    if (roll <= 90) return StockingType.TREASURE;
    return StockingType.EMPTY;
}

function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function generateDungeonLayout(targetRooms: number): DungeonMap {
    // 1. Initialize Grid with Walls
    const grid: TileType[][] = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(TileType.WALL));
    const rooms: RoomData[] = [];
    const traps: Point[] = [];

    // 2. Room Placement
    const maxAttempts = 1000; 
    
    for (let i = 0; i < maxAttempts; i++) {
        if (rooms.length >= targetRooms) break;

        const w = randomInt(Math.floor(MIN_ROOM_SIZE/2), Math.floor(MAX_ROOM_SIZE/2)) * 2 + 1;
        const h = randomInt(Math.floor(MIN_ROOM_SIZE/2), Math.floor(MAX_ROOM_SIZE/2)) * 2 + 1;
        const x = randomInt(1, (MAP_WIDTH - w) / 2 - 1) * 2 + 1;
        const y = randomInt(1, (MAP_HEIGHT - h) / 2 - 1) * 2 + 1;

        let overlaps = false;
        for (const r of rooms) {
            if (x < r.x + r.w && x + w > r.x &&
                y < r.y + r.h && y + h > r.y) {
                overlaps = true;
                break;
            }
        }

        if (x + w >= MAP_WIDTH - 1 || y + h >= MAP_HEIGHT - 1) overlaps = true;

        if (!overlaps) {
            const newRoom: RoomData = { id: 0, x, y, w, h, connections: [] };
            rooms.push(newRoom);
            
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    grid[ry][rx] = TileType.FLOOR;
                }
            }
        }
    }

    // 3. Maze Generation
    const directions = [
        { x: 0, y: -2 },
        { x: 0, y: 2 },
        { x: -2, y: 0 },
        { x: 2, y: 0 } 
    ];

    const growMaze = (sx: number, sy: number) => {
        const stack: Point[] = [{ x: sx, y: sy }];
        grid[sy][sx] = TileType.CORRIDOR;

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const validDirs = [];

            for (const d of directions) {
                const nx = current.x + d.x;
                const ny = current.y + d.y;

                if (nx > 0 && nx < MAP_WIDTH - 1 && ny > 0 && ny < MAP_HEIGHT - 1) {
                    if (grid[ny][nx] === TileType.WALL) {
                        validDirs.push(d);
                    }
                }
            }

            if (validDirs.length > 0) {
                const dir = validDirs[randomInt(0, validDirs.length - 1)];
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                
                const mx = current.x + dir.x / 2;
                const my = current.y + dir.y / 2;
                
                grid[my][mx] = TileType.CORRIDOR;
                grid[ny][nx] = TileType.CORRIDOR;
                
                stack.push({ x: nx, y: ny });
            } else {
                stack.pop();
            }
        }
    };

    for (let y = 1; y < MAP_HEIGHT; y += 2) {
        for (let x = 1; x < MAP_WIDTH; x += 2) {
            if (grid[y][x] === TileType.WALL) {
                growMaze(x, y);
            }
        }
    }

    // 4. Connect Rooms
    interface Connector {
        x: number;
        y: number;
        roomA: RoomData;
    }

    const connectors: Connector[] = [];
    const getRoomAt = (x: number, y: number): RoomData | undefined => {
        return rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    };

    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (grid[y][x] === TileType.WALL) {
                const tLeft = grid[y][x-1];
                const tRight = grid[y][x+1];
                const tUp = grid[y-1][x];
                const tDown = grid[y+1][x];

                let roomA = null;
                let isConnectable = false;

                if (tLeft === TileType.FLOOR && (tRight === TileType.CORRIDOR || tRight === TileType.FLOOR)) {
                     roomA = getRoomAt(x-1, y);
                     isConnectable = true;
                } else if (tRight === TileType.FLOOR && (tLeft === TileType.CORRIDOR || tLeft === TileType.FLOOR)) {
                     roomA = getRoomAt(x+1, y);
                     isConnectable = true;
                } else if (tUp === TileType.FLOOR && (tDown === TileType.CORRIDOR || tDown === TileType.FLOOR)) {
                     roomA = getRoomAt(x, y-1);
                     isConnectable = true;
                } else if (tDown === TileType.FLOOR && (tUp === TileType.CORRIDOR || tUp === TileType.FLOOR)) {
                     roomA = getRoomAt(x, y+1);
                     isConnectable = true;
                }

                if (isConnectable && roomA) {
                    connectors.push({ x, y, roomA });
                }
            }
        }
    }

    // Sort rooms to ensure ID stability before logic that relies on order (optional but good)
    rooms.sort((a, b) => (a.y * MAP_WIDTH + a.x) - (b.y * MAP_WIDTH + b.x));
    rooms.forEach((r, i) => r.id = i + 1);

    // Track doors per room for secret room logic
    const roomDoors = new Map<number, Point[]>();
    rooms.forEach(r => roomDoors.set(r.id, []));

    rooms.forEach(room => {
        const myConnectors = connectors.filter(c => c.roomA === room);
        
        if (myConnectors.length > 0) {
            shuffle(myConnectors);
            
            // Open at least 1
            const main = myConnectors[0];
            grid[main.y][main.x] = TileType.DOOR;
            roomDoors.get(room.id)?.push({x: main.x, y: main.y});

            // Extra doors (loops)
            for (let i = 1; i < myConnectors.length; i++) {
                if (Math.random() < 0.05) { 
                    grid[myConnectors[i].y][myConnectors[i].x] = TileType.DOOR;
                    roomDoors.get(room.id)?.push({x: myConnectors[i].x, y: myConnectors[i].y});
                }
            }
        }
    });

    // 5. Prune Dead Ends (Corridors)
    for (let i = 0; i < 100; i++) {
        let changed = false;
        for (let y = 1; y < MAP_HEIGHT - 1; y++) {
            for (let x = 1; x < MAP_WIDTH - 1; x++) {
                if (grid[y][x] === TileType.CORRIDOR) {
                    let wallCount = 0;
                    if (grid[y-1][x] === TileType.WALL) wallCount++;
                    if (grid[y+1][x] === TileType.WALL) wallCount++;
                    if (grid[y][x-1] === TileType.WALL) wallCount++;
                    if (grid[y][x+1] === TileType.WALL) wallCount++;

                    if (wallCount >= 3) {
                        grid[y][x] = TileType.WALL;
                        changed = true;
                    }
                }
            }
        }
        if (!changed) break;
    }

    // 6. Secret Rooms Logic
    rooms.forEach(r => {
        if (r.id === 1) return;
        const doors = roomDoors.get(r.id) || [];
        if (doors.length === 1) {
            if (Math.random() < 0.15) { // 15% chance for dead ends to be secret
                r.isSecret = true;
                const d = doors[0];
                grid[d.y][d.x] = TileType.SECRET_DOOR;
            }
        }
    });

    // 7. Traps Generation
    // Place traps in corridors
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (grid[y][x] === TileType.CORRIDOR) {
                // 2% chance per corridor tile
                if (Math.random() < 0.02) {
                    traps.push({x, y});
                }
            }
        }
    }

    // Place traps in rooms (except entrance)
    rooms.forEach(r => {
        if (r.id === 1) return;
        // 10% chance the room itself has a trap (center)
        if (Math.random() < 0.10) {
            const cx = Math.floor(r.x + r.w / 2);
            const cy = Math.floor(r.y + r.h / 2);
            traps.push({x: cx, y: cy});
        }
    });

    // 8. Identify Exit Room (Furthest from Entrance)
    const entrance = rooms.find(r => r.id === 1);
    if (entrance) {
        let maxDist = 0;
        let exitRoom = null;
        
        rooms.forEach(r => {
            if (r.id === 1) return;
            const dx = r.x - entrance.x;
            const dy = r.y - entrance.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > maxDist) {
                maxDist = dist;
                exitRoom = r;
            }
        });

        if (exitRoom) {
            (exitRoom as RoomData).isExit = true;
        }
    }

    return { width: MAP_WIDTH, height: MAP_HEIGHT, grid, rooms, traps };
}

// --- LOCAL CONTENT GENERATION (NO AI) ---

export function generateLocalDungeonContent(
    level: number,
    dungeon: DungeonMap,
    preRolledTypes: StockingType[]
): { rooms: GeneratedRoomContent[], lore: DungeonLore, traps: GeneratedTrapContent[] } {

    // Generate Lore
    const lore: DungeonLore = {
        name: `${getRandom(ROOM_ADJECTIVES)} ${getRandom(ROOM_NOUNS)}`,
        backstory: "Это место было покинуто столетия назад. Местные жители обходят его стороной, рассказывая легенды о древнем зле и скрытых сокровищах.",
        environment: "Воздух здесь холодный и затхлый. Эхо шагов разносится далеко вперед. Освещения нет, только то, что вы принесли с собой.",
        randomEncounters: Array(6).fill(null).map((_, i) => ({
            roll: i + 1,
            creature: getRandom(MONSTER_TABLE),
            situation: "Бродят в поисках пищи или нарушителей."
        }))
    };

    // Generate Rooms
    const rooms: GeneratedRoomContent[] = dungeon.rooms.map((room, idx) => {
        const type = preRolledTypes[idx];
        const title = room.id === 1 ? "Вход в подземелье" : (room.isExit ? "Спуск на следующий уровень" : getRandom(ROOM_NOUNS));
        
        let desc = "";
        if (room.id === 1) desc += "Ступени ведут вниз, в темноту этого зала. ";
        
        desc += `Тут ${getRandom(ROOM_SMELLS)} и слышен ${getRandom(ROOM_SOUNDS)}. `;
        desc += `Вокруг ${getRandom(ROOM_FEATURES)}. `;

        let monsters = "Нет";
        let treasure = "Нет";
        let dmNotes = "Пусто.";

        if (type === StockingType.MONSTER || type === StockingType.MONSTER_TREASURE) {
            monsters = getRandom(MONSTER_TABLE);
            desc += "Вы чувствуете, что вы здесь не одни.";
            dmNotes = "Монстры настроены враждебно.";
        }
        if (type === StockingType.TREASURE || type === StockingType.MONSTER_TREASURE) {
            treasure = getRandom(TREASURE_TABLE);
            desc += "Что-то блестит в углу или среди мусора.";
        }
        if (type === StockingType.TRAP) {
            dmNotes = "В центре комнаты скрытая ловушка. " + getRandom(TRAP_TABLE).name;
        }
        if (type === StockingType.SPECIAL) {
            desc += "Атмосфера в комнате странно тяжелая.";
            dmNotes = "Магический эффект или головоломка.";
        }

        return {
            roomId: room.id,
            title: title,
            type: type,
            description: desc,
            monsters: monsters,
            treasure: treasure,
            dmNotes: dmNotes
        };
    });

    // Generate Traps
    const traps: GeneratedTrapContent[] = dungeon.traps.map(t => {
        const template = getRandom(TRAP_TABLE);
        return {
            id: `${t.x},${t.y}`,
            name: template.name,
            description: template.desc,
            mechanism: template.mech
        };
    });

    return { lore, rooms, traps };
}
