
import React, { useState, useEffect } from 'react';
import { Shield, Settings, Database, Wifi, Clock } from 'lucide-react';

interface HeaderProps {
  onStoreClick?: () => void;
  historyCount?: number;
}

const Header: React.FC<HeaderProps> = ({ onStoreClick, historyCount = 0 }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toUpperCase();

  const formattedTime = time.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <Shield className="text-blue-500" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-widest uppercase">SWG DISPATCH EMS</h2>
            <p className="text-[10px] text-slate-500 font-mono-custom uppercase tracking-tighter">
              SYSTEM_CORE v2.8 • <span className="text-blue-400">STATION_AUTH_ACTIVE</span>
            </p>
          </div>
        </div>

        <div className="hidden md:flex gap-3">
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">GRID_NOMINAL</span>
          </div>
          <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded flex items-center gap-2">
            <Wifi size={10} className="text-blue-400" />
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Telemetry_Link</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] text-slate-500 font-mono-custom tracking-tighter">{formattedDate}</p>
          <p className="text-[10px] text-slate-400 font-mono-custom tracking-tighter">ASIA/PHNOM_PENH (UTC+7)</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-900 border border-white/5 rounded-md flex items-center gap-3">
            <Clock size={16} className="text-slate-500" />
            <span className="text-2xl font-bold font-mono-custom text-white tabular-nums tracking-wider leading-none">
              {formattedTime}
            </span>
          </div>
          
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <Settings size={18} className="text-slate-400" />
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-center min-w-[40px]">
              <div className="flex items-center gap-1 text-[10px] text-blue-400 uppercase font-bold tracking-widest">
                <div className="w-1 h-3 bg-blue-500/50"></div>
                LOGS
              </div>
              <span className="text-xs font-bold text-white font-mono-custom">{historyCount}</span>
            </div>
            <button 
              onClick={onStoreClick}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-[10px] uppercase font-bold border border-white/5 transition-colors active:scale-95"
            >
              <Database size={12} />
              STORE SWG_DATA
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
