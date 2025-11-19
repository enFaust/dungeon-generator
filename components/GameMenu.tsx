
import React from 'react';
import { DungeonLore, RandomEncounter } from '../types';

interface GameMenuProps {
    isOpen: boolean;
    onClose: () => void;
    lore: DungeonLore | null;
    onDownloadMD: () => void;
    onDownloadPDF: () => void;
    onExit: () => void;
}

export const GameMenu: React.FC<GameMenuProps> = ({ isOpen, onClose, lore, onDownloadMD, onDownloadPDF, onExit }) => {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#f3f4f6] w-full max-w-2xl max-h-[80vh] rounded-lg shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-[#2c241b] text-white p-4 flex justify-between items-center">
                    <h2 className="font-bold uppercase tracking-widest">Журнал Подземелья</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 font-serif text-gray-800">
                    {lore ? (
                        <>
                            <div className="border-b-2 border-gray-300 pb-4">
                                <h1 className="text-3xl font-bold text-[#8b4513] mb-2">{lore.name}</h1>
                                <p className="italic text-lg text-gray-600 mb-4">{lore.backstory}</p>
                                <div className="bg-[#eaddcf] p-3 rounded border border-[#d4c5b0]">
                                    <span className="font-bold text-[#5e2f0d] uppercase text-xs block mb-1">Окружение</span>
                                    <p>{lore.environment}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-xl mb-3 text-[#2c241b]">Случайные Встречи (1d6)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {lore.randomEncounters.map((enc) => (
                                        <div key={enc.roll} className="flex items-start gap-3 p-2 border rounded hover:bg-white transition-colors">
                                            <div className="bg-[#2c241b] text-white w-6 h-6 flex items-center justify-center font-bold text-sm rounded shrink-0">
                                                {enc.roll}
                                            </div>
                                            <div>
                                                <div className="font-bold leading-tight">{enc.creature}</div>
                                                <div className="text-xs text-gray-500 italic">{enc.situation}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-center italic text-gray-500">История этого места покрыта мраком...</p>
                    )}
                </div>

                <div className="p-4 bg-gray-200 border-t border-gray-300 flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button 
                            onClick={onDownloadMD}
                            className="flex-1 py-2 bg-white border border-gray-400 text-gray-800 font-bold uppercase rounded hover:bg-gray-50 text-sm"
                        >
                            📄 Скачать Markdown
                        </button>
                        <button 
                            onClick={onDownloadPDF}
                            className="flex-1 py-2 bg-[#8b4513] text-white font-bold uppercase rounded hover:bg-[#5e2f0d] text-sm"
                        >
                            📕 Скачать PDF
                        </button>
                    </div>
                    <button 
                        onClick={onExit}
                        className="w-full py-2 text-red-600 font-bold text-xs hover:text-red-800 uppercase"
                    >
                        ⏏ Выйти в Главное Меню
                    </button>
                </div>
            </div>
        </div>
    );
};
