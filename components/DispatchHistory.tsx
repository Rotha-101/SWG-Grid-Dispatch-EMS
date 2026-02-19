
import React, { useState } from 'react';
import { Download, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';
import { DispatchEntry } from '../types';

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
    <div className="glass-card rounded-xl overflow-hidden flex flex-col border border-white/5 h-full">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div>
          <h2 className="text-xs font-bold text-white tracking-widest uppercase">DISPATCH_HISTORY</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-tighter">TELEMETRY_RECORD_SYNCED</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase">CSV</button>
          <button onClick={exportXLSX} className="px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase">XLSX</button>
          <button onClick={exportPDF} className="px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 transition-colors uppercase">PDF</button>
        </div>
      </div>

      {/* Constraints added here: Max height of approx 5 rows (320px) before scrolling */}
      <div className="flex-1 overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0f1218] z-10">
            <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-slate-500 font-bold shadow-sm">
              <th className="px-6 py-4">TIMESTAMP</th>
              {['SWG 01', 'SWG 02', 'SWG 03'].map((swg, i) => (
                <th key={swg} className="px-4 py-4 text-center border-l border-white/5">
                  <span className={i === 0 ? 'text-emerald-500' : i === 1 ? 'text-purple-500' : 'text-amber-500'}>{swg}</span>
                  <div className="flex justify-around mt-2 opacity-50 gap-2 font-mono-custom text-[8px]">
                    <span className="w-10">P</span>
                    <span className="w-10">Q</span>
                    <span className="w-10">SOC</span>
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-right border-l border-white/5">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono-custom text-xs">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-600 uppercase tracking-widest italic opacity-50">
                  DATABASE_EMPTY
                </td>
              </tr>
            ) : (
              history.map((entry) => {
                const isEditing = editingId === entry.id;
                const data = isEditing ? tempValues! : entry;
                
                return (
                  <tr key={entry.id} className={`${isEditing ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'} transition-colors group`}>
                    <td className="px-6 py-4 text-slate-400">
                       {entry.timestamp}
                    </td>
                    
                    {['SWG01', 'SWG02', 'SWG03'].map((unitId) => (
                      <td key={unitId} className="px-4 py-4 border-l border-white/5">
                        <div className="flex justify-around font-bold gap-2">
                          {isEditing ? (
                            <>
                              <input type="number" className="w-10 bg-black border border-white/10 rounded px-1 text-center text-white text-[10px]" value={data.units[unitId].active} onChange={(e) => updateTempValue(unitId, 'active', parseInt(e.target.value) || 0)} />
                              <input type="number" className="w-10 bg-black border border-white/10 rounded px-1 text-center text-slate-500 text-[10px]" value={data.units[unitId].reac} onChange={(e) => updateTempValue(unitId, 'reac', parseInt(e.target.value) || 0)} />
                              <input type="number" className="w-10 bg-black border border-white/10 rounded px-1 text-center text-blue-400 text-[10px]" value={data.units[unitId].soc} onChange={(e) => updateTempValue(unitId, 'soc', parseInt(e.target.value) || 0)} />
                            </>
                          ) : (
                            <>
                              <span className="text-white w-10 text-center">{data.units[unitId].active}</span>
                              <span className="text-slate-500 w-10 text-center">{data.units[unitId].reac}</span>
                              <span className={`${unitId === 'SWG01' ? 'text-emerald-500' : unitId === 'SWG02' ? 'text-purple-500' : 'text-amber-500'} w-10 text-center`}>
                                {data.units[unitId].soc}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    ))}

                    <td className="px-6 py-4 border-l border-white/5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isEditing ? (
                          <>
                            <button onClick={saveEditing} className="text-emerald-500 hover:scale-110 transition-transform"><Check size={16} /></button>
                            <button onClick={cancelEditing} className="text-rose-500 hover:scale-110 transition-transform"><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(entry)} className="text-slate-600 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                            {/* Explicit Delete Logic Wired Here */}
                            <button onClick={() => onDelete(entry.id)} className="text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
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
