
import React, { useState } from 'react';
import { GeneratedRoomContent, StockingType, DungeonLore } from '../types';

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
    selectedRoomId?: number;
    onSelectRoom: (id: number) => void;
    onDownload: () => void;
    onExportPDF: () => void;
    useAI: boolean;
    setUseAI: (b: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isGenerating, isGeneratingText, level, setLevel, theme, setTheme, description, setDescription, roomCount, setRoomCount, onGenerateLayout, onGenerateContent, hasLayout, roomContents, lore, selectedRoomId, onSelectRoom, onDownload, onExportPDF, useAI, setUseAI
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'rooms'>('overview');

    // Scroll selected room into view
    React.useEffect(() => {
        if (selectedRoomId) {
            setActiveTab('rooms');
            setTimeout(() => {
                const el = document.getElementById(`room-card-${selectedRoomId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [selectedRoomId]);

    return (
        <div className="w-full md:w-96 bg-[#f3f4f6] border-r border-gray-300 flex flex-col h-screen shadow-xl z-10 text-gray-800">
            <div className="p-4 bg-[#2c241b] text-white">
                <h1 className="text-lg font-bold font-sans uppercase tracking-wider mb-1">Архитектор Подземелий</h1>
                <p className="text-xs opacity-70">OSR Генератор (AD&D 1e)</p>
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
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Тема</label>
                    <input 
                        type="text" 
                        value={theme} 
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="Напр. Склеп Лича"
                        disabled={!useAI}
                        className={`w-full p-2 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-colors ${!useAI && 'opacity-50 cursor-not-allowed'}`}
                    />
                </div>

                <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold uppercase text-gray-600">Режим Генерации</label>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded border border-gray-200">
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
                </div>

                {useAI && (
                    <div className="mb-3">
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Описание / Детали</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Опишите особенности..."
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-colors text-sm h-16 resize-none"
                        />
                    </div>
                )}
                
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

            {/* Tabs */}
            <div className="flex border-b border-gray-300 bg-gray-100">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-2 text-sm font-bold uppercase ${activeTab === 'overview' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                    Обзор
                </button>
                <button 
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-2 text-sm font-bold uppercase ${activeTab === 'rooms' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                    Комнаты ({roomContents.length})
                </button>
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

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && lore && (
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

                {/* ROOMS TAB */}
                {activeTab === 'rooms' && (
                    <div className="p-4 space-y-3">
                        {roomContents.map((room) => (
                            <div 
                                key={room.roomId}
                                id={`room-card-${room.roomId}`}
                                onClick={() => onSelectRoom(room.roomId)}
                                className={`p-3 rounded border cursor-pointer transition-all duration-200
                                    ${selectedRoomId === room.roomId 
                                        ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500" 
                                        : "bg-white border-gray-300 hover:border-gray-400"}
                                `}
                            >
                                <div className="flex justify-between items-baseline border-b border-gray-100 pb-2 mb-2">
                                    <span className="font-bold text-lg text-blue-700">
                                        {room.roomId === 1 ? "🚪 Вход" : `#${room.roomId}`}
                                    </span>
                                    <span className="text-xs font-bold text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded">{room.type}</span>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">{room.title}</h3>
                                <p className="text-sm text-gray-700 mb-3 italic">"{room.description}"</p>
                                
                                {(room.type !== StockingType.EMPTY && String(room.type) !== "Пусто") || room.roomId === 1 ? (
                                    <div className="text-xs bg-gray-50 p-2 rounded border border-gray-200 space-y-1">
                                        {room.monsters !== "None" && room.monsters !== "Нет" && (
                                            <div className="flex flex-col">
                                                <span className="font-bold text-red-700">☠️ Опасность:</span>
                                                <span>{room.monsters}</span>
                                            </div>
                                        )}
                                        {room.treasure !== "None" && room.treasure !== "Нет" && (
                                            <div className="flex flex-col">
                                                <span className="font-bold text-amber-600">💰 Добыча:</span>
                                                <span>{room.treasure}</span>
                                            </div>
                                        )}
                                        {room.dmNotes && (
                                            <div className="pt-1 border-t border-gray-200 text-gray-600 mt-1">
                                                <span className="font-bold block text-purple-800">🧠 Для Мастера (Секрет):</span>
                                                {room.dmNotes}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Footer Actions */}
            {roomContents.length > 0 && (
                 <div className="p-4 border-t border-gray-300 bg-white flex gap-2">
                     <button 
                        onClick={onDownload}
                        className="flex-1 py-2 bg-white border border-gray-400 text-gray-700 font-bold uppercase rounded hover:bg-gray-50 transition-colors shadow-sm text-xs"
                        title="Скачать Markdown"
                    >
                        MD
                    </button>
                    <button 
                        onClick={onExportPDF}
                        className="flex-1 py-2 bg-red-600 border border-red-700 text-white font-bold uppercase rounded hover:bg-red-700 transition-colors shadow-sm text-xs"
                        title="Скачать PDF с картой"
                    >
                        PDF
                    </button>
                 </div>
            )}
        </div>
    );
};
