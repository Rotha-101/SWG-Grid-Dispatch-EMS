
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  CheckCircle2, 
  Zap,
  HardDrive,
  Minus,
  Plus
} from 'lucide-react';
import { UnitData, DispatchEntry } from './types';
import Header from './components/Header';
import UnitCard from './components/UnitCard';
import DispatchHistory from './components/DispatchHistory';
import SequenceLog from './components/SequenceLog';

const STORAGE_KEY = 'GRID_DISPATCH_HISTORY_DB_V4';

// Weighting constants for distribution
const WEIGHTS: Record<string, number> = {
  SWG01: 0.46,
  SWG02: 0.27,
  SWG03: 0.27
};

const INITIAL_UNITS: UnitData[] = [
  { id: 'SWG01', name: 'SWG_UNIT_01', badgeColor: '#10b981', activeMW: 0, reacMVAR: 0, soc: 0, enabled: true },
  { id: 'SWG02', name: 'SWG_UNIT_02', badgeColor: '#8b5cf6', activeMW: 0, reacMVAR: 0, soc: 0, enabled: true },
  { id: 'SWG03', name: 'SWG_UNIT_03', badgeColor: '#f59e0b', activeMW: 0, reacMVAR: 0, soc: 0, enabled: true },
];

const App: React.FC = () => {
  const [units, setUnits] = useState<UnitData[]>(INITIAL_UNITS);
  const [lastCommitTime, setLastCommitTime] = useState<string>('');
  const [totalP, setTotalP] = useState<number | string>(0);
  const [totalQ, setTotalQ] = useState<number | string>(0);

  const [history, setHistory] = useState<DispatchEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const swg3Enabled = units.find(u => u.id === 'SWG03')?.enabled ?? true;

  // --- GLOBAL DISTRIBUTION (When Total Setpoint changes) ---
  const distributeTotalToUnits = (p: number, q: number, s3Enabled: boolean) => {
    setUnits(prev => {
      let s1P = 0, s2P = 0, s3P = 0;
      let s1Q = 0, s2Q = 0, s3Q = 0;

      // --- ACTIVE POWER (P) LOGIC ---
      if (s3Enabled) {
        s2P = Math.round(p * WEIGHTS.SWG02);
        s3P = Math.round(p * WEIGHTS.SWG03);
        s1P = p - (s2P + s3P); 
      } else {
        s2P = Math.round(p * 0.50);
        s3P = 0;
        s1P = p - s2P;
      }

      // --- REACTIVE POWER (Q) LOGIC ---
      const qAbs = Math.abs(q);
      const qSign = q < 0 ? -1 : 1;

      if (s3Enabled) {
        if (qAbs <= 5) {
          // Tier 1: 0 to +-5
          s1Q = q;
          s2Q = 0;
          s3Q = 0;
        } else if (qAbs <= 10) {
          // Tier 2: +-5 to +-10
          s1Q = 5 * qSign;
          s2Q = (qAbs - 5) * qSign;
          s3Q = 0;
        } else {
          // Tier 3: > +-10
          // SWG2 and SWG3 take 25% each, SWG1 is the residual
          s2Q = Math.round(q * 0.25);
          s3Q = Math.round(q * 0.25);
          s1Q = q - (s2Q + s3Q);
        }
      } else {
        // SWG3 Disabled Case
        if (qAbs <= 5) {
          s1Q = q;
          s2Q = 0;
          s3Q = 0;
        } else {
          s2Q = Math.round(q * 0.50);
          s1Q = q - s2Q;
          s3Q = 0;
        }
      }

      return prev.map(u => {
        if (u.id === 'SWG01') return { ...u, activeMW: s1P, reacMVAR: s1Q };
        if (u.id === 'SWG02') return { ...u, activeMW: s2P, reacMVAR: s2Q };
        if (u.id === 'SWG03') return { ...u, activeMW: s3P, reacMVAR: s3Q };
        return u;
      });
    });
  };

  const handleTotalPUpdate = (val: any) => {
    if (val === '' || val === '-') { setTotalP(val); return; }
    const numericVal = parseInt(val);
    if (!isNaN(numericVal)) {
      setTotalP(numericVal);
      distributeTotalToUnits(numericVal, Number(totalQ) || 0, swg3Enabled);
    }
  };

  const handleTotalQUpdate = (val: any) => {
    if (val === '' || val === '-') { setTotalQ(val); return; }
    const numericVal = parseInt(val);
    if (!isNaN(numericVal)) {
      setTotalQ(numericVal);
      distributeTotalToUnits(Number(totalP) || 0, numericVal, swg3Enabled);
    }
  };

  const toggleSWG3 = () => {
    const newState = !swg3Enabled;
    setUnits(prev => prev.map(u => u.id === 'SWG03' ? { ...u, enabled: newState } : u));
    distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, newState);
  };

  const handleUnitUpdate = (id: string, field: keyof UnitData, value: number) => {
    setUnits(prev => {
      if (field === 'soc') {
        return prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      }

      const isP = field === 'activeMW';
      const masterTotalRaw = isP ? totalP : totalQ;
      const masterTotal = Number(masterTotalRaw) || 0;
      
      // If Global Total is zero, allow independent manual inputs for each SWG
      if (masterTotal === 0) {
        return prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      }

      // Target Lock Mode: Maintain constant sum
      const residualPool = masterTotal - value;
      const others = prev.filter(u => u.id !== id && u.enabled !== false);
      
      if (others.length === 0) {
        return prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      }

      // Use P-Weights for redistribution logic to ensure proportional sharing
      const totalWeightOfOthers = others.reduce((acc, u) => acc + (WEIGHTS[u.id] || 0.33), 0);
      const nextUnits = [...prev];
      let distributedAmount = 0;

      for (let i = 0; i < others.length - 1; i++) {
        const u = others[i];
        const unitWeight = WEIGHTS[u.id] || 0.33;
        const share = Math.round(residualPool * (unitWeight / totalWeightOfOthers));
        const idx = nextUnits.findIndex(nu => nu.id === u.id);
        nextUnits[idx] = { ...nextUnits[idx], [field]: share };
        distributedAmount += share;
      }

      const lastUnit = others[others.length - 1];
      const lastIdx = nextUnits.findIndex(nu => nu.id === lastUnit.id);
      nextUnits[lastIdx] = { ...nextUnits[lastIdx], [field]: residualPool - distributedAmount };

      const targetIdx = nextUnits.findIndex(nu => nu.id === id);
      nextUnits[targetIdx] = { ...nextUnits[targetIdx], [field]: value };

      return nextUnits;
    });
  };

  const commitSequence = useCallback(() => {
    const timestamp = new Date().toLocaleString('sv-SE', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    
    const newEntry: DispatchEntry = {
      id: crypto.randomUUID(),
      timestamp,
      units: units.reduce((acc, unit) => ({
        ...acc,
        [unit.id]: { active: unit.activeMW, reac: unit.reacMVAR, soc: unit.soc }
      }), {})
    };

    setHistory(prev => [newEntry, ...prev]);
    setLastCommitTime(timestamp);
  }, [units]);

  const handleDeleteHistory = (id: string) => {
    if (window.confirm("CONFIRM_ACTION: Permanently delete dispatch record?")) {
      setHistory(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const handleSaveHistoryEntry = (updatedEntry: DispatchEntry) => {
    setHistory(prev => prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        commitSequence();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitSequence]);

  return (
    <div className="min-h-screen bg-[#06070a] flex flex-col text-slate-300">
      <Header onStoreClick={commitSequence} historyCount={history.length} />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-sm"></div>
            GRID_DISPATCH_CENTER
          </h1>
        </div>

        <div className="glass-card rounded-xl p-4 border-l-4 border-l-blue-600">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                <Zap className="text-blue-500" size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">TOTAL_DISPATCH_SETPOINT</h2>
                <p className="text-[9px] text-slate-500 uppercase font-mono-custom">
                  {Number(totalP) === 0 && Number(totalQ) === 0 ? 'MANUAL_BUILD_MODE' : 'TARGET_LOCK_ACTIVE'}
                </p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {/* TOTAL ACTIVE POWER P(MW) */}
              <div className="relative group/control">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-blue-400 uppercase tracking-widest z-10">TOTAL ACTIVE POWER P(MW)</label>
                <div className="flex items-center bg-[#0a0c10] border border-blue-500/20 rounded-md overflow-hidden transition-all focus-within:border-blue-500/50">
                  <button 
                    onClick={() => handleTotalPUpdate(Number(totalP) - 1)}
                    className="h-12 w-10 flex items-center justify-center hover:bg-blue-500/10 text-blue-400 border-r border-blue-500/10 transition-colors active:scale-95"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <input 
                    type="text"
                    value={totalP}
                    onChange={(e) => handleTotalPUpdate(e.target.value)}
                    onBlur={() => { if (totalP === '-' || totalP === '') setTotalP(0); }}
                    className="flex-1 bg-transparent py-3 px-2 text-xl font-bold font-mono-custom text-white outline-none text-center"
                  />
                  <button 
                    onClick={() => handleTotalPUpdate(Number(totalP) + 1)}
                    className="h-12 w-10 flex items-center justify-center hover:bg-blue-500/10 text-blue-400 border-l border-blue-500/10 transition-colors active:scale-95"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>

              {/* TOTAL REACTIVE POWER Q(MVAR) */}
              <div className="relative group/control">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-cyan-400 uppercase tracking-widest z-10">TOTAL REACTIVE POWER Q(MVAR)</label>
                <div className="flex items-center bg-[#0a0c10] border border-cyan-500/20 rounded-md overflow-hidden transition-all focus-within:border-cyan-500/50">
                  <button 
                    onClick={() => handleTotalQUpdate(Number(totalQ) - 1)}
                    className="h-12 w-10 flex items-center justify-center hover:bg-cyan-500/10 text-cyan-400 border-r border-cyan-500/10 transition-colors active:scale-95"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <input 
                    type="text"
                    value={totalQ}
                    onChange={(e) => handleTotalQUpdate(e.target.value)}
                    onBlur={() => { if (totalQ === '-' || totalQ === '') setTotalQ(0); }}
                    className="flex-1 bg-transparent py-3 px-2 text-xl font-bold font-mono-custom text-white outline-none text-center"
                  />
                  <button 
                    onClick={() => handleTotalQUpdate(Number(totalQ) + 1)}
                    className="h-12 w-10 flex items-center justify-center hover:bg-cyan-500/10 text-cyan-400 border-l border-cyan-500/10 transition-colors active:scale-95"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center bg-black/20 rounded border border-white/5 px-4 h-full">
                <div className="flex items-center gap-4">
                   <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${swg3Enabled ? 'text-slate-500' : 'text-amber-500 animate-pulse'}`}>
                    {swg3Enabled ? 'SWG3_ACTIVE' : 'SWG3_OFFLINE'}
                   </span>
                   <button 
                    onClick={toggleSWG3}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-[#06070a] ${swg3Enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                   >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${swg3Enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} onUpdate={handleUnitUpdate} />
          ))}
        </div>

        <div className="flex items-center justify-between glass-card p-4 rounded-lg">
          <div className="flex items-center gap-3 text-emerald-400 font-mono-custom text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SEQUENCE_BUFFER_READY
          </div>
          <button 
            onClick={commitSequence}
            className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-md transition-all active:scale-95 font-medium tracking-wide border border-emerald-400/20"
          >
            <CheckCircle2 size={18} />
            COMMIT SEQUENCE <span className="text-emerald-200 text-xs ml-2 opacity-60 font-mono-custom">[ENTER]</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DispatchHistory 
              history={history} 
              onDelete={handleDeleteHistory}
              onSave={handleSaveHistoryEntry}
            />
          </div>

          <div className="lg:col-span-1">
            <SequenceLog 
              units={units} 
              lastCommitTime={lastCommitTime}
              totalP={Number(totalP) || 0}
              totalQ={Number(totalQ) || 0}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-2 flex justify-between items-center text-[10px] text-slate-500 font-mono-custom tracking-tighter uppercase bg-black/40">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            STATION_NOMINAL
          </span>
          <span className="flex items-center gap-2 text-blue-400">
            <HardDrive size={10} />
            RETENTION: ACTIVE_DATABASE
          </span>
          <span className="flex items-center gap-1">
            <Database size={10} />
            ARCHIVE: {history.length} LOGS
          </span>
        </div>
        <div className="text-blue-500 font-bold">
          SYNC_ACTIVE
        </div>
      </footer>
    </div>
  );
};

export default App;
