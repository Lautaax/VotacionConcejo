import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expediente, Voto } from '../types';
import { FileText, Download, Filter, Search, ChevronDown, CheckCircle2, XCircle, ChevronUp, Users2, Check, X, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function HistoryList() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [filtered, setFiltered] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'aprobado' | 'rechazado'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expedienteVotes, setExpedienteVotes] = useState<Record<string, Voto[]>>({});
  const [loadingVotes, setLoadingVotes] = useState<string | null>(null);

  const fetchVotes = async (expedienteId: string) => {
    if (expedienteVotes[expedienteId]) return;
    setLoadingVotes(expedienteId);
    const q = query(collection(db, 'votos'), where('expedienteId', '==', expedienteId));
    const snap = await getDocs(q);
    const data = snap.docs.map(doc => doc.data() as Voto);
    setExpedienteVotes(prev => ({ ...prev, [expedienteId]: data }));
    setLoadingVotes(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchVotes(id);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const q = query(
        collection(db, 'expedientes'),
        where('status', 'in', ['aprobado', 'rechazado']),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expediente));
      setExpedientes(data);
      setFiltered(data);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    let result = expedientes;
    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter);
    }
    if (searchTerm) {
      result = result.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    setFiltered(result);
  }, [statusFilter, searchTerm, expedientes]);

  const exportPDF = async (expediente: Expediente) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Acta de Votación Legislativa', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Expediente: ${expediente.title}`, 20, 40);
    doc.text(`Fecha: ${format(expediente.createdAt.toDate(), 'PPP', { locale: es })}`, 20, 50);
    doc.text(`Resultado: ${expediente.status.toUpperCase()}`, 20, 60);

    const votesQ = query(collection(db, 'votos'), where('expedienteId', '==', expediente.id));
    const votesSnap = await getDocs(votesQ);
    const votes = votesSnap.docs.map(d => d.data() as Voto);

    autoTable(doc, {
      startY: 70,
      head: [['Concejal', 'Voto', 'Fecha/Hora']],
      body: votes.map(v => [
        v.concejalName,
        v.voto.toUpperCase(),
        format(v.createdAt.toDate(), 'Pp', { locale: es })
      ]),
      theme: 'grid',
      headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255], fontStyle: 'bold' }
    });
    doc.save(`acta-${expediente.id}.pdf`);
  };

  const exportCSV = async (expediente: Expediente) => {
    const votesQ = query(collection(db, 'votos'), where('expedienteId', '==', expediente.id));
    const votesSnap = await getDocs(votesQ);
    const votes = votesSnap.docs.map(d => d.data() as Voto);

    const headers = ['Concejal', 'Voto', 'Fecha/Hora'];
    const rows = votes.map(v => [
      v.concejalName,
      v.voto.toUpperCase(),
      format(v.createdAt.toDate(), 'Pp', { locale: es })
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `votos-${expediente.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllHistory = async () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Resumen de Sesiones Legislativas', 105, 20, { align: 'center' });

    autoTable(doc, {
      startY: 40,
      head: [['Título', 'Estado', 'Fecha']],
      body: expedientes.map(e => [
        e.title,
        e.status.toUpperCase(),
        format(e.createdAt.toDate(), 'P', { locale: es })
      ]),
    });

    doc.save('historial-legislativo.pdf');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#0c0c0e] p-6 rounded-3xl border border-white/10 shadow-xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-teal-500 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar en el archivo histórico..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 sm:flex-none w-full sm:w-auto">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select 
              className="w-full sm:w-auto appearance-none bg-white/5 border border-white/10 rounded-xl pl-12 pr-10 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-all cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">Todos los registros</option>
              <option value="aprobado">Sancionados</option>
              <option value="rechazado">Rechazados</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          <button 
            onClick={exportAllHistory}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-teal-500/10 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Resumen Total</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="py-32 text-center text-slate-500 font-mono text-xs uppercase tracking-[0.2em] animate-pulse">Consultando archivos parlamentarios...</div>
        ) : filtered.length === 0 ? (
          <div className="py-32 text-center space-y-4 bg-[#0c0c0e] border border-dashed border-white/10 rounded-3xl">
            <Search className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-500 font-light text-sm">No se encontraron registros que coincidan con los criterios.</p>
          </div>
        ) : (
          filtered.map((exp) => (
            <div key={exp.id} className="group flex flex-col gap-0">
              <div className={cn(
                "bg-[#0c0c0e] border border-white/10 hover:border-teal-500/30 hover:bg-[#0f0f12] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all duration-300",
                expandedId === exp.id ? "rounded-t-2xl border-b-0" : "rounded-2xl"
              )}>
                <div className="flex items-start gap-5 cursor-pointer flex-1" onClick={() => toggleExpand(exp.id)}>
                  <div className={cn(
                    "mt-1 p-3 rounded-xl border transition-all duration-500",
                    exp.status === 'aprobado' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                  )}>
                    {exp.status === 'aprobado' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 transition-transform group-hover:rotate-12" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-light text-white group-hover:text-teal-400 transition-colors tracking-tight">
                      {exp.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="text-[10px] text-teal-500/60 font-black uppercase tracking-wider">Autor: {exp.author || '-'}</p>
                      <p className="text-[10px] text-slate-500 font-mono tracking-tighter capitalize">{format(exp.createdAt.toDate(), 'PPP', { locale: es })}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleExpand(exp.id)}
                    className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-teal-400 transition-all"
                  >
                    {expandedId === exp.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="flex items-center bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                    <button 
                      onClick={() => exportPDF(exp)}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 transition-all font-black uppercase text-[10px] tracking-widest border-r border-white/5"
                      title="Descargar Acta PDF"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button 
                      onClick={() => exportCSV(exp)}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 transition-all font-black uppercase text-[10px] tracking-widest"
                      title="Exportar Votos CSV"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === exp.id && (
                <div className="bg-[#0f0f12] border-x border-b border-white/10 rounded-b-2xl p-6 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2 text-white/40">
                        <Users2 className="w-4 h-4" />
                        <span className="text-[10px] uppercase font-black tracking-widest">Escrutinio Definitivo</span>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-500">
                          <Check className="w-3 h-3" /> {expedienteVotes[exp.id]?.filter(v => v.voto === 'si').length || 0}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-red-500">
                          <X className="w-3 h-3" /> {expedienteVotes[exp.id]?.filter(v => v.voto === 'no').length || 0}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-500">
                          <Minus className="w-3 h-3" /> {expedienteVotes[exp.id]?.filter(v => v.voto === 'abstencion').length || 0}
                        </div>
                      </div>
                    </div>

                    {loadingVotes === exp.id ? (
                      <div className="py-8 text-center text-slate-600 font-mono text-[10px] uppercase tracking-widest animate-pulse">Cargando desglose...</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {expedienteVotes[exp.id]?.map((v, idx) => (
                          <div key={idx} className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex items-center justify-between">
                            <span className="text-xs text-white/70 font-medium truncate">{v.concejalName}</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                              v.voto === 'si' ? "bg-emerald-500/10 text-emerald-400" :
                              v.voto === 'no' ? "bg-red-500/10 text-red-400" :
                              "bg-amber-500/10 text-amber-400"
                            )}>{v.voto}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
