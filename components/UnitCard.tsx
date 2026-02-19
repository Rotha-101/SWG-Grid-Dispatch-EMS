
import React, { useState, useEffect } from 'react';
import { Circle } from 'lucide-react';
import { UnitData } from '../types';

interface UnitCardProps {
  unit: UnitData;
  onUpdate: (id: string, field: keyof UnitData, value: number) => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unit, onUpdate }) => {
  const isDisabled = unit.enabled === false;
  const badgeClass = unit.id === 'SWG01' ? 'neon-glow-green' : unit.id === 'SWG02' ? 'neon-glow-purple' : 'neon-glow-amber';

  // Local states to handle intermediate input values (like '-' or '') 
  // without the parent forcing them back to numbers immediately.
  const [localP, setLocalP] = useState<string | number>(unit.activeMW);
  const [localQ, setLocalQ] = useState<string | number>(unit.reacMVAR);
  const [localSOC, setLocalSOC] = useState<string | number>(unit.soc);

  // Sync local state when external props change (e.g. from balancing logic)
  useEffect(() => {
    setLocalP(unit.activeMW);
  }, [unit.activeMW]);

  useEffect(() => {
    setLocalQ(unit.reacMVAR);
  }, [unit.reacMVAR]);

  useEffect(() => {
    setLocalSOC(unit.soc);
  }, [unit.soc]);

  const handleInputChange = (field: 'activeMW' | 'reacMVAR' | 'soc', val: string) => {
    // 1. Update local UI state immediately
    if (field === 'activeMW') setLocalP(val);
    if (field === 'reacMVAR') setLocalQ(val);
    if (field === 'soc') setLocalSOC(val);

    // 2. Try to propagate numeric value to parent
    if (val === '' || val === '-') return;
    
    let num = parseInt(val);
    if (isNaN(num)) return;

    // Specific logic for SOC: Clamp 0-100
    if (field === 'soc') {
      if (num < 0) num = 0;
      if (num > 100) num = 100;
      setLocalSOC(num); // Update local to clamped value
    }

    onUpdate(unit.id, field, num);
  };

  const handleBlur = (field: 'activeMW' | 'reacMVAR' | 'soc') => {
    // On blur, if state is invalid, reset to current unit prop
    if (field === 'activeMW' && (localP === '' || localP === '-')) setLocalP(unit.activeMW);
    if (field === 'reacMVAR' && (localQ === '' || localQ === '-')) setLocalQ(unit.reacMVAR);
    if (field === 'soc' && (localSOC === '' || localSOC === '-')) setLocalSOC(unit.soc);
  };

  return (
    <div className={`glass-card rounded-xl p-5 overflow-hidden transition-all duration-300 hover:bg-white/5 ${isDisabled ? 'opacity-40 grayscale-[0.5]' : ''}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div 
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-black ${badgeClass}`}
            style={{ backgroundColor: isDisabled ? '#334155' : unit.badgeColor }}
          >
            {unit.id.replace('SWG', '')}
          </div>
          <div>
            <h3 className="text-white font-bold tracking-widest text-sm uppercase">{unit.name}</h3>
            <p className="text-[10px] font-mono-custom text-slate-500 uppercase flex items-center gap-1 mt-0.5">
              STATUS: <span className={isDisabled ? 'text-amber-600 font-bold' : 'text-emerald-500 font-bold'}>
                {isDisabled ? 'OFFLINE_DISABLED' : 'NOMINAL'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5">
          <Circle size={8} fill={isDisabled ? '#475569' : unit.badgeColor} color={isDisabled ? '#475569' : unit.badgeColor} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">P (MW)</label>
          <input
            type="text"
            disabled={isDisabled}
            value={localP}
            onChange={(e) => handleInputChange('activeMW', e.target.value)}
            onBlur={() => handleBlur('activeMW')}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom text-white outline-none focus:ring-1 focus:ring-blue-500/30 transition-all disabled:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Q (MVAR)</label>
          <input
            type="text"
            disabled={isDisabled}
            value={localQ}
            onChange={(e) => handleInputChange('reacMVAR', e.target.value)}
            onBlur={() => handleBlur('reacMVAR')}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom text-white outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all disabled:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-2 tracking-widest">SOC (%)</label>
          <input
            type="text"
            value={localSOC}
            onChange={(e) => handleInputChange('soc', e.target.value)}
            onBlur={() => handleBlur('soc')}
            className="w-full bg-[#0a0c10] border border-white/5 rounded py-3 text-center text-xl font-bold font-mono-custom outline-none focus:ring-1 transition-all"
            style={{ color: isDisabled ? '#64748b' : unit.badgeColor, borderColor: 'rgba(255,255,255,0.05)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default UnitCard;
