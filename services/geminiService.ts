
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedRoomContent, RoomData, StockingType, DungeonLore, Point, GeneratedTrapContent } from '../types';

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDungeonDetails = async (
    level: number,
    theme: string,
    userDescription: string,
    rooms: RoomData[],
    preRolledTypes: StockingType[],
    traps: Point[]
): Promise<{ rooms: GeneratedRoomContent[], lore: DungeonLore, traps: GeneratedTrapContent[] }> => {

    // Helper to check if a room has a physical trap
    const checkTrap = (r: RoomData) => {
        return traps.some(t => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);
    };

    const roomBriefs = rooms.map((r, idx) => ({
        id: r.id,
        isEntrance: r.id === 1, 
        isExit: !!r.isExit,
        isSecret: !!r.isSecret,
        hasPhysicalTrap: checkTrap(r),
        stockingType: preRolledTypes[idx]
    }));

    const trapBriefs = traps.map(t => {
        const inRoom = rooms.find(r => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);
        return {
            id: `${t.x},${t.y}`,
            location: inRoom ? `Inside Room ${inRoom.id}` : "Corridor"
        };
    });

    const prompt = `
    You are a cruel but fair Old School Renaissance (OSR) Dungeon Master.
    
    Task: Create a complete dungeon module for a Level ${level} party.
    Language: Russian (Русский).
    Theme: ${theme}.
    Additional Context/Description: ${userDescription || "None provided. Use the theme."}
    
    Design Philosophy:
    1. **Combat as War, not Sport:** Monsters should be unfair, tricky, or puzzle-like.
    2. **Trickery & Survival:** Strange environmental hazards and weird architecture.
    3. **Ecology:** Coherent ecosystem.
    
    Instructions for specific fields:
    - **rooms**: detailed descriptions for each room.
    - **traps**: Create unique, deadly, and creative traps for each ID. 
      - **CRITICAL**: Do NOT repeat the same trap type.
      - Use a mix of:
        - **Mechanical**: Pits, falling blocks, darts, scything blades.
        - **Magical**: Runes, illusions, teleportation, elemental blasts.
        - **Biological**: Slimes, molds, spores, snakes, mimic-objects.
      - 'name': Creative name (e.g. "Acid Mist", "Phantom Floor").
      - 'description': subtle sensory clues players notice (smell, sound, visual oddity) BEFORE triggering.
      - 'mechanism': precise trigger condition and specific effect (damage dice, save type).
    
    Input Data:
    Rooms: ${JSON.stringify(roomBriefs)}
    Traps Locations: ${JSON.stringify(trapBriefs)}
    `;

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lore: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                backstory: { type: Type.STRING },
                                environment: { type: Type.STRING },
                                randomEncounters: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            roll: { type: Type.INTEGER },
                                            creature: { type: Type.STRING },
                                            situation: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        },
                        rooms: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    roomId: { type: Type.INTEGER },
                                    title: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    monsters: { type: Type.STRING },
                                    treasure: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    dmNotes: { type: Type.STRING }
                                },
                                required: ["roomId", "title", "type", "monsters", "treasure", "description", "dmNotes"]
                            }
                        },
                        traps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING, description: "The exact id from input (x,y)" },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    mechanism: { type: Type.STRING }
                                },
                                required: ["id", "name", "description", "mechanism"]
                            }
                        }
                    }
                }
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text);
            return {
                lore: data.lore,
                rooms: data.rooms,
                traps: data.traps || []
            };
        }
        throw new Error("No content generated");
    } catch (error) {
        console.error("Gemini generation error:", error);
        return {
            lore: {
                name: "Потерянное Подземелье",
                backstory: "Генерация лора не удалась.",
                environment: "...",
                randomEncounters: []
            },
            rooms: rooms.map((r, idx) => ({
                roomId: r.id,
                title: `Комната ${r.id}`,
                type: preRolledTypes[idx],
                monsters: "Ошибка",
                treasure: "Ошибка",
                description: "Генерация не удалась.",
                dmNotes: "N/A"
            })),
            traps: traps.map(t => ({
                id: `${t.x},${t.y}`,
                name: "Ловушка",
                description: "Странный механизм.",
                mechanism: "1d6 урона."
            }))
        };
    }
};
