
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
  { id: 'SWG01', name: 'SWG_UNIT_01', badgeColor: '#10b981', activeMW: 0, reacMVAR: 0, soc: 95, cRate: 0.435374, soh: 1.0, pLimit: 136, originalP: 0, limitedP: 0, enabled: true },
  { id: 'SWG02', name: 'SWG_UNIT_02', badgeColor: '#8b5cf6', activeMW: 0, reacMVAR: 0, soc: 95, cRate: 0.272108, soh: 1.0, pLimit: 82, originalP: 0, limitedP: 0, enabled: true },
  { id: 'SWG03', name: 'SWG_UNIT_03', badgeColor: '#f59e0b', activeMW: 0, reacMVAR: 0, soc: 95, cRate: 0.292517, soh: 1.0, pLimit: 82, originalP: 0, limitedP: 0, enabled: true },
];

const App: React.FC = () => {
  const [units, setUnits] = useState<UnitData[]>(INITIAL_UNITS);
  const [lastCommitTime, setLastCommitTime] = useState<string>('');
  const [totalP, setTotalP] = useState<number | string>(0);
  const [totalQ, setTotalQ] = useState<number | string>(0);
  const [socMin, setSocMin] = useState<number | string>(5);
  const [socMax, setSocMax] = useState<number | string>(95);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const swg3Enabled = units.find(u => u.id === 'SWG03')?.enabled ?? true;

  // --- GLOBAL DISTRIBUTION (When Total Setpoint changes) ---
  const distributeTotalToUnits = (p: number, q: number, s3Enabled: boolean, currentUnits: UnitData[] = units, currentSocMin: number = socMin, currentSocMax: number = socMax) => {
    setUnits(prev => {
      const activeUnits = currentUnits.filter(u => u.id !== 'SWG03' || s3Enabled);
      
      // --- ACTIVE POWER (P) LOGIC (BESS Allocation) ---
      let newUnits = [...prev];
      
      // Step 1: Mode
      const isDischarge = p > 0;
      const isCharge = p < 0;
      
      // Step 2: Compute Weights
      let totalWeight = 0;
      const weights: Record<string, number> = {};
      
      activeUnits.forEach(u => {
        let w = 0;
        if (isDischarge) {
          const margin = u.soc - currentSocMin;
          if (margin > 0) w = margin * u.soh * u.cRate;
        } else if (isCharge) {
          const margin = currentSocMax - u.soc;
          if (margin > 0) w = margin * u.soh * u.cRate;
        }
        weights[u.id] = w;
        totalWeight += w;
      });

      // Fallback: If totalWeight is 0 (e.g., all batteries are at SOCmax and trying to charge),
      // distribute purely based on C-Rate so the setpoints still populate.
      if (totalWeight === 0 && p !== 0) {
        activeUnits.forEach(u => {
          const w = u.cRate;
          weights[u.id] = w;
          totalWeight += w;
        });
      }
      
      // Step 3: Original Allocation
      const originalAlloc: Record<string, number> = {};
      const limitedAlloc: Record<string, number> = {};
      activeUnits.forEach(u => {
        originalAlloc[u.id] = 0;
        limitedAlloc[u.id] = 0;
      });
      
      const pAbs = Math.abs(p);
      const pSign = p < 0 ? -1 : 1;

      if (pAbs > 0 && pAbs <= 10) {
        let s1P = 0, s2P = 0, s3P = 0;
        if (pAbs <= 5) {
          s1P = p;
        } else {
          s1P = 5 * pSign;
          s2P = (pAbs - 5) * pSign;
        }
        
        if (activeUnits.find(u => u.id === 'SWG01')) {
          originalAlloc['SWG01'] = s1P;
          limitedAlloc['SWG01'] = s1P;
        }
        if (activeUnits.find(u => u.id === 'SWG02')) {
          originalAlloc['SWG02'] = s2P;
          limitedAlloc['SWG02'] = s2P;
        }
        if (activeUnits.find(u => u.id === 'SWG03')) {
          originalAlloc['SWG03'] = s3P;
          limitedAlloc['SWG03'] = s3P;
        }
      } else {
        activeUnits.forEach(u => {
          if (p === 0 || totalWeight === 0) {
            originalAlloc[u.id] = 0;
          } else {
            originalAlloc[u.id] = p * (weights[u.id] / totalWeight);
          }
        });
        
        // Step 4 & 5: Apply Limits and Redistribute
        if (p !== 0 && totalWeight > 0) {
          let remainingP = p;
          let activePool = [...activeUnits];
          let currentWeights = { ...weights };
          
          // Iterative redistribution
          let iterationCount = 0;
          while (Math.abs(remainingP) > 0.001 && activePool.length > 0 && iterationCount < 10) {
            iterationCount++;
            let poolWeight = activePool.reduce((sum, u) => sum + currentWeights[u.id], 0);
            
            if (poolWeight === 0) break;
            
            let nextPool: UnitData[] = [];
            let nextRemainingP = 0;
            
            for (const u of activePool) {
              const share = remainingP * (currentWeights[u.id] / poolWeight);
              const proposedTotal = limitedAlloc[u.id] + share;
              
              // Check limits based on absolute value
              if (Math.abs(proposedTotal) > u.pLimit) {
                const clampedVal = proposedTotal > 0 ? u.pLimit : -u.pLimit;
                const actualAdded = clampedVal - limitedAlloc[u.id];
                limitedAlloc[u.id] = clampedVal;
                nextRemainingP += (share - actualAdded);
                currentWeights[u.id] = 0; // Remove from pool
              } else {
                limitedAlloc[u.id] = proposedTotal;
                nextPool.push(u);
              }
            }
            
            remainingP = nextRemainingP;
            activePool = nextPool;
          }
        }
        
        // Calculate sum before rounding to know if we fully allocated
        let sumUnrounded = 0;
        activeUnits.forEach(u => sumUnrounded += limitedAlloc[u.id]);

        // Integer Dispatch Rule
        let totalLimited = 0;
        activeUnits.forEach(u => {
          limitedAlloc[u.id] = Math.round(limitedAlloc[u.id]);
          totalLimited += limitedAlloc[u.id];
        });
        
        // Slack correction (only apply if we successfully allocated everything before rounding)
        if (Math.abs(sumUnrounded - p) < 0.1) {
          const diff = p - totalLimited;
          if (diff !== 0 && activeUnits.length > 0) {
            // Find a unit that can take the slack without violating limits
            for (const u of activeUnits) {
              const proposed = limitedAlloc[u.id] + diff;
              if (Math.abs(proposed) <= u.pLimit) {
                limitedAlloc[u.id] = proposed;
                break;
              }
            }
          }
        }
      }

      // --- REACTIVE POWER (Q) LOGIC ---
      let s1Q = 0, s2Q = 0, s3Q = 0;
      const qAbs = Math.abs(q);
      const qSign = q < 0 ? -1 : 1;

      if (s3Enabled) {
        if (qAbs <= 5) {
          s1Q = q; s2Q = 0; s3Q = 0;
        } else if (qAbs <= 10) {
          s1Q = 5 * qSign; s2Q = (qAbs - 5) * qSign; s3Q = 0;
        } else {
          s2Q = Math.round(q * 0.25);
          s3Q = Math.round(q * 0.25);
          s1Q = q - (s2Q + s3Q);
        }
      } else {
        if (qAbs <= 5) {
          s1Q = q; s2Q = 0; s3Q = 0;
        } else {
          s2Q = Math.round(q * 0.50);
          s1Q = q - s2Q; s3Q = 0;
        }
      }

      return prev.map(u => {
        if (!s3Enabled && u.id === 'SWG03') {
          return { ...u, activeMW: 0, reacMVAR: 0, originalP: 0, limitedP: 0 };
        }
        const newQ = u.id === 'SWG01' ? s1Q : u.id === 'SWG02' ? s2Q : s3Q;
        return { 
          ...u, 
          activeMW: limitedAlloc[u.id] || 0, 
          reacMVAR: newQ,
          originalP: originalAlloc[u.id] || 0,
          limitedP: limitedAlloc[u.id] || 0
        };
      });
    });
  };

  const handleTotalPUpdate = (val: any) => {
    if (val === '' || val === '-' || val === '.' || val === '-.') { 
      setTotalP(val); 
      distributeTotalToUnits(0, Number(totalQ) || 0, swg3Enabled);
      return; 
    }
    let numericVal = parseFloat(val);
    if (!isNaN(numericVal)) {
      if (numericVal > 300) { setTotalP(300); numericVal = 300; }
      else if (numericVal < -300) { setTotalP(-300); numericVal = -300; }
      else { setTotalP(val); }
      distributeTotalToUnits(numericVal, Number(totalQ) || 0, swg3Enabled);
    }
  };

  const handleTotalQUpdate = (val: any) => {
    if (val === '' || val === '-' || val === '.' || val === '-.') { 
      setTotalQ(val); 
      distributeTotalToUnits(Number(totalP) || 0, 0, swg3Enabled);
      return; 
    }
    let numericVal = parseFloat(val);
    if (!isNaN(numericVal)) {
      if (numericVal > 300) { setTotalQ(300); numericVal = 300; }
      else if (numericVal < -300) { setTotalQ(-300); numericVal = -300; }
      else { setTotalQ(val); }
      distributeTotalToUnits(Number(totalP) || 0, numericVal, swg3Enabled);
    }
  };

  const handleSocMinUpdate = (val: string) => {
    if (val === '' || val === '.') { 
      setSocMin(val); 
      distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, swg3Enabled, units, 0, Number(socMax) || 0);
      return; 
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setSocMin(val);
      distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, swg3Enabled, units, num, Number(socMax) || 0);
    }
  };

  const handleSocMaxUpdate = (val: string) => {
    if (val === '' || val === '.') { 
      setSocMax(val); 
      distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, swg3Enabled, units, Number(socMin) || 0, 0);
      return; 
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setSocMax(val);
      distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, swg3Enabled, units, Number(socMin) || 0, num);
    }
  };

  const toggleSWG3 = () => {
    const newState = !swg3Enabled;
    let nextUnits: UnitData[] = [];
    setUnits(prev => {
      nextUnits = prev.map(u => {
        if (u.id === 'SWG03') return { ...u, enabled: newState };
        if (!newState) {
          if (u.id === 'SWG01' || u.id === 'SWG02') return { ...u, cRate: 0.5 };
        } else {
          if (u.id === 'SWG01') return { ...u, cRate: 0.435374 };
          if (u.id === 'SWG02') return { ...u, cRate: 0.272108 };
        }
        return u;
      });
      return nextUnits;
    });
    setTimeout(() => distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, newState, nextUnits, socMin, socMax), 0);
  };

  const handleUnitUpdate = (id: string, field: keyof UnitData, value: number) => {
    setUnits(prev => {
      const nextUnits = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      
      // If SOC, C-rate, or SOH changes, we need to re-run distribution
      if (field === 'soc' || field === 'cRate' || field === 'soh') {
        // We can't call distributeTotalToUnits directly here because it uses setUnits,
        // so we'll just return the updated units and let a useEffect handle it,
        // OR we can just compute the new distribution inline.
        // For simplicity, let's just trigger a re-distribution by calling it with the new units.
        setTimeout(() => distributeTotalToUnits(Number(totalP) || 0, Number(totalQ) || 0, swg3Enabled, nextUnits, socMin, socMax), 0);
        return nextUnits;
      }

      // If manual P/Q update (only allowed if total is 0)
      const isP = field === 'activeMW';
      const masterTotalRaw = isP ? totalP : totalQ;
      const masterTotal = Number(masterTotalRaw) || 0;
      
      if (masterTotal === 0) {
        return nextUnits;
      }

      // Target Lock Mode for Q (P is handled by BESS logic now, but we keep this for Q)
      if (!isP) {
        const residualPool = masterTotal - value;
        const others = nextUnits.filter(u => u.id !== id && u.enabled !== false);
        
        if (others.length === 0) return nextUnits;

        const totalWeightOfOthers = others.reduce((acc, u) => acc + (WEIGHTS[u.id] || 0.33), 0);
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
      }

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

  const handleClearAllHistory = () => {
    if (window.confirm("CONFIRM_ACTION: Permanently delete ALL dispatch records?")) {
      setHistory([]);
    }
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
      <Header onStoreClick={commitSequence} historyCount={history.length} isOnline={isOnline} />

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
                  {Number(totalP) > 0 ? 'DISCHARGE_MODE' : Number(totalP) < 0 ? 'CHARGE_MODE' : 'IDLE_MODE'}
                </p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
              {/* TOTAL ACTIVE POWER P(MW) */}
              <div className="relative group/control">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-blue-400 uppercase tracking-widest z-10">Pset (MW)</label>
                <div className="flex items-center bg-[#0a0c10] border border-blue-500/20 rounded-md overflow-hidden transition-all focus-within:border-blue-500/50">
                  <button 
                    onClick={() => handleTotalPUpdate(Number(totalP) - 10)}
                    className="h-12 w-10 flex items-center justify-center hover:bg-blue-500/10 text-blue-400 border-r border-blue-500/10 transition-colors active:scale-95"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <input 
                    type="number"
                    step="any"
                    value={totalP}
                    onChange={(e) => handleTotalPUpdate(e.target.value)}
                    onBlur={() => { if (totalP === '-' || totalP === '') setTotalP(0); }}
                    className="flex-1 bg-transparent py-3 px-2 text-xl font-bold font-mono-custom text-white outline-none text-center"
                  />
                  <button 
                    onClick={() => handleTotalPUpdate(Number(totalP) + 10)}
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
                    type="number"
                    step="any"
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

              {/* SOC MIN */}
              <div className="relative group/control">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-emerald-400 uppercase tracking-widest z-10">SOCmin (%)</label>
                <div className="flex items-center bg-[#0a0c10] border border-emerald-500/20 rounded-md overflow-hidden transition-all focus-within:border-emerald-500/50">
                  <input 
                    type="number"
                    step="any"
                    value={socMin}
                    onChange={(e) => handleSocMinUpdate(e.target.value)}
                    className="flex-1 bg-transparent py-3 px-2 text-xl font-bold font-mono-custom text-white outline-none text-center"
                  />
                </div>
              </div>

              {/* SOC MAX */}
              <div className="relative group/control">
                <label className="absolute -top-2 left-2 px-1 bg-[#0f1218] text-[8px] font-bold text-emerald-400 uppercase tracking-widest z-10">SOCmax (%)</label>
                <div className="flex items-center bg-[#0a0c10] border border-emerald-500/20 rounded-md overflow-hidden transition-all focus-within:border-emerald-500/50">
                  <input 
                    type="number"
                    step="any"
                    value={socMax}
                    onChange={(e) => handleSocMaxUpdate(e.target.value)}
                    className="flex-1 bg-transparent py-3 px-2 text-xl font-bold font-mono-custom text-white outline-none text-center"
                  />
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

        {/* ALLOCATION RESULTS PANEL */}
        <div className="glass-card rounded-xl p-6 border-l-4 border-l-emerald-500">
          <h2 className="text-sm font-bold text-white tracking-widest uppercase mb-4">BESS ALLOCATION RESULTS</h2>
          
          <div className="flex gap-8 mb-6">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">TOTAL ACTIVE POWER</p>
              <p className="text-2xl font-mono-custom font-bold text-emerald-400">
                {units.reduce((sum, u) => sum + (u.enabled !== false ? u.limitedP : 0), 0)} MW
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">TOTAL REACTIVE POWER</p>
              <p className="text-2xl font-mono-custom font-bold text-cyan-400">
                {units.reduce((sum, u) => sum + (u.enabled !== false ? u.reacMVAR : 0), 0)} MVAR
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">POWER BALANCE</p>
              <p className={`text-2xl font-mono-custom font-bold ${units.reduce((sum, u) => sum + (u.enabled !== false ? u.limitedP : 0), 0) === Number(totalP) ? 'text-emerald-400' : 'text-red-500'}`}>
                {units.reduce((sum, u) => sum + (u.enabled !== false ? u.limitedP : 0), 0) === Number(totalP) ? 'EXACT' : 'NOT EXACT'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-widest">
                  <th className="py-2 px-4">Unit</th>
                  <th className="py-2 px-4 text-right">Original P (MW)</th>
                  <th className="py-2 px-4 text-right">Limited P (MW)</th>
                  <th className="py-2 px-4 text-right">P Limit (MW)</th>
                  <th className="py-2 px-4 text-right">Δ (Limited - Original)</th>
                  <th className="py-2 px-4 text-right">Q (MVAR)</th>
                </tr>
              </thead>
              <tbody className="font-mono-custom text-sm">
                {units.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-4 font-bold" style={{ color: u.badgeColor }}>{u.name}</td>
                    <td className="py-2 px-4 text-right text-slate-300">{u.originalP.toFixed(2)}</td>
                    <td className="py-2 px-4 text-right text-white font-bold">{u.limitedP}</td>
                    <td className="py-2 px-4 text-right text-slate-500">{u.pLimit}</td>
                    <td className={`py-2 px-4 text-right font-bold ${u.limitedP - u.originalP > 0.01 ? 'text-emerald-400' : u.limitedP - u.originalP < -0.01 ? 'text-red-400' : 'text-slate-500'}`}>
                      {(u.limitedP - u.originalP).toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-right text-cyan-400 font-bold">{u.reacMVAR}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              onClearAll={handleClearAllHistory}
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
        <div className={`font-bold ${isOnline ? 'text-blue-500' : 'text-red-500 animate-pulse'}`}>
          {isOnline ? 'SYNC_ACTIVE' : 'OFFLINE_MODE'}
        </div>
      </footer>
    </div>
  );
};

export default App;
