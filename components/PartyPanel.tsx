
import React from 'react';
import { Adventurer } from '../types';
import { CharacterCard } from './CharacterCard';

interface PartyPanelProps {
    party: Adventurer[];
    setParty: (p: Adventurer[]) => void;
    logs: string[];
    onLog: (msg: string) => void;
}

export const PartyPanel: React.FC<PartyPanelProps> = ({ party, setParty, logs, onLog }) => {
    
    const handleUpdateCharacter = (updatedChar: Adventurer) => {
        setParty(party.map(p => p.id === updatedChar.id ? updatedChar : p));
    };

    return (
        <div className="p-4 bg-gray-100 h-full overflow-y-auto font-mono pb-24">
             {/* Log Window */}
             <div className="mb-4 bg-white p-2 border border-gray-300 rounded shadow-sm min-h-[80px] text-xs flex flex-col justify-end">
                <div className="font-bold text-gray-500 border-b mb-1 pb-1">Журнал действий:</div>
                {logs.length === 0 && <span className="text-gray-400 italic">Группа готова к приключениям...</span>}
                {logs.map((l, i) => (
                    <div key={i} className="text-gray-800 leading-tight my-0.5 border-l-2 border-blue-200 pl-1">{l}</div>
                ))}
            </div>

            {/* Character List */}
            <div className="grid grid-cols-1 gap-4">
                {party.map(char => (
                    <CharacterCard 
                        key={char.id}
                        char={char}
                        onUpdate={handleUpdateCharacter}
                        onLog={onLog}
                    />
                ))}
            </div>
        </div>
    );
};
