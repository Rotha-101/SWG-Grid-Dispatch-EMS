
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Circle, 
  Database, 
  CheckCircle2, 
  Zap,
  HardDrive
} from 'lucide-react';
import { UnitData, DispatchEntry } from './types';
import Header from './components/Header';
import UnitCard from './components/UnitCard';
import DispatchHistory from './components/DispatchHistory';
import SequenceLog from './components/SequenceLog';

const STORAGE_KEY = 'GRID_DISPATCH_HISTORY_DB_V2';

const INITIAL_UNITS: UnitData[] = [
  { id: 'SWG01', name: 'SWG_UNIT_01', badgeColor: '#10b981', activeMW: 0, reacMVAR: 0, soc: 0, battLvl: 0, enabled: true },
  { id: 'SWG02', name: 'SWG_UNIT_02', badgeColor: '#8b5cf6', activeMW: 0, reacMVAR: 0, soc: 0, battLvl: 0, enabled: true },
  { id: 'SWG03', name: 'SWG_UNIT_03', badgeColor: '#f59e0b', activeMW: 0, reacMVAR: 0, soc: 0, battLvl: 0, enabled: true },
];

const App: React.FC = () => {
  const [units, setUnits] = useState<UnitData[]>(INITIAL_UNITS);
  const [lastCommitTime, setLastCommitTime] = useState<string>('');
  const [totalP, setTotalP] = useState<number>(0);
  const [totalQ, setTotalQ] = useState<number>(0);

  // LAZY INITIALIZER: This is the ONLY way to ensure data is not lost on refresh.
  // It runs once before the component even renders the first time.
  const [history, setHistory] = useState<DispatchEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Critical: Dispatch Database corrupted. Initializing safety buffer.");
      return [];
    }
  });

  // Keep LocalStorage in sync with State
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const swg3Enabled = units.find(u => u.id === 'SWG03')?.enabled ?? true;

  const updateIndividualUnits = (p: number, q: number, s3Enabled: boolean) => {
    setUnits(prev => {
      let s1P = 0, s2P = 0, s3P = 0;
      let s1Q = 0, s2Q = 0, s3Q = 0;

      // --- ACTIVE POWER (P) LOGIC ---
      if (s3Enabled) {
        // P: SWG1=46%, SWG2=27%, SWG3=27%
        s2P = Math.round(p * 0.27);
        s3P = Math.round(p * 0.27);
        s1P = p - (s2P + s3P); 
      } else {
        // Only SWG1 and SWG2 (SWG3 offline)
        // Note: Logic specifies 50% split
        s2P = Math.round(p * 0.50);
        s3P = 0;
        s1P = p - s2P;
      }

      // --- REACTIVE POWER (Q) LOGIC ---
      if (s3Enabled) {
        if (q <= 5) {
          s1Q = q; s2Q = 0; s3Q = 0;
        } else if (q <= 10) {
          s1Q = 5; s2Q = q - 5; s3Q = 0;
        } else {
          // Normal distribution when > 10
          // Q: SWG1=50%, SWG2=25%, SWG3=25%
          s2Q = Math.round(q * 0.25);
          s3Q = Math.round(q * 0.25);
          s1Q = q - (s2Q + s3Q);
        }
      } else {
        // Only SWG1 and SWG2
        if (q <= 5) {
          s1Q = q; s2Q = 0; s3Q = 0;
        } else if (q <= 10) {
          s1Q = 5; s2Q = q - 5; s3Q = 0;
        } else {
          // Split 50/50 when > 10
          s2Q = Math.round(q * 0.50);
          s3Q = 0;
          s1Q = q - s2Q;
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

  const handleTotalPUpdate = (val: number) => {
    const intVal = Math.floor(val);
    setTotalP(intVal);
    updateIndividualUnits(intVal, totalQ, swg3Enabled);
  };

  const handleTotalQUpdate = (val: number) => {
    const intVal = Math.floor(val);
    setTotalQ(intVal);
    updateIndividualUnits(totalP, intVal, swg3Enabled);
  };

  const toggleSWG3 = () => {
    const newState = !swg3Enabled;
    setUnits(prev => prev.map(u => u.id === 'SWG03' ? { ...u, enabled: newState } : u));
    updateIndividualUnits(totalP, totalQ, newState);
  };

  const handleUnitUpdate = (id: string, field: keyof UnitData, value: number) => {
    setUnits(prev => {
      const next = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      const p = next.reduce((acc, u) => acc + (u.activeMW || 0), 0);
      const q = next.reduce((acc, u) => acc + (u.reacMVAR || 0), 0);
      setTotalP(p);
      setTotalQ(q);
      return next;
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
    if (window.confirm("Confirm deletion? Data is stored permanently in your browser until cleared.")) {
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
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-xs font-mono-custom">
              <Circle size={10} fill="currentColor" className="animate-pulse" />
              LIVE_CON
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 text-xs font-mono-custom">
              STATION_AUTH
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border-l-4 border-l-blue-600">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                <Zap className="text-blue-500" size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">TOTAL_DISPATCH_SETPOINT</h2>
                <p className="text-[9px] text-slate-500 uppercase font-mono-custom">GLOBAL_OVERRIDE_ENABLED</p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-blue-400 uppercase tracking-widest z-10">TOTAL ACTIVE (MW)</label>
                <input 
                  type="number"
                  step="1"
                  value={totalP}
                  onChange={(e) => handleTotalPUpdate(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0a0c10] border border-blue-500/20 rounded py-3 px-4 text-xl font-bold font-mono-custom text-white outline-none focus:border-blue-500/50 transition-all text-center"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-cyan-400 uppercase tracking-widest z-10">TOTAL REAC (MVAR)</label>
                <input 
                  type="number"
                  step="1"
                  value={totalQ}
                  onChange={(e) => handleTotalQUpdate(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0a0c10] border border-cyan-500/20 rounded py-3 px-4 text-xl font-bold font-mono-custom text-white outline-none focus:border-cyan-500/50 transition-all text-center"
                />
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
              totalP={totalP}
              totalQ={totalQ}
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
            DATA_RETENTION: PERMANENT
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
