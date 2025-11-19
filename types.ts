
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

export interface RoomData {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    connections: number[]; // IDs of connected rooms
    isSecret?: boolean;
    isExit?: boolean;
    hasChest?: boolean; // Visual chest
    monstersDefeated?: boolean; // Track if room is cleared
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
    type: StockingType;
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
    discovered?: boolean;
}

export interface RandomEncounter {
    roll: number;
    creature: string;
    situation: string;
}

export interface DungeonLore {
    name: string;
    backstory: string;
    environment: string; 
    randomEncounters: RandomEncounter[];
}

export type MapStyle = 'classic' | 'blueprint';

// --- B/X Solo Play Types ---

export type ClassType = 'Fighter' | 'Cleric' | 'Magic-User' | 'Thief';

export interface AbilityScores {
    str: number;
    int: number;
    wis: number;
    dex: number;
    con: number;
    cha: number;
}

export interface SpellSlot {
    name: string;
    used: boolean;
}

export interface ThiefSkills {
    openLocks: number;
    findTraps: number;
    pickPockets: number;
    moveSilently: number;
    climbWalls: number;
    hideInShadows: number;
    hearNoise: number; 
}

export interface SavingThrows {
    poison: number;    
    wands: number;     
    paralysis: number; 
    breath: number;    
    spells: number;    
}

export interface Adventurer {
    id: string;
    name: string;
    class: ClassType;
    level: number;
    hp: number;
    maxHp: number;
    ac: number;
    abilities: AbilityScores;
    weapon: string;
    armor: string;
    xp: number;
    position: Point;
    isDead: boolean;
    spells?: SpellSlot[];
    thiefSkills?: ThiefSkills;
    saves: SavingThrows;
}

// --- COMBAT & INTERACTION ---

export interface Monster {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    ac: number;
    thac0: number; // To Hit AC 0 (Classic) or Attack Bonus
    damage: string; // e.g. "1d6"
    xpValue: number;
    isDead: boolean;
}

export enum EncounterState {
    REACTION = 'REACTION', // Initial 2d6 roll
    COMBAT = 'COMBAT',
    PARLEY = 'PARLEY', // Talking
    VICTORY = 'VICTORY',
    DEFEAT = 'DEFEAT',
    FLED = 'FLED'
}

export interface CombatLog {
    round: number;
    messages: string[];
}

export interface ActiveEncounter {
    roomId: number;
    monsters: Monster[];
    state: EncounterState;
    reactionRoll: number;
    round: number;
    initiative?: 'party' | 'monsters';
    chatHistory: {sender: 'user' | 'monster', text: string}[];
    combatLog: string[];
}
