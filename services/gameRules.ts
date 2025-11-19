
import { Adventurer, ClassType, SpellSlot, ThiefSkills, SavingThrows, Monster } from '../types';

// Dice Helpers
export const rollDie = (sides: number): number => Math.floor(Math.random() * sides) + 1;
export const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) total += rollDie(sides);
    return total;
};

// B/X Character Generation (Existing)
const NAMES = {
    'Fighter': ['Borg', 'Hrothgar', 'Valeria', 'Crom', 'Kael', 'Brunhilda'],
    'Cleric': ['Brother Odo', 'Sister Agatha', 'Friar Tuck', 'Wilhelmina', 'Padre Tomas', 'Saint Vidicon'],
    'Magic-User': ['Azaroth', 'Morgana', 'Xylo', 'Elara', 'Gandorf', 'Merlinus'],
    'Thief': ['Shadow', 'Fingers', 'Silk', 'Garret', 'Loco', 'Rat']
};

const MU_SPELLS_LVL1 = [
    "Magic Missile", "Sleep", "Shield", "Charm Person", "Read Magic", "Floating Disc"
];

const SAVES_LVL1: Record<ClassType, SavingThrows> = {
    'Cleric': { poison: 11, wands: 12, paralysis: 14, breath: 16, spells: 15 },
    'Fighter': { poison: 12, wands: 13, paralysis: 14, breath: 15, spells: 16 },
    'Magic-User': { poison: 13, wands: 14, paralysis: 13, breath: 16, spells: 15 },
    'Thief': { poison: 13, wands: 14, paralysis: 13, breath: 16, spells: 15 }
};

const THIEF_SKILLS_LVL1: ThiefSkills = {
    openLocks: 15,
    findTraps: 10,
    pickPockets: 20,
    moveSilently: 20,
    climbWalls: 87,
    hideInShadows: 10,
    hearNoise: 2 
};

export const generateAbilityScores = () => ({
    str: rollDice(3, 6),
    int: rollDice(3, 6),
    wis: rollDice(3, 6),
    dex: rollDice(3, 6),
    con: rollDice(3, 6),
    cha: rollDice(3, 6),
});

export const getAbilityMod = (score: number): number => {
    if (score <= 3) return -3;
    if (score <= 5) return -2;
    if (score <= 8) return -1;
    if (score <= 12) return 0;
    if (score <= 15) return 1;
    if (score <= 17) return 2;
    return 3;
};

export const getBestStrMod = (party: Adventurer[]): { mod: number, name: string } => {
    let bestChar = party[0];
    let bestMod = -10;

    party.forEach(p => {
        if (p.isDead) return;
        const mod = getAbilityMod(p.abilities.str);
        if (mod > bestMod) {
            bestMod = mod;
            bestChar = p;
        }
    });

    return { mod: bestMod, name: bestChar.name };
};

export const generateAdventurer = (cls: ClassType): Adventurer => {
    const abilities = generateAbilityScores();
    let hd = 8;
    let weapon = "Sword";
    let armor = "Chain Mail";
    let acBase = 5; 

    let spells: SpellSlot[] = [];
    let thiefSkills: ThiefSkills | undefined = undefined;

    switch (cls) {
        case 'Fighter':
            hd = 8;
            weapon = "Long Sword & Shield";
            armor = "Chain Mail";
            acBase = 4; 
            break;
        case 'Cleric':
            hd = 6;
            weapon = "Mace & Shield";
            armor = "Leather Armor";
            acBase = 6; 
            spells.push({ name: "Cure Light Wounds", used: false }); 
            break;
        case 'Magic-User':
            hd = 4;
            weapon = "Dagger";
            armor = "Robes";
            acBase = 9;
            const randomSpell = MU_SPELLS_LVL1[Math.floor(Math.random() * MU_SPELLS_LVL1.length)];
            spells.push({ name: randomSpell, used: false });
            break;
        case 'Thief':
            hd = 4;
            weapon = "Short Sword";
            armor = "Leather Armor";
            acBase = 7;
            thiefSkills = { ...THIEF_SKILLS_LVL1 };
            break;
    }

    const conMod = getAbilityMod(abilities.con);
    const hp = Math.max(1, rollDie(hd) + conMod);
    const dexMod = getAbilityMod(abilities.dex);
    const ac = acBase - dexMod; 
    const saves = SAVES_LVL1[cls];

    return {
        id: Math.random().toString(36).substr(2, 9),
        name: NAMES[cls][Math.floor(Math.random() * NAMES[cls].length)],
        class: cls,
        level: 1,
        hp,
        maxHp: hp,
        ac,
        abilities,
        weapon,
        armor,
        xp: 0,
        isDead: false,
        spells: spells.length > 0 ? spells : undefined,
        thiefSkills,
        saves,
        position: { x: 0, y: 0 } 
    };
};

