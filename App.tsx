
import React, { useState, useCallback } from 'react';
import { generateDungeonLayout, rollRoomContents, generateLocalDungeonContent } from './services/dungeonGenerator';
import { generateDungeonDetails } from './services/geminiService';
import { DungeonMap, GeneratedRoomContent, StockingType, DungeonLore, GeneratedTrapContent } from './types';
import { MapViewer } from './components/MapViewer';
import { Sidebar } from './components/Sidebar';
import { jsPDF } from "jspdf";

const App: React.FC = () => {
    const [dungeon, setDungeon] = useState<DungeonMap | null>(null);
    const [roomContents, setRoomContents] = useState<GeneratedRoomContent[]>([]);
    const [trapContents, setTrapContents] = useState<GeneratedTrapContent[]>([]);
    const [lore, setLore] = useState<DungeonLore | null>(null);
    
    const [level, setLevel] = useState(1);
    const [roomCount, setRoomCount] = useState(25); // Default room count
    const [theme, setTheme] = useState("Древний Склеп");
    const [description, setDescription] = useState("");
    
    const [isGenerating, setIsGenerating] = useState(false); // For Map
    const [isGeneratingText, setIsGeneratingText] = useState(false); // For AI/Content
    const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(undefined);
    
    const [useAI, setUseAI] = useState(true);

    const handleGenerateLayout = useCallback(() => {
        setIsGenerating(true);
        // Clear previous content/lore when regenerating map structure
        setRoomContents([]);
        setTrapContents([]);
        setLore(null);
        setSelectedRoomId(undefined);
        
        try {
            // Generate Layout
            const newDungeon = generateDungeonLayout(roomCount); 
            setDungeon(newDungeon);
        } catch (e) {
            console.error(e);
            alert("Ошибка при создании карты!");
        } finally {
            setIsGenerating(false);
        }
    }, [roomCount]);

    const handleGenerateContent = useCallback(async () => {
        if (!dungeon) return;

        setIsGeneratingText(true);
        try {
             // Pre-roll stocking types
            const preRolledTypes = dungeon.rooms.map(() => rollRoomContents());

            if (useAI) {
                // AI Generation
                const result = await generateDungeonDetails(level, theme, description, dungeon.rooms, preRolledTypes, dungeon.traps);
                setRoomContents(result.rooms);
                setTrapContents(result.traps);
                setLore(result.lore);
            } else {
                // Local Table Generation
                const result = generateLocalDungeonContent(level, dungeon, preRolledTypes);
                setRoomContents(result.rooms);
                setTrapContents(result.traps);
                setLore(result.lore);
            }
        } catch (e) {
             console.error(e);
             alert("Ошибка при генерации описания!");
        } finally {
            setIsGeneratingText(false);
        }
    }, [dungeon, level, theme, description, useAI]);

    const handleDownload = () => {
        if (!roomContents.length || !lore) return;
        
        let text = `# Модуль: ${lore.name}\n`;
        text += `**Тема:** ${theme}\n`;
        text += `**Уровень:** ${level}\n`;
        text += `**Дата:** ${new Date().toLocaleDateString()}\n\n`;
        
        if (description && useAI) {
             text += `**Контекст:** ${description}\n\n`;
        }

        text += `## Обзор\n`;
        text += `> ${lore.backstory}\n\n`;
        text += `**Окружение:** ${lore.environment}\n\n`;

        text += `## Случайные Встречи (1d6)\n`;
        lore.randomEncounters.forEach(enc => {
            text += `*   **${enc.roll}:** ${enc.creature} — ${enc.situation}\n`;
        });
        text += `\n`;

        text += `## Комнаты\n\n`;

        roomContents.forEach(room => {
            text += `### ${room.roomId}. ${room.title} (${room.type})\n`;
            text += `> ${room.description}\n\n`;
            if (room.monsters !== "None" && room.monsters !== "Нет") text += `*   **Монстры:** ${room.monsters}\n`;
            if (room.treasure !== "None" && room.treasure !== "Нет") text += `*   **Сокровища:** ${room.treasure}\n`;
            text += `*   **Заметки Мастера:** ${room.dmNotes}\n\n`;
            text += `---\n\n`;
        });

        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dungeon_lvl${level}_${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        if (!lore || !roomContents.length) return;

        const doc = new jsPDF({
            unit: "mm",
            format: "a4"
        });

        // Helper to load custom fonts
        const loadFont = async (url: string, filename: string, fontName: string, style: string) => {
            try {
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);
                
                doc.addFileToVFS(filename, base64);
                doc.addFont(filename, fontName, style);
            } catch (e) {
                console.error(`Failed to load font ${filename}`, e);
            }
        };

        // Load Cyrillic-supporting fonts (Roboto)
        await Promise.all([
            loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf", "Roboto-Regular.ttf", "Roboto", "normal"),
            loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf", "Roboto-Medium.ttf", "Roboto", "bold"),
            loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf", "Roboto-Italic.ttf", "Roboto", "italic")
        ]);

        doc.setFont("Roboto", "normal");

        // 1. Title Page
        doc.setFontSize(24);
        doc.setFont("Roboto", "bold");
        doc.text(lore.name, 20, 30);
        
        doc.setFontSize(12);
        doc.setFont("Roboto", "normal");
        doc.text(`Level ${level} | ${theme}`, 20, 40);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 46);

        doc.setFontSize(14);
        doc.setFont("Roboto", "bold");
        doc.text("Backstory", 20, 60);
        doc.setFontSize(10);
        doc.setFont("Roboto", "normal");
        
        const splitBackstory = doc.splitTextToSize(lore.backstory, 170);
        doc.text(splitBackstory, 20, 70);
        
        let yPos = 70 + splitBackstory.length * 5 + 10;

        doc.setFontSize(14);
        doc.setFont("Roboto", "bold");
        doc.text("Environment", 20, yPos);
        doc.setFontSize(10);
        doc.setFont("Roboto", "normal");
        const splitEnv = doc.splitTextToSize(lore.environment, 170);
        doc.text(splitEnv, 20, yPos + 10);

        yPos += 10 + splitEnv.length * 5 + 10;

        // 2. Map Capture
        const svgElement = document.getElementById('dungeon-map-svg') as unknown as SVGSVGElement;
        if (svgElement) {
            try {
                const serializer = new XMLSerializer();
                let svgString = serializer.serializeToString(svgElement);
                
                // Simple cleanup for standalone SVG
                if(!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                     svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }

                const canvas = document.createElement("canvas");
                // Get SVG dimensions
                const width = svgElement.viewBox.baseVal.width || 800;
                const height = svgElement.viewBox.baseVal.height || 800;
                
                // Higher resolution for PDF
                canvas.width = width * 2;
                canvas.height = height * 2;
                
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    const img = new Image();
                    const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
                    const url = URL.createObjectURL(svgBlob);
                    
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = url;
                    });
                    
                    ctx.fillStyle = '#fcfaf2'; // Classic background
                    ctx.fillRect(0,0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const imgData = canvas.toDataURL("image/png");
                    
                    // Add new page for Map if low on space
                    if (yPos > 150) {
                        doc.addPage();
                        yPos = 20;
                    } else {
                        yPos += 10;
                    }

                    doc.setFontSize(14);
                    doc.setFont("Roboto", "bold");
                    doc.text("Map", 20, yPos);
                    yPos += 10;
                    
                    // Fit map to A4 width (approx 170mm usable)
                    const pdfImgWidth = 170;
                    const pdfImgHeight = (canvas.height / canvas.width) * pdfImgWidth;
                    
                    if (yPos + pdfImgHeight > 280) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.addImage(imgData, 'PNG', 20, yPos, pdfImgWidth, pdfImgHeight);
                    yPos += pdfImgHeight + 10;
                    
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error("Map capture failed", err);
                doc.text("(Map capture failed - check console)", 20, yPos + 10);
                yPos += 20;
            }
        }

        // 3. Encounters
        doc.addPage();
        yPos = 20;
        doc.setFontSize(16);
        doc.setFont("Roboto", "bold");
        doc.text("Random Encounters", 20, yPos);
        yPos += 10;
        doc.setFontSize(10);
        
        lore.randomEncounters.forEach(enc => {
            doc.setFont("Roboto", "bold");
            doc.text(`d6: ${enc.roll} - ${enc.creature}`, 20, yPos);
            doc.setFont("Roboto", "normal");
            const situationLines = doc.splitTextToSize(enc.situation, 160);
            doc.text(situationLines, 25, yPos + 5);
            yPos += 5 + situationLines.length * 5 + 5;
        });

        // 4. Rooms
        doc.addPage();
        yPos = 20;
        doc.setFontSize(16);
        doc.setFont("Roboto", "bold");
        doc.text("Room Descriptions", 20, yPos);
        yPos += 10;

        roomContents.forEach(room => {
            // Check page break
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(12);
            doc.setFont("Roboto", "bold");
            doc.text(`${room.roomId}. ${room.title} (${room.type})`, 20, yPos);
            yPos += 6;
            
            doc.setFontSize(10);
            doc.setFont("Roboto", "italic");
            const descLines = doc.splitTextToSize(room.description, 170);
            doc.text(descLines, 20, yPos);
            yPos += descLines.length * 5 + 2;

            doc.setFont("Roboto", "normal");
            
            if (room.monsters !== "None" && room.monsters !== "Нет") {
                const m = `Monsters: ${room.monsters}`;
                const mLines = doc.splitTextToSize(m, 170);
                doc.text(mLines, 20, yPos);
                yPos += mLines.length * 5;
            }
            
            if (room.treasure !== "None" && room.treasure !== "Нет") {
                 const t = `Treasure: ${room.treasure}`;
                 const tLines = doc.splitTextToSize(t, 170);
                 doc.text(tLines, 20, yPos);
                 yPos += tLines.length * 5;
            }

            if (room.dmNotes) {
                doc.setTextColor(100);
                const n = `DM Note: ${room.dmNotes}`;
                const nLines = doc.splitTextToSize(n, 170);
                doc.text(nLines, 20, yPos);
                doc.setTextColor(0);
                yPos += nLines.length * 5;
            }

            yPos += 5; // Spacing
        });

        doc.save(`dungeon_${level}_${theme.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#e5e7eb]">
            <Sidebar 
                isGenerating={isGenerating}
                isGeneratingText={isGeneratingText}
                level={level}
                setLevel={setLevel}
                roomCount={roomCount}
                setRoomCount={setRoomCount}
                theme={theme}
                setTheme={setTheme}
                description={description}
                setDescription={setDescription}
                onGenerateLayout={handleGenerateLayout}
                onGenerateContent={handleGenerateContent}
                hasLayout={!!dungeon}
                roomContents={roomContents}
                lore={lore}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                onDownload={handleDownload}
                onExportPDF={handleExportPDF}
                useAI={useAI}
                setUseAI={setUseAI}
            />
            <div className="flex-1 relative h-full">
                {dungeon ? (
                    <MapViewer 
                        dungeon={dungeon} 
                        roomContents={roomContents}
                        trapContents={trapContents}
                        selectedRoomId={selectedRoomId}
                        onRoomSelect={setSelectedRoomId}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full opacity-30">
                        <div className="text-center">
                            <div className="text-6xl mb-4 grayscale">🏰</div>
                            <p className="font-sans text-gray-800">Создайте планировку подземелья...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
