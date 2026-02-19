
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Copy, RotateCcw } from 'lucide-react';
import { UnitData } from '../types';

interface SequenceLogProps {
  units: UnitData[];
  lastCommitTime: string;
  totalP: number;
  totalQ: number;
}

const SequenceLog: React.FC<SequenceLogProps> = ({ units, lastCommitTime, totalP, totalQ }) => {
  const [logContent, setLogContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + 'px';
    }
  }, [logContent]);

  // Effect to generate the default log text whenever units or commit time changes
  useEffect(() => {
    const activeUnits = units.filter(u => u.enabled !== false);
    
    const timeStr = lastCommitTime || new Date().toLocaleString('sv-SE', { 
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });

    const unitLines = activeUnits.map(u => `#${u.id}: P=${Math.round(u.activeMW)}MW, Q=${Math.round(u.reacMVAR)}Mvar, SOC=${u.soc.toFixed(0)}%`).join('\n');
    
    const text = `START AT\nTIME: ${timeStr}\n\n${unitLines}\n\n#TOTAL: P=${totalP}MW, Q=${totalQ}Mvar`;
    setLogContent(text);
  }, [units, lastCommitTime, totalP, totalQ]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logContent);
  };

  const handleReset = () => {
    const activeUnits = units.filter(u => u.enabled !== false);
    const timeStr = lastCommitTime || "NONE";
    const unitLines = activeUnits.map(u => `#${u.id}: P=${Math.round(u.activeMW)}MW, Q=${Math.round(u.reacMVAR)}Mvar, SOC=${u.soc.toFixed(0)}%`).join('\n');
    setLogContent(`START AT\nTIME: ${timeStr}\n\n${unitLines}\n\n#TOTAL: P=${totalP}MW, Q=${totalQ}Mvar`);
  };

  return (
    <div className="glass-card rounded-xl flex flex-col border border-white/5 transition-all overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-blue-400" />
          <div>
            <h2 className="text-xs font-bold text-white tracking-widest uppercase">SEQUENCE_LOG</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-tighter">STATION LIVE OUT</p>
          </div>
        </div>
        <button 
          onClick={handleReset}
          className="text-slate-500 hover:text-white transition-colors p-1"
          title="Reset log to telemetry data"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="flex-1 bg-black/40">
        <textarea
          ref={textareaRef}
          value={logContent}
          onChange={(e) => setLogContent(e.target.value)}
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none resize-none font-mono-custom text-[11px] leading-relaxed text-slate-300 p-4 pb-0 focus:ring-0 selection:bg-blue-500/30 overflow-hidden"
          placeholder="DISPATCH SEQUENCE READY..."
        />
        
        <div className="p-4 pt-4">
          <button 
            onClick={copyToClipboard}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-xs tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/20 uppercase border border-white/10"
          >
            <Copy size={16} />
            COPY DISPATCH TEXT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SequenceLog;