export const generateParty = (): Adventurer[] => {
    return [
        generateAdventurer('Fighter'),
        generateAdventurer('Cleric'),
        generateAdventurer('Thief'),
        generateAdventurer('Magic-User')
    ];
};

export const rollReaction = (): { result: number, description: string, color: string, isHostile: boolean } => {
    const roll = rollDice(2, 6);
    if (roll <= 5) return { result: roll, description: "Враждебность (Атака!)", color: "text-red-600", isHostile: true };
    if (roll <= 8) return { result: roll, description: "Неуверенность (Можно говорить)", color: "text-yellow-600", isHostile: false };
    return { result: roll, description: "Дружелюбие (Мир)", color: "text-green-600", isHostile: false };
};

// --- COMBAT & MONSTER PARSING ---

export const parseMonsters = (text: string, dungeonLevel: number): Monster[] => {
    // Try to find format like "Goblins (2d4)" or "Orc (1)"
    const regex = /([А-Яа-яA-Za-z\s-]+)\s*\((\d+d\d+|\d+)\)/;
    const match = text.match(regex);
    
    let count = 1;
    let name = "Монстр";

    if (match) {
        name = match[1].trim();
        const countStr = match[2];
        if (countStr.includes('d')) {
            const [num, sides] = countStr.split('d').map(Number);
            count = rollDice(num, sides);
        } else {
            count = parseInt(countStr, 10);
        }
    } else {
        // Fallback if no number found, try to infer or just spawn 1
        name = text.split(',')[0].split('(')[0].trim();
        if (name.length > 20) name = "Неизвестная Тварь";
    }

    const monsters: Monster[] = [];
    for (let i = 0; i < count; i++) {
        const hd = Math.max(1, dungeonLevel); // Simple scaling
        const hp = rollDice(hd, 8);
        
        monsters.push({
            id: `m-${Date.now()}-${i}`,
            name: `${name} ${i + 1}`,
            hp: hp,
            maxHp: hp,
            ac: 7 - Math.min(5, Math.floor(dungeonLevel / 2)), // AC gets lower (better) with level
            thac0: 19 - dungeonLevel,
            damage: "1d6",
            xpValue: hd * 10,
            isDead: false
        });
    }
    return monsters;
};

export const resolveAttack = (attackerName: string, thac0: number, targetAC: number, dmgStr: string): { hit: boolean, dmg: number, msg: string } => {
    const roll = rollDie(20);
    const targetNum = thac0 - targetAC;
    
    if (roll === 1) {
        return { hit: false, dmg: 0, msg: `${attackerName} промахивается (крит. провал).` };
    }
    
    if (roll === 20 || roll >= targetNum) {
        // Parse damage e.g. "1d6" or "1d6+1"
        // Simplified parsing
        const parts = dmgStr.toLowerCase().split('d');
        let dmg = 1;
        if (parts.length === 2) {
             const count = parseInt(parts[0]);
             const rest = parts[1].split('+');
             const sides = parseInt(rest[0]);
             const mod = rest.length > 1 ? parseInt(rest[1]) : 0;
             dmg = rollDice(count, sides) + mod;
        }
        return { hit: true, dmg: dmg, msg: `${attackerName} попадает (AC ${targetAC})! Урон: ${dmg}.` };
    }

    return { hit: false, dmg: 0, msg: `${attackerName} промахивается (AC ${targetAC}).` };
};

// Persuasion Check: Roll 3d6 UNDER Charisma
export const checkPersuasion = (party: Adventurer[]): { success: boolean, roller: string, roll: number, cha: number } => {
    let bestChar = party[0];
    let bestCha = -1;

    party.forEach(p => {
        if (!p.isDead && p.abilities.cha > bestCha) {
            bestCha = p.abilities.cha;
            bestChar = p;
        }
    });

    const roll = rollDice(3, 6);
    // B/X Reaction adjustment: -2 to -1 for low CHA, +1 to +2 for high CHA.
    // This is a raw skill check variant.
    const success = roll <= bestCha;
    
    return { success, roller: bestChar.name, roll, cha: bestCha };
};
