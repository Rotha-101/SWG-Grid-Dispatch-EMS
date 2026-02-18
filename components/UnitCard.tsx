
import React from 'react';
import { Circle, Battery } from 'lucide-react';
import { UnitData } from '../types';

interface UnitCardProps {
  unit: UnitData;
  onUpdate: (id: string, field: keyof UnitData, value: number) => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unit, onUpdate }) => {
  const isDisabled = unit.enabled === false;
  const badgeClass = unit.id === 'SWG01' ? 'neon-glow-green' : unit.id === 'SWG02' ? 'neon-glow-purple' : 'neon-glow-amber';

  return (
    <div className={`glass-card rounded-xl p-5 overflow-hidden transition-all duration-300 hover:bg-white/5 ${isDisabled ? 'opacity-40 grayscale-[0.5]' : ''}`}>
      {/* Card Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div 
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-black ${badgeClass}`}
            style={{ backgroundColor: isDisabled ? '#334155' : unit.badgeColor }}
          >
            {unit.id.replace('SWG', '')}
          </div>
          <div>
            <h3 className="text-white font-bold tracking-widest text-sm">{unit.name}</h3>
            <p className="text-[10px] font-mono-custom text-slate-500 uppercase flex items-center gap-1 mt-0.5">
              STATUS: <span className={isDisabled ? 'text-amber-600' : 'text-emerald-500'}>
                {isDisabled ? 'OFFLINE_DISABLED' : 'NOMINAL'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5">
          <span className="text-[8px] text-slate-400 font-mono-custom uppercase tracking-widest">Telemetry_Link</span>
          <Circle size={8} fill={isDisabled ? '#475569' : unit.badgeColor} color={isDisabled ? '#475569' : unit.badgeColor} />
        </div>
      </div>

      {/* Grid Controls */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Active (MW)</label>
          <input
            type="number"
            step="1"
            disabled={isDisabled}
            value={unit.activeMW}
            onChange={(e) => onUpdate(unit.id, 'activeMW', parseInt(e.target.value) || 0)}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom text-white outline-none focus:ring-1 focus:ring-opacity-50 transition-all disabled:text-slate-600"
            style={{ 
               borderColor: isDisabled ? 'rgba(255,255,255,0.02)' : `rgba(${parseInt(unit.badgeColor.slice(1, 3), 16)}, ${parseInt(unit.badgeColor.slice(3, 5), 16)}, ${parseInt(unit.badgeColor.slice(5, 7), 16)}, 0.1)`
            }}
          />
        </div>
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Reac (MVAR)</label>
          <input
            type="number"
            step="1"
            disabled={isDisabled}
            value={unit.reacMVAR}
            onChange={(e) => onUpdate(unit.id, 'reacMVAR', parseInt(e.target.value) || 0)}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom text-white outline-none focus:ring-1 focus:ring-opacity-50 transition-all disabled:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">SOC (%)</label>
          <input
            type="number"
            value={unit.soc}
            onChange={(e) => onUpdate(unit.id, 'soc', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom text-white outline-none focus:ring-1 focus:ring-opacity-50 transition-all"
            style={{ color: isDisabled ? '#64748b' : unit.badgeColor }}
          />
        </div>
      </div>

      {/* Battery Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">P_LOAD</span>
          </div>
          <div className="flex gap-4 text-[10px] font-mono-custom">
            <span className="text-slate-600">0</span>
            <span className="text-blue-400 font-bold">Q_LOAD 0</span>
          </div>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
          <div 
            className="absolute left-0 top-0 h-full transition-all duration-500"
            style={{ width: isDisabled ? '0%' : '45%', backgroundColor: isDisabled ? '#475569' : unit.badgeColor }}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">BATT_LVL</span>
          <span className="text-[10px] font-mono-custom text-slate-400">{isDisabled ? '0' : '0'}</span>
        </div>
      </div>
    </div>
  );
};

export default UnitCard;
