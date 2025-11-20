
import React, { useState } from 'react';

interface StartScreenProps {
    onStart: (config: { level: number; roomCount: number; useAI: boolean; theme: string; details: string }) => void;
    isGenerating: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, isGenerating }) => {
    const [level, setLevel] = useState(1);
    const [roomCount, setRoomCount] = useState(20);
    const [useAI, setUseAI] = useState(false);
    const [theme, setTheme] = useState("Древний Склеп");
    const [details, setDetails] = useState("");

    const handleStart = () => {
        onStart({ level, roomCount, useAI, theme, details });
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-[#1a1510] text-[#eaddcf] font-mono p-4 overflow-y-auto">
            <div className="max-w-2xl w-full border-4 border-[#8b4513] p-8 bg-[#2c241b] shadow-2xl relative">
                {/* Decorative Corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#eaddcf] -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#eaddcf] -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#eaddcf] -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#eaddcf] -mb-1 -mr-1"></div>

                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-widest text-[#eaddcf] mb-2 text-shadow-retro">
                        Dungeon<br/>Architect
                    </h1>
                    <p className="text-[#8b4513] font-bold text-sm uppercase tracking-[0.2em] bg-[#eaddcf] inline-block px-2">
                        OSR Map Generator
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Config Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-[#8b4513] bg-[#eaddcf] px-1 w-max">Уровень Подземелья</label>
                            <input 
                                type="number" 
                                min="1" max="20" 
                                value={level} 
                                onChange={(e) => setLevel(parseInt(e.target.value))}
                                className="w-full bg-black border-2 border-[#5e2f0d] text-[#eaddcf] p-2 focus:outline-none focus:border-[#eaddcf]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-[#8b4513] bg-[#eaddcf] px-1 w-max">Количество Комнат</label>
                            <input 
                                type="number" 
                                min="5" max="40" 
                                value={roomCount} 
                                onChange={(e) => setRoomCount(parseInt(e.target.value))}
                                className="w-full bg-black border-2 border-[#5e2f0d] text-[#eaddcf] p-2 focus:outline-none focus:border-[#eaddcf]"
                            />
                        </div>
                    </div>

                    {/* AI Toggle Checkbox */}
                    <div className="border-2 border-[#5e2f0d] p-4 bg-[#1e1812]">
                        <label className="flex items-center gap-3 cursor-pointer select-none mb-2 group">
                            <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${useAI ? 'bg-[#eaddcf] border-[#eaddcf]' : 'border-[#5e2f0d] bg-black group-hover:border-[#8b4513]'}`}>
                                {useAI && <span className="text-[#2c241b] font-bold text-lg leading-none">✓</span>}
                            </div>
                            <input 
                                type="checkbox" 
                                checked={useAI} 
                                onChange={(e) => setUseAI(e.target.checked)}
                                className="hidden"
                            />
                            <div>
                                <span className={`text-sm font-bold uppercase block transition-colors ${useAI ? 'text-[#eaddcf]' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                    Включить ИИ Мастера (Gemini)
                                </span>
                            </div>
                        </label>
                        
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-4 pl-9">
                            {useAI 
                                ? "Генерация уникальных описаний, ловушек и диалоги с монстрами." 
                                : "Стандартный режим: Случайные таблицы AD&D 1e (Быстро, работает оффлайн)."}
                        </p>

                        {useAI && (
                            <div className="space-y-3 pl-9 border-l-2 border-[#5e2f0d] ml-3 animate-in slide-in-from-left-2 fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-[#8b4513] bg-[#eaddcf] px-1 w-max font-bold">Тема Подземелья</label>
                                    <input 
                                        type="text" 
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value)}
                                        className="w-full bg-black border border-[#5e2f0d] text-[#eaddcf] p-2 text-sm focus:outline-none focus:border-[#eaddcf]"
                                        placeholder="Напр. Логово Культистов"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-[#8b4513] bg-[#eaddcf] px-1 w-max font-bold">Детали (Опционально)</label>
                                    <textarea 
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                        className="w-full bg-black border border-[#5e2f0d] text-[#eaddcf] p-2 text-sm focus:outline-none focus:border-[#eaddcf] h-20 resize-none"
                                        placeholder="Опишите атмосферу или главного злодея..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Generate Button */}
                    <button 
                        onClick={handleStart}
                        disabled={isGenerating}
                        className={`w-full py-4 text-xl font-bold uppercase tracking-widest border-4 transition-all
                            ${isGenerating 
                                ? 'border-gray-600 text-gray-600 cursor-not-allowed' 
                                : 'border-[#eaddcf] text-[#eaddcf] hover:bg-[#eaddcf] hover:text-[#2c241b] hover:shadow-[0_0_15px_rgba(234,221,207,0.5)]'
                            }`}
                    >
                        {isGenerating ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⚔️</span> Создаем Мир...
                            </span>
                        ) : (
                            "НАЧАТЬ ПРИКЛЮЧЕНИЕ"
                        )}
                    </button>
                </div>

                <div className="mt-6 text-center text-xs text-[#5e2f0d] uppercase">
                    v1.1.0 • OSR RULES • AD&D 1e / B/X
                </div>
            </div>
        </div>
    );
};
