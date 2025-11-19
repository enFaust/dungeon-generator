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

// Reduced Room Sizes (AD&D 1e style often had smaller rooms in dense dungeons)
// Grid units * 2 + 1. 
// Min 1 -> 3x3 tiles (approx 15ft x 15ft)
// Max 3 -> 7x7 tiles (approx 35ft x 35ft)
const MIN_ROOM_SIZE = 1; 
const MAX_ROOM_SIZE = 3;

// Helper: Create a random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Get random item from array
function getRandom<T>(arr: T[]): T {
    return arr[randomInt(0, arr.length - 1)];
}

// AD&D 1e Random Stocking Table (Dungeon Masters Guide, Appendix A, Table V)
export function rollRoomContents(): StockingType {
    const roll = randomInt(1, 100);
    // 01-60: Empty (60%)
    if (roll <= 60) return StockingType.EMPTY;
    // 61-70: Monster (10%)
    if (roll <= 70) return StockingType.MONSTER;
    // 71-80: Monster & Treasure (10%)
    if (roll <= 80) return StockingType.MONSTER_TREASURE;
    // 81-85: Special (5%)
    if (roll <= 85) return StockingType.SPECIAL;
    // 86-90: Trick/Trap (5%)
    if (roll <= 90) return StockingType.TRAP;
    // 91-100: Treasure (10%)
    return StockingType.TREASURE;
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

        // Generate dimensions (odd numbers only for maze alignment)
        const w = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE) * 2 + 1;
        const h = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE) * 2 + 1;
        const x = randomInt(1, (MAP_WIDTH - w) / 2 - 1) * 2 + 1;
        const y = randomInt(1, (MAP_HEIGHT - h) / 2 - 1) * 2 + 1;

        let overlaps = false;
        for (const r of rooms) {
            // Add 1 padding to prevent rooms touching without corridors
            if (x < r.x + r.w + 2 && x + w + 2 > r.x &&
                y < r.y + r.h + 2 && y + h + 2 > r.y) {
                overlaps = true;
                break;
            }
        }

        if (x + w >= MAP_WIDTH - 1 || y + h >= MAP_HEIGHT - 1) overlaps = true;

        if (!overlaps) {
            const newRoom: RoomData = { id: rooms.length + 1, x, y, w, h, connections: [] };
            rooms.push(newRoom);
            
            // Carve room
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    grid[ry][rx] = TileType.FLOOR;
                }
            }
        }
    }

    // 3. Connect Rooms (Simple Chain + L-Corridors)
    for (let i = 0; i < rooms.length - 1; i++) {
        const r1 = rooms[i];
        const r2 = rooms[i+1];

        const c1 = { x: Math.floor(r1.x + r1.w / 2), y: Math.floor(r1.y + r1.h / 2) };
        const c2 = { x: Math.floor(r2.x + r2.w / 2), y: Math.floor(r2.y + r2.h / 2) };

        if (Math.random() < 0.5) {
            carveHCorridor(grid, c1.x, c2.x, c1.y);
            carveVCorridor(grid, c1.y, c2.y, c2.x);
        } else {
            carveVCorridor(grid, c1.y, c2.y, c1.x);
            carveHCorridor(grid, c1.x, c2.x, c2.y);
        }
        
        r1.connections.push(r2.id);
        r2.connections.push(r1.id);
    }

    // 4. Place Doors & Traps
    rooms.forEach(room => {
        // Doors at boundaries if touching floor
        for (let xx = room.x; xx < room.x + room.w; xx++) {
            if (grid[room.y - 1][xx] === TileType.FLOOR) placeDoor(grid, xx, room.y - 1);
            if (grid[room.y + room.h][xx] === TileType.FLOOR) placeDoor(grid, xx, room.y + room.h);
        }
        for (let yy = room.y; yy < room.y + room.h; yy++) {
            if (grid[yy][room.x - 1] === TileType.FLOOR) placeDoor(grid, room.x - 1, yy);
            if (grid[yy][room.x + room.w] === TileType.FLOOR) placeDoor(grid, room.x + room.w, yy);
        }
    });

    // Simple trap placement in corridors
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (grid[y][x] === TileType.FLOOR && Math.random() < 0.02) {
                const inRoom = rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
                if (!inRoom) {
                    traps.push({ x, y });
                }
            }
        }
    }

    if (rooms.length > 0) {
        rooms[0].isSecret = false;
        rooms[rooms.length - 1].isExit = true;
    }

    return {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        grid,
        rooms,
        traps
    };
}

