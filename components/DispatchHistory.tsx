
import React, { useState } from 'react';
import { Download, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';
import { DispatchEntry } from '../types';

// Dynamically import libraries for export
const getXLSX = async () => await import('https://esm.sh/xlsx@0.18.5');
const getJsPDF = async () => {
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  await import('https://esm.sh/jspdf-autotable@3.5.25');
  return jsPDF;
};

interface DispatchHistoryProps {
  history: DispatchEntry[];
  onDelete: (id: string) => void;
  onSave: (entry: DispatchEntry) => void;
}

const DispatchHistory: React.FC<DispatchHistoryProps> = ({ history, onDelete, onSave }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<DispatchEntry | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const startEditing = (entry: DispatchEntry) => {
    setEditingId(entry.id);
    setTempValues(JSON.parse(JSON.stringify(entry)));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTempValues(null);
  };

  const saveEditing = () => {
    if (tempValues) {
      onSave(tempValues);
      setEditingId(null);
      setTempValues(null);
    }
  };

  const updateTempValue = (unitId: string, field: 'active' | 'reac' | 'soc', value: number) => {
    if (!tempValues) return;
    setTempValues({
      ...tempValues,
      units: {
        ...tempValues.units,
        [unitId]: {
          ...tempValues.units[unitId],
          [field]: value
        }
      }
    });
  };

  // Export Handlers
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch_history_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'SWG01_P', 'SWG01_Q', 'SWG01_SOC', 'SWG02_P', 'SWG02_Q', 'SWG02_SOC', 'SWG03_P', 'SWG03_Q', 'SWG03_SOC'];
    const rows = history.map(entry => [
      entry.timestamp,
      entry.units.SWG01.active, entry.units.SWG01.reac, entry.units.SWG01.soc,
      entry.units.SWG02.active, entry.units.SWG02.reac, entry.units.SWG02.soc,
      entry.units.SWG03.active, entry.units.SWG03.reac, entry.units.SWG03.soc,
    ]);
    const content = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch_history_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = async () => {
    try {
      setExporting('xlsx');
      const XLSX = await getXLSX();
      const data = history.map(entry => ({
        Timestamp: entry.timestamp,
        'SWG01 P(MW)': entry.units.SWG01.active,
        'SWG01 Q(MVAR)': entry.units.SWG01.reac,
        'SWG01 SOC(%)': entry.units.SWG01.soc,
        'SWG02 P(MW)': entry.units.SWG02.active,
        'SWG02 Q(MVAR)': entry.units.SWG02.reac,
        'SWG02 SOC(%)': entry.units.SWG02.soc,
        'SWG03 P(MW)': entry.units.SWG03.active,
        'SWG03 Q(MVAR)': entry.units.SWG03.reac,
        'SWG03 SOC(%)': entry.units.SWG03.soc,
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dispatch History");
      XLSX.writeFile(workbook, `dispatch_history_${new Date().getTime()}.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    try {
      setExporting('pdf');
      const jsPDF = await getJsPDF();
      const doc = new jsPDF('l', 'pt');
      
      doc.setFontSize(18);
      doc.text("SWG GRID DISPATCH REPORT", 40, 40);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 60);

      const tableData = history.map(entry => [
        entry.timestamp,
        entry.units.SWG01.active, entry.units.SWG01.reac, `${entry.units.SWG01.soc}%`,
        entry.units.SWG02.active, entry.units.SWG02.reac, `${entry.units.SWG02.soc}%`,
        entry.units.SWG03.active, entry.units.SWG03.reac, `${entry.units.SWG03.soc}%`,
      ]);

      (doc as any).autoTable({
        startY: 80,
        head: [['Timestamp', 'S1_P', 'S1_Q', 'S1_SOC', 'S2_P', 'S2_Q', 'S2_SOC', 'S3_P', 'S3_Q', 'S3_SOC']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillStyle: [15, 23, 42], textColor: [255, 255, 255] }
      });

      doc.save(`dispatch_report_${new Date().getTime()}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col border border-white/5">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div>
          <h2 className="text-xs font-bold text-white tracking-widest uppercase">DISPATCH_HISTORY</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-tighter">ACTIVE SHIFT BUFFER • AUTO-SAVING</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-slate-500 font-mono-custom mr-2 uppercase">PROTOCOL:</span>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase"
          >
            <Download size={10} className="text-blue-400" /> CSV
          </button>
          <button 
            onClick={exportXLSX}
            disabled={exporting === 'xlsx'}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase disabled:opacity-50"
          >
            {exporting === 'xlsx' ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} className="text-emerald-400" />} XLSX
          </button>
          <button 
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase"
          >
            <Download size={10} className="text-amber-400" /> JSON
          </button>
          <button 
            onClick={exportPDF}
            disabled={exporting === 'pdf'}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} className="text-rose-400" />} PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0f1218] z-10">
            <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              <th className="px-6 py-4 font-normal">DATETIME STAMP</th>
              {['SWG 01', 'SWG 02', 'SWG 03'].map((swg, i) => (
                <th key={swg} className="px-4 py-4 font-normal text-center border-l border-white/5">
                  <span className={i === 0 ? 'text-emerald-500' : i === 1 ? 'text-purple-500' : 'text-amber-500'}>{swg}</span>
                  <div className="flex justify-around mt-2 opacity-50 gap-2 font-mono-custom">
                    <span className="w-12">ACTIVE</span>
                    <span className="w-12">REAC</span>
                    <span className="w-12">SOC</span>
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 font-normal text-right border-l border-white/5">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono-custom text-xs">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-600 uppercase tracking-widest italic opacity-50">
                  NO DISPATCH SEQUENCE COMMITTED
                </td>
              </tr>
            ) : (
              history.map((entry) => {
                const isEditing = editingId === entry.id;
                const data = isEditing ? tempValues! : entry;
                
                return (
                  <tr key={entry.id} className={`${isEditing ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'} transition-colors group`}>
                    <td className="px-6 py-4 text-slate-400 flex items-center gap-3">
                       <span className={`w-1 h-3 rounded-full transition-all ${isEditing ? 'bg-blue-500 animate-pulse scale-y-150' : 'bg-emerald-500/30 group-hover:bg-emerald-500'}`}></span>
                       {entry.timestamp}
                    </td>
                    
                    {['SWG01', 'SWG02', 'SWG03'].map((unitId) => (
                      <td key={unitId} className="px-4 py-4 border-l border-white/5">
                        <div className="flex justify-around font-bold gap-2">
                          {isEditing ? (
                            <>
                              <input 
                                type="number" 
                                className="w-12 bg-black border border-white/10 rounded px-1 py-0.5 text-center text-white focus:border-blue-500 outline-none"
                                value={Math.round(data.units[unitId].active)}
                                onChange={(e) => updateTempValue(unitId, 'active', parseInt(e.target.value) || 0)}
                              />
                              <input 
                                type="number" 
                                className="w-12 bg-black border border-white/10 rounded px-1 py-0.5 text-center text-slate-500 focus:border-blue-500 outline-none"
                                value={Math.round(data.units[unitId].reac)}
                                onChange={(e) => updateTempValue(unitId, 'reac', parseInt(e.target.value) || 0)}
                              />
                              <input 
                                type="number" 
                                className="w-12 bg-black border border-white/10 rounded px-1 py-0.5 text-center text-blue-400 focus:border-blue-500 outline-none"
                                value={Math.round(data.units[unitId].soc)}
                                onChange={(e) => updateTempValue(unitId, 'soc', parseInt(e.target.value) || 0)}
                              />
                            </>
                          ) : (
                            <>
                              <span className="text-white w-12 text-center">{Math.round(data.units[unitId].active)}</span>
                              <span className="text-slate-500 w-12 text-center">{Math.round(data.units[unitId].reac)}</span>
                              <span className={`${unitId === 'SWG01' ? 'text-emerald-500' : unitId === 'SWG02' ? 'text-purple-500' : 'text-amber-500'} w-12 text-center`}>
                                {data.units[unitId].soc.toFixed(0)}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    ))}

                    <td className="px-6 py-4 border-l border-white/5 text-right">
                      <div className={`flex items-center justify-end gap-3 ${isEditing ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'} transition-opacity`}>
                        {isEditing ? (
                          <>
                            <button 
                              onClick={saveEditing}
                              className="text-emerald-500 hover:text-emerald-400 transition-colors p-1"
                              title="Save Changes"
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="text-rose-500 hover:text-rose-400 transition-colors p-1"
                              title="Cancel Edit"
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => startEditing(entry)}
                              className="hover:text-blue-400 transition-colors p-1"
                              title="Edit record"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => onDelete(entry.id)}
                              className="hover:text-rose-500 transition-colors p-1"
                              title="Delete log"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DispatchHistory;
