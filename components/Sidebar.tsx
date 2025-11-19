
import React from 'react';
import { GeneratedRoomContent, DungeonLore } from '../types';

interface SidebarProps {
    isGenerating: boolean;
    isGeneratingText: boolean;
    level: number;
    setLevel: (l: number) => void;
    theme: string;
    setTheme: (t: string) => void;
    description: string;
    setDescription: (d: string) => void;
    roomCount: number;
    setRoomCount: (c: number) => void;
    onGenerateLayout: () => void;
    onGenerateContent: () => void;
    hasLayout: boolean;
    roomContents: GeneratedRoomContent[];
    lore: DungeonLore | null;
    onDownload: () => void;
    onExportPDF: () => void;
    useAI: boolean;
    setUseAI: (b: boolean) => void;
    onStartGame: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isGenerating, isGeneratingText, level, setLevel, theme, setTheme, description, setDescription, roomCount, setRoomCount, onGenerateLayout, onGenerateContent, hasLayout, roomContents, lore, onDownload, onExportPDF, useAI, setUseAI, onStartGame
}) => {

    return (
        <div className="w-full md:w-96 bg-[#f3f4f6] border-r border-gray-300 flex flex-col h-screen shadow-xl z-40 text-gray-800 shrink-0">
            <div className="p-4 bg-[#2c241b] text-white">
                <h1 className="text-lg font-bold font-sans uppercase tracking-wider mb-1">Архитектор Подземелий</h1>
                <p className="text-xs opacity-70">OSR Генератор (AD&D 1e / B/X)</p>
            </div>

            {/* Controls */}
            <div className="p-4 border-b border-gray-300 bg-white">
                <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Уровень</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="20" 
                            value={level} 
                            onChange={(e) => setLevel(parseInt(e.target.value))}
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="flex-[2]">
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Комнат</label>
                        <input 
                            type="number" 
                            min="5" 
                            max="40" 
                            value={roomCount} 
                            onChange={(e) => setRoomCount(Math.min(40, Math.max(5, parseInt(e.target.value))))}
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold uppercase text-gray-600">Режим Генерации</label>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded border border-gray-200 mb-2">
                        <button 
                            onClick={() => setUseAI(false)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-colors ${!useAI ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Таблицы
                        </button>
                        <button 
                            onClick={() => setUseAI(true)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-colors ${useAI ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Gemini AI
                        </button>
                    </div>

                    {useAI && (
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 animate-in fade-in slide-in-from-top-1">
                            <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1">Тема Подземелья</label>
                            <input 
                                type="text" 
                                value={theme} 
                                onChange={(e) => setTheme(e.target.value)}
                                placeholder="Напр. Склеп Лича"
                                className="w-full p-2 bg-white border border-blue-200 rounded focus:outline-none focus:border-blue-500 transition-colors text-sm mb-2"
                            />
                            <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1">Доп. Детали</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Особенности, злодей..."
                                className="w-full p-2 bg-white border border-blue-200 rounded focus:outline-none focus:border-blue-500 transition-colors text-sm h-12 resize-none"
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={onGenerateLayout}
                        disabled={isGenerating || isGeneratingText}
                        className={`w-full py-2 rounded font-bold uppercase tracking-wide transition-all shadow-sm border border-blue-600
                            ${(isGenerating)
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                                : "bg-white text-blue-600 hover:bg-blue-50"
                            }`}
                    >
                        {isGenerating ? "Строим стены..." : "Перестроить Карту"}
                    </button>

                    <button 
                        onClick={onGenerateContent}
                        disabled={isGenerating || isGeneratingText || !hasLayout}
                        className={`w-full py-2 rounded font-bold uppercase tracking-wide transition-all shadow-sm
                            ${(isGeneratingText || !hasLayout)
                                ? "bg-gray-400 cursor-not-allowed text-white" 
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                    >
                        {isGeneratingText 
                            ? (useAI ? "Пишем историю..." : "Бросаем кости...") 
                            : (useAI ? "Наполнить с ИИ" : "Наполнить из Таблиц")}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-100 relative">
                
                {isGeneratingText && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm font-bold text-blue-800 animate-pulse">{useAI ? "Мастер пишет историю..." : "Генерация таблиц..."}</p>
                        </div>
                    </div>
                )}

                {roomContents.length === 0 && !isGenerating && (
                    <div className="text-center text-gray-500 opacity-80 italic mt-10 p-4">
                        <p>{hasLayout ? "Карта готова. Нажмите 'Наполнить' чтобы создать описание." : "Настройте параметры и нажмите 'Перестроить Карту'."}</p>
                    </div>
                )}

                {/* LORE / OVERVIEW */}
                {lore && (
                    <div className="p-4 space-y-4">
                        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
                            <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2 border-b pb-2">{lore.name}</h2>
                            <div className="space-y-3 text-sm text-gray-800">
                                <div>
                                    <span className="font-bold text-gray-600 uppercase text-xs block">Предыстория</span>
                                    <p className="italic">{lore.backstory}</p>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-600 uppercase text-xs block">Окружение</span>
                                    <p>{lore.environment}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
                            <h3 className="font-bold text-lg text-gray-900 mb-3">Случайные Встречи (1d6)</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-2 py-1 w-10">d6</th>
                                        <th className="px-2 py-1">Существо / Событие</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lore.randomEncounters.map((enc) => (
                                        <tr key={enc.roll} className="hover:bg-gray-50">
                                            <td className="px-2 py-2 font-bold text-center text-blue-600">{enc.roll}</td>
                                            <td className="px-2 py-2">
                                                <div className="font-bold text-gray-900">{enc.creature}</div>
                                                <div className="text-xs text-gray-600">{enc.situation}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-300 bg-white flex flex-col gap-2">
                {hasLayout && (
                     <button 
                        onClick={onStartGame}
                        className="w-full py-3 bg-green-600 text-white font-bold uppercase tracking-wider rounded hover:bg-green-700 transition-all shadow-lg transform hover:scale-[1.02] animate-in slide-in-from-bottom-2"
                    >
                        ⚔️ Начать Игру
                    </button>
                )}

                {roomContents.length > 0 && (
                    <div className="flex gap-2 mt-2">
                         <button 
                            onClick={onDownload}
                            className="flex-1 py-2 bg-white border border-gray-400 text-gray-700 font-bold uppercase rounded hover:bg-gray-50 transition-colors shadow-sm text-xs"
                            title="Скачать Markdown"
                        >
                            Скачать MD
                        </button>
                        <button 
                            onClick={onExportPDF}
                            className="flex-1 py-2 bg-red-600 border border-red-700 text-white font-bold uppercase rounded hover:bg-red-700 transition-colors shadow-sm text-xs"
                            title="Скачать PDF с картой"
                        >
                            Скачать PDF
                        </button>
                    </div>
                 )}
            </div>
        </div>
    );
};