function carveHCorridor(grid: TileType[][], x1: number, x2: number, y: number) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        if (grid[y][x] === TileType.WALL) grid[y][x] = TileType.FLOOR;
    }
}

function carveVCorridor(grid: TileType[][], y1: number, y2: number, x: number) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (grid[y][x] === TileType.WALL) grid[y][x] = TileType.FLOOR;
    }
}

function placeDoor(grid: TileType[][], x: number, y: number) {
    if (x <= 0 || x >= MAP_WIDTH - 1 || y <= 0 || y >= MAP_HEIGHT - 1) return;
    // Avoid placing doors on existing floor (corridor overlaps) unless necessary
    // Simplification: just place if not already floor? No, we need to overwrite floor for visual door
    // But corridors are floor. Doors are separate tile.
    if (Math.random() < 0.15) {
        grid[y][x] = Math.random() < 0.1 ? TileType.SECRET_DOOR : TileType.DOOR;
    } else {
        grid[y][x] = TileType.FLOOR; // Just open archway
    }
}

// Generate content without AI (using tables)
export function generateLocalDungeonContent(
    level: number,
    dungeon: DungeonMap,
    preRolledTypes: StockingType[]
): { rooms: GeneratedRoomContent[], lore: DungeonLore, traps: GeneratedTrapContent[] } {
    
    const lore: DungeonLore = {
        name: `Подземелье Уровня ${level}`,
        backstory: "Это место было покинуто много веков назад. Стены хранят следы древних битв и забытых ритуалов.",
        environment: "Холодный воздух, запах сырости и далекое капание воды раздаются в тишине.",
        randomEncounters: Array(6).fill(null).map((_, i) => ({
            roll: i + 1,
            creature: getRandom(MONSTER_TABLE).split(' (')[0],
            situation: "Блуждает в поисках добычи."
        }))
    };

    const rooms: GeneratedRoomContent[] = dungeon.rooms.map((room, i) => {
        const stocking = preRolledTypes[i];
        const adjective = getRandom(ROOM_ADJECTIVES);
        const noun = getRandom(ROOM_NOUNS);
        const smell = getRandom(ROOM_SMELLS);
        const sound = getRandom(ROOM_SOUNDS);
        const feature = getRandom(ROOM_FEATURES);
        
        let monsters = "Нет";
        let treasure = "Нет";
        let desc = `${adjective} ${noun}. В воздухе висит ${smell}. Слышен ${sound}. В углу заметны ${feature}.`;
        let dmNotes = "Обычная комната.";

        if (stocking === StockingType.MONSTER || stocking === StockingType.MONSTER_TREASURE) {
            monsters = getRandom(MONSTER_TABLE);
            room.monstersDefeated = false;
        }

        if (stocking === StockingType.TREASURE || stocking === StockingType.MONSTER_TREASURE) {
            treasure = getRandom(TREASURE_TABLE);
            room.hasChest = true;
        }

        if (stocking === StockingType.TRAP) {
             dmNotes = "Ловушка в центре комнаты.";
        }

        return {
            roomId: room.id,
            title: `${adjective} ${noun}`,
            type: stocking,
            monsters,
            treasure,
            description: desc,
            dmNotes
        };
    });

    const traps: GeneratedTrapContent[] = dungeon.traps.map(t => {
        const trapData = getRandom(TRAP_TABLE);
        return {
            id: `${t.x},${t.y}`,
            name: trapData.name,
            description: trapData.desc,
            mechanism: trapData.mech,
            discovered: false
        };
    });

    return { rooms, lore, traps };
}