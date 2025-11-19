
export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export enum TileType {
    WALL = 0,
    FLOOR = 1,
    DOOR = 2,
    CORRIDOR = 3,
    SECRET_DOOR = 4
}

export interface RoomData extends Rect {
    id: number;
    connections: number[]; // IDs of connected rooms
    isSecret?: boolean;
    isExit?: boolean;
}

export interface DungeonMap {
    width: number;
    height: number;
    grid: TileType[][];
    rooms: RoomData[];
    traps: Point[];
}

export enum StockingType {
    EMPTY = 'Empty',
    MONSTER = 'Monster',
    MONSTER_TREASURE = 'Monster & Treasure',
    TREASURE = 'Treasure',
    TRAP = 'Trap',
    SPECIAL = 'Special'
}

export interface GeneratedRoomContent {
    roomId: number;
    title: string;
    type: StockingType; // The rolled result
    monsters: string;
    treasure: string;
    description: string;
    dmNotes: string;
}

export interface GeneratedTrapContent {
    id: string; // "x,y" coordinate key
    name: string;
    description: string;
    mechanism: string;
}

export interface RandomEncounter {
    roll: number;
    creature: string;
    situation: string;
}

export interface DungeonLore {
    name: string;
    backstory: string;
    environment: string; // smells, sounds, lighting
    randomEncounters: RandomEncounter[];
}

export interface DungeonState {
    map: DungeonMap | null;
    contents: GeneratedRoomContent[];
    traps: GeneratedTrapContent[];
    lore: DungeonLore | null;
    level: number;
    theme: string;
    isGenerating: boolean;
    statusMessage: string;
}

export type MapStyle = 'classic' | 'blueprint';
