import { useState, useMemo, useEffect } from 'react';
import { PRIORITY_COLORS } from '../constants';
import { Task, Priority, TeamMember } from '../types';
import {
  Layers,
  Activity,
  Clock,
  Users,
  Search,
  Settings,
  X,
  Calendar,
  BarChart2,
  PieChart,
  TrendingUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Mail,
  Filter
} from 'lucide-react';

interface PlannerCanvasProps {
  tasks: Task[];
  teamMembers: TeamMember[];
}

interface WidgetConfig {
  id: number;
  title: string;
  dataSource: 'subject' | 'priority' | 'user_workload';
  vizType: 'bar' | 'line' | 'pie' | 'area';
  filterSubject: string;
  filterPriority: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

export default function PlannerCanvas({ tasks, teamMembers }: PlannerCanvasProps) {
  // --- 1. Global Filter States ---
  const [dashSearch, setDashSearch] = useState<string>('');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [globalSubjectFilter, setGlobalSubjectFilter] = useState<string>('all');
  const [globalPriorityFilter, setGlobalPriorityFilter] = useState<string>('all');
  
  // NIEUW: Jaar- en Maandfilters om data over meerdere jaren te scheiden
  const [yearFilter, setYearFilter] = useState<string>('2026'); // Standaard op huidige opstartjaar
  const [monthFilter, setMonthFilter] = useState<string>('all');
  
  // Timeframe Scale and Specific Daily Date Context
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Haal dynamisch alle unieke jaren op die in de database voorkomen
  const uniqueYears = useMemo(() => {
    const yearsSet = new Set<string>();
    tasks.forEach(t => {
      if (t.date) {
        const y = t.date.split('-')[0];
        if (y) yearsSet.add(y);
      }
    });
    // Zorg dat in ieder geval het huidige jaar erin staat als fallback
    if (yearsSet.size === 0) yearsSet.add('2026');
    return Array.from(yearsSet).sort();
  }, [tasks]);

  // Vind beschikbare datums in task history voor Daily filters
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    tasks.forEach(t => { if (t.date) datesSet.add(t.date); });
    const sorted = Array.from(datesSet).sort();
    return sorted.length > 0 ? sorted : ['2026-05-26'];
  }, [tasks]);

  const [selectedDate, setSelectedDate] = useState<string>('2026-05-26');
  
  // Sync selectedDate met beschikbare datums
  useEffect(() => {
    if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  // Extract unique weeks uit database
  const uniqueWeeks = useMemo(() => {
    const weeksSet = new Set<number>();
    tasks.forEach(t => { 
      // Filter alvast op geselecteerd jaar om de weeklijst overzichtelijk te houden
      if (t.week && t.date && t.date.startsWith(yearFilter)) {
        weeksSet.add(t.week); 
      }
    });
    return Array.from(weeksSet).sort((a, b) => a - b);
  }, [tasks, yearFilter]);

  // Helper om onderwerpen te categoriseren
  const getTaskSubject = (task: Task) => {
    if (task.subject) return task.subject;
    if (task.description === 'Verlof' || task.description === 'Leave') return 'Verlof';
    if (task.description === 'Training' || task.description === 'Opleiding') return 'Training';
    if (task.description === 'Meeting' || task.description.toLowerCase().includes('meeting')) return 'Meeting';
    return 'Todo';
  };

  // --- 2. Calculate Consolidated Global Tasks pool (Met de nieuwe Jaar/Maand filters) ---
  const globalFilteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.date) return false;
      const [y, m, d] = task.date.split('-');
      const taskMonthIndex = parseInt(m, 10) - 1; // 0-11 index

      // 1. HARD JAAR FILTER (Voorkomt vermenging van 2026 met toekomstige jaren)
      if (yearFilter !== 'all' && y !== yearFilter) return false;

      // 2. MAAND FILTER
      if (monthFilter !== 'all' && taskMonthIndex.toString() !== monthFilter) return false;

      // Zoekterm filter
      if (dashSearch) {
        const term = dashSearch.toLowerCase();
        const taskDesc = task.description.toLowerCase();
        const taskMember = (teamMembers.find(m => m.id === task.teamMemberId)?.name || '').toLowerCase();
        if (!taskDesc.includes(term) && !taskMember.includes(term)) return false;
      }

      if (personFilter !== 'all' && task.teamMemberId !== personFilter) return false;
      
      // Week filter (alleen toepassen als we niet puur per dag kijken)
      if (timeframe !== 'daily' && weekFilter !== 'all' && task.week.toString() !== weekFilter) return false;

      if (globalSubjectFilter !== 'all' && getTaskSubject(task) !== globalSubjectFilter) return false;
      if (globalPriorityFilter !== 'all' && task.priority !== globalPriorityFilter) return false;

      if (timeframe === 'daily' && task.date !== selectedDate) return false;

      return true;
    });
  }, [tasks, dashSearch, personFilter, weekFilter, globalSubjectFilter, globalPriorityFilter, timeframe, selectedDate, yearFilter, monthFilter]);

  // --- 3. Top Metrics Row ---
  const totalTasksCount = globalFilteredTasks.length;

  const criticalAndHighCount = useMemo(() => {
    return globalFilteredTasks.filter(t => t.priority === Priority.CRITICAL || t.priority === Priority.HIGH).length;
  }, [globalFilteredTasks]);

  const totalHoursPlanned = useMemo(() => {
    let sumHrs = 0;
    globalFilteredTasks.forEach(task => {
      const [sh, sm] = task.startTime.split(':').map(Number);
      const [eh, em] = task.endTime.split(':').map(Number);
      const decS = sh + (sm || 0) / 60;
      const decE = eh + (em || 0) / 60;
      if (decE > decS) sumHrs += (decE - decS);
    });
    return Math.round(sumHrs);
  }, [globalFilteredTasks]);

  const activePlannersCount = useMemo(() => {
    const ids = new Set<string>();
    globalFilteredTasks.forEach(t => ids.add(t.teamMemberId));
    return ids.size === 0 ? Math.min(teamMembers.length, 5) : ids.size;
  }, [globalFilteredTasks]);

  // --- 4. DYNAMISCHE VERLOFSALDI LOGICA (JAAR EN MAAND REACTIEF) ---
  const leaveReportData = useMemo(() => {
    return teamMembers.map(member => {
      const memberLeaveTasks = tasks.filter(task => {
        if (task.teamMemberId !== member.id) return false;
        if (getTaskSubject(task) !== 'Verlof') return false;
        if (!task.date) return false;
        
        const [y, m, d] = task.date.split('-');
        const taskMonthIndex = parseInt(m, 10) - 1;

        if (yearFilter !== 'all' && y !== yearFilter) return false;
        if (monthFilter !== 'all' && taskMonthIndex.toString() !== monthFilter) return false;
        if (timeframe === 'daily' && task.date !== selectedDate) return false;
        if (timeframe === 'weekly' && weekFilter !== 'all' && task.week.toString() !== weekFilter) return false;
        
        return true;
      });

      let totalHours = 0;
      memberLeaveTasks.forEach(task => {
        const [sh, sm] = task.startTime.split(':').map(Number);
        const [eh, em] = task.endTime.split(':').map(Number);
        const decS = sh + (sm || 0) / 60;
        const decE = eh + (em || 0) / 60;
        if (decE > decS) totalHours += (decE - decS);
      });

      return {
        id: member.id,
        name: member.name,
        initials: member.initials,
        color: member.color,
        email: (member as any).email || 'Geen mail',
        hours: Math.round(totalHours * 10) / 10,
        days: Math.round((totalHours / 8) * 10) / 10,
        count: memberLeaveTasks.length
      };
    });
  }, [tasks, teamMembers, timeframe, selectedDate, weekFilter, yearFilter, monthFilter]);

  // Bins / Assen-indeling voor trendgrafieken
  const timeframeBins = useMemo(() => {
    if (timeframe === 'daily') {
      return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    } else if (timeframe === 'weekly') {
      return ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
    } else {
      // MAANDELIJKS MODE: Toon nu strak de 12 kalendermaanden ipv willekeurige weken!
      return MONTH_NAMES;
    }
  }, [timeframe]);

  const handleOffsetDate = (offset: number) => {
    const curIdx = uniqueDates.indexOf(selectedDate);
    if (curIdx !== -1) {
      const nextIdx = (curIdx + offset + uniqueDates.length) % uniqueDates.length;
      setSelectedDate(uniqueDates[nextIdx]);
    }
  };

  const getTasksCountForBin = (bin: string, taskPool: Task[]) => {
    if (timeframe === 'daily') {
      const binHr = parseInt(bin.split(':')[0], 10);
      return taskPool.filter(t => {
        const startH = parseInt(t.startTime.split(':')[0], 10);
        return startH >= binHr && startH < binHr + 2;
      }).length;
    } else if (timeframe === 'weekly') {
      const matchDays = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
      return taskPool.filter(t => {
        const dayIdx = new Date(t.date).getDay();
        return matchDays[dayIdx] === bin;
      }).length;
    } else {
      // Maandelijks verloop over de 12 maanden
      const binMonthIndex = MONTH_NAMES.indexOf(bin);
      return taskPool.filter(t => {
        if (!t.date) return false;
        const m = parseInt(t.date.split('-')[1], 10) - 1;
        return m === binMonthIndex;
      }).length;
    }
  };

  // Dashboard configuratie
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 1, title: 'Totaal Taken per Medewerker', dataSource: 'user_workload', vizType: 'bar', filterSubject: 'all', filterPriority: 'all' },
    { id: 2, title: 'Onderwerpen Verdeling', dataSource: 'subject', vizType: 'pie', filterSubject: 'all', filterPriority: 'all' },
    { id: 3, title: 'Trend Urgente & Hoge Prioriteit', dataSource: 'priority', vizType: 'line', filterSubject: 'all', filterPriority: 'all' },
    { id: 4, title: 'Prioriteiten Volume Verloop', dataSource: 'priority', vizType: 'area', filterSubject: 'all', filterPriority: 'all' }
  ]);

  const [editingWidgetId, setEditingWidgetId] = useState<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ widgetId: number; label: string; value: number; extra?: string; x: number; y: number; } | null>(null);

  return (
    <div id="analytics-canvas-root" className="space-y-8 pb-16 relative">

      {/* Hero Header Tab Panel */}
      <div id="analytics-header-row" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 rounded bg-blue-600 inline-block" />
            Uitgebreid Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Controleer werkdrukken, verlofsaldi en taakfrequenties over meerdere jaren.</p>
        </div>

        {/* Timeframe Scale Selector */}
        <div id="timeframe-toggles" className="bg-slate-100 hover:bg-slate-150 rounded-xl p-1 flex items-center select-none w-fit border border-slate-200/50">
          <button onClick={() => setTimeframe('daily')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Dagelijks</button>
          <button onClick={() => setTimeframe('weekly')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Wekelijks</button>
          <button onClick={() => setTimeframe('monthly')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Maandelijks</button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div id="stats-grid-4cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0"><Layers className="w-5.5 h-5.5" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">GEFILTERDE TAKEN</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{totalTasksCount}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100 shadow-sm shrink-0"><Activity className="w-5.5 h-5.5" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">HOOG / KRITIEK</p>
            <h3 className="text-xl font-black text-rose-550 tracking-tight mt-1.5 truncate">{criticalAndHighCount}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-650 border border-yellow-100 shadow-sm shrink-0"><Clock className="w-5.5 h-5.5" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">PLANNINGSUREN</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{totalHoursPlanned} uur</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0"><Users className="w-5.5 h-5.5" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">BEZETTE PERSONEN</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{activePlannersCount}</h3>
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div id="dashboard-filters" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:max-w-xs shrink-0">
            <input type="text" placeholder="Zoek op omschrijving of naam..." value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white placeholder-slate-400" />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full justify-end">
            
            {/* NIEUW: JAAR SELECTOR */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">📅 JAAR</span>
              <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setWeekFilter('all'); }} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-blue-600 focus:outline-none">
                <option value="all">Alle jaren</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* NIEUW: MAAND SELECTOR */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">📆 MAAND</span>
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none">
                <option value="all">Alle maanden</option>
                {MONTH_NAMES.map((name, idx) => <option key={idx} value={idx.toString()}>{name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">👥 MEDEWERKER</span>
              <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none">
                <option value="all">👥 Iedereen</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {timeframe === 'weekly' && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Wk</span>
                <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none font-mono">
                  <option value="all">Alle Weken</option>
                  {uniqueWeeks.map((wk) => <option key={wk} value={wk.toString()}>Wk {wk}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {timeframe === 'daily' && (
          <div id="daily-scroller-box" className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-550 shrink-0" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DAGELIJKS FILTER CONTEXT</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleOffsetDate(-1)} className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-white border border-slate-250 rounded-lg px-3 py-1 text-xs font-bold font-mono text-slate-750 focus:outline-none">
                {uniqueDates.filter(d => d.startsWith(yearFilter)).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button onClick={() => handleOffsetDate(1)} className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic 4-Chart Grid */}
      <div id="dynamic-widgets-grid" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {widgets.map((widget, widIdx) => {
          const widgetFilteredTasks = tasks.filter(task => {
            if (!task.date) return false;
            const [y, m, d] = task.date.split('-');
            if (yearFilter !== 'all' && y !== yearFilter) return false;
            if (monthFilter !== 'all' && (parseInt(m, 10) - 1).toString() !== monthFilter) return false;

            if (dashSearch) {
              const term = dashSearch.toLowerCase();
              const dM = (teamMembers.find(m => m.id === task.teamMemberId)?.name || '').toLowerCase();
              if (!task.description.toLowerCase().includes(term) && !dM.includes(term)) return false;
            }
            if (personFilter !== 'all' && task.teamMemberId !== personFilter) return false;
            if (timeframe === 'weekly' && weekFilter !== 'all' && task.week.toString() !== weekFilter) return false;
            if (timeframe === 'daily' && task.date !== selectedDate) return false;
            if (globalSubjectFilter !== 'all' && getTaskSubject(task) !== globalSubjectFilter) return false;
            if (globalPriorityFilter !== 'all' && task.priority !== globalPriorityFilter) return false;
            if (widget.filterSubject !== 'all' && getTaskSubject(task) !== widget.filterSubject) return false;
            if (widget.filterPriority !== 'all' && task.priority !== widget.filterPriority) return false;
            return true;
          });

          const isTrend = widget.vizType === 'line' || widget.vizType === 'area';
          const chartDataItems = (() => {
            if (isTrend) {
              return timeframeBins.map(bin => ({
                label: timeframe === 'monthly' ? bin.substring(0, 3) : bin, // Korte maandnaam voor grafiek-as
                fullName: bin,
                value: getTasksCountForBin(bin, widgetFilteredTasks),
                color: widget.dataSource === 'subject' ? '#3b82f6' : widget.dataSource === 'priority' ? '#f43f5e' : '#8b5cf6'
              }));
            } else {
              if (widget.dataSource === 'subject') {
                const subjects: ('Todo' | 'Verlof' | 'Training' | 'Meeting')[] = ['Todo', 'Verlof', 'Training', 'Meeting'];
                const subjectColors = { Todo: '#3b82f6', Verlof: '#fb7185', Training: '#c084fc', Meeting: '#2dd4bf' };
                return subjects.map(sub => ({
                  label: sub, fullName: sub, value: widgetFilteredTasks.filter(t => getTaskSubject(t) === sub).length, color: subjectColors[sub]
                }));
              } else if (widget.dataSource === 'priority') {
                const priorityLevels = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW];
                const priorityColors = { [Priority.CRITICAL]: '#f43f5e', [Priority.HIGH]: '#f97316', [Priority.MEDIUM]: '#eab308', [Priority.LOW]: '#10b981' };
                return priorityLevels.map(lvl => ({
                  label: lvl, fullName: lvl === Priority.CRITICAL ? 'Urgent' : lvl.toLowerCase(), value: widgetFilteredTasks.filter(t => t.priority === lvl).length, color: priorityColors[lvl]
                }));
              } else {
                return teamMembers.map(m => ({
                  label: m.initials, fullName: m.name, value: widgetFilteredTasks.filter(t => t.teamMemberId === m.id).length, color: '#6366f1'
                })).filter(u => u.value > 0);
              }
            }
          })();

          const maxChartValue = Math.max(...chartDataItems.map(d => d.value), 4);
          const totalWidgetTasksCount = widgetFilteredTasks.length;

          const pieSlices = (() => {
            if (widget.vizType !== 'pie') return [];
            let currentAngle = 0;
            const radius = 55, circ = 2 * Math.PI * radius;
            const total = chartDataItems.reduce((acc, c) => acc + c.value, 0) || 1;
            return chartDataItems.map((item) => {
              const ratio = item.value / total, angle = ratio * 360, offset = circ - (ratio * circ), rotation = currentAngle - 90;
              currentAngle += angle;
              return { ...item, strokeDasharray: circ, strokeDashoffset: offset, rotation, ratio: Math.round(ratio * 100) };
            });
          })();

          return (
            <div key={widget.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 h-10">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-3.5 rounded-full" style={{ backgroundColor: widIdx === 0 ? '#3b82f6' : widIdx === 1 ? '#ec4899' : widIdx === 2 ? '#eab308' : '#10b981' }} />
                    {widget.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400 font-mono font-medium">
                    <span className="capitalize">{widget.dataSource.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{totalWidgetTasksCount} geanalyseerd</span>
                  </div>
                </div>
                <button onClick={() => setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)} className={`p-1.5 rounded-lg border transition-all cursor-pointer ${editingWidgetId === widget.id ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}><Settings className="w-3.5 h-3.5" /></button>
              </div>

              {editingWidgetId === widget.id && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-[11px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Titel Grafiek</label>
                      <input type="text" value={widget.title} onChange={(e) => setWidgets(widgets.map(w => w.id === widget.id ? { ...w, title: e.target.value } : w))} className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Gegevensbron</label>
                      <select value={widget.dataSource} onChange={(e) => setWidgets(widgets.map(w => w.id === widget.id ? { ...w, dataSource: e.target.value as any } : w))} className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
                        <option value="subject">📁 Taken per Onderwerp</option>
                        <option value="priority">⚡ Taken per Prioriteit</option>
                        <option value="user_workload">👥 Belasting per Medewerker</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Visualisatie Type</label>
                      <select value={widget.vizType} onChange={(e) => setWidgets(widgets.map(w => w.id === widget.id ? { ...w, vizType: e.target.value as any } : w))} className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
                        <option value="bar">📊 Staafdiagram (Bar)</option>
                        <option value="pie">🍩 Cirkeldiagram (Pie/Donut)</option>
                        <option value="line">📈 Trend Lijndiagram (Line)</option>
                        <option value="area">🏔️ Vlakdiagram (Area)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="h-44 w-full flex items-center justify-center relative bg-transparent">
                {widget.vizType === 'bar' && (
                  <div className="w-full h-full flex flex-col justify-between pt-1">
                    {chartDataItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs"><BarChart2 className="w-8 h-8 opacity-25" /><span>Geen gegevens</span></div>
                    ) : (
                      <div className="flex-1 flex items-end justify-between gap-3 px-2 pt-2 pb-6 border-b border-slate-100 relative">
                        {chartDataItems.map((item, id) => {
                          const percentage = Math.max((item.value / maxChartValue) * 100, 4);
                          return (
                            <div key={id} className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer" onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setActiveTooltip({ widgetId: widget.id, label: item.fullName, value: item.value, x: rect.left + rect.width / 2, y: rect.top - 38 }); }} onMouseLeave={() => setActiveTooltip(null)}>
                              <span className="text-[9px] font-black text-slate-700 tracking-tight mb-1 font-mono">{item.value}</span>
                              <div style={{ height: `${percentage}%`, backgroundColor: item.color }} className="w-full min-w-[10px] max-w-[40px] rounded-t-lg transition-all duration-300" />
                              <span className="absolute -bottom-5 text-[9px] font-bold text-slate-450 tracking-tight w-full text-center truncate px-0.5">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {widget.vizType === 'pie' && (
                  <div className="w-full h-full flex items-center justify-center gap-6 px-1">
                    {chartDataItems.every(d => d.value === 0) ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs"><PieChart className="w-8 h-8 opacity-25" /><span>Geen gegevens</span></div>
                    ) : (
                      <>
                        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                          <svg width="110" height="110" viewBox="0 0 150 150" className="transform -rotate-90">
                            <circle cx="75" cy="75" r="55" fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                            {pieSlices.map((slice, i) => slice.value > 0 && (
                              <circle key={i} cx="75" cy="75" r="55" fill="transparent" stroke={slice.color} strokeWidth="14" strokeDasharray={slice.strokeDasharray} strokeDashoffset={slice.strokeDashoffset} className="transition-all duration-300 cursor-pointer hover:stroke-[17px]" style={{ transformOrigin: '50% 50%', transform: `rotate(${slice.rotation}deg)` }} onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setActiveTooltip({ widgetId: widget.id, label: slice.fullName, value: slice.value, extra: `${slice.ratio}%`, x: rect.left + rect.width / 2, y: rect.top - 38 }); }} onMouseLeave={() => setActiveTooltip(null)} />
                            ))}
                          </svg>
                          <div className="absolute text-center bg-transparent pointer-events-none">
                            <p className="text-xl font-black text-slate-800 tracking-tight leading-none">{totalWidgetTasksCount}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">TAKEN</p>
                          </div>
                        </div>
                        <div className="flex-1 max-w-[200px] space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar text-[10px]">
                          {pieSlices.map((slice, i) => slice.value > 0 && (
                            <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                                <span className="truncate text-slate-650 font-bold">{slice.fullName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono"><span className="text-slate-450">({slice.ratio}%)</span><span className="font-extrabold">{slice.value}</span></div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isTrend && (
                  <div className="w-full h-full flex flex-col justify-between font-sans relative">
                    {chartDataItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs"><TrendingUp className="w-8 h-8 opacity-25" /><span>Geen verloopdata</span></div>
                    ) : (
                      (() => {
                        const svgW = 400, svgH = 170, padX = 25, padY = 20, chartW = svgW - padX * 2, chartH = svgH - padY * 2;
                        const stepX = chartW / Math.max(timeframeBins.length - 1, 1);
                        const pointsStr = chartDataItems.map((item, id) => {
                          const x = padX + id * stepX;
                          return { x, y: svgH - padY - (item.value / maxChartValue) * chartH, ...item };
                        });
                        const pathD = pointsStr.reduce((acc, p, i) => acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                        const areaD = `${pathD} L ${pointsStr[pointsStr.length - 1].x} ${svgH - padY} L ${pointsStr[0].x} ${svgH - padY} Z`;
                        const themeStroke = widget.id === 3 ? '#ec4899' : '#10b981';

                        return (
                          <div className="w-full h-full flex flex-col">
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
                              <defs>
                                <linearGradient id={`grad-area-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={themeStroke} stopOpacity="0.4" /><stop offset="100%" stopColor={themeStroke} stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <line x1={padX} y1={padY} x2={svgW - padX} y2={padY} stroke="#f1f5f9" />
                              <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="#e2e8f0" />
                              {widget.vizType === 'area' && <path d={areaD} fill={`url(#grad-area-${widget.id})`} />}
                              <path d={pathD} fill="none" stroke={themeStroke} strokeWidth="3" strokeLinecap="round" />
                              {pointsStr.map((item, idx) => (
                                <circle key={idx} cx={item.x} cy={item.y} r="4" fill={themeStroke} stroke="white" strokeWidth="1.5" className="cursor-pointer" onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setActiveTooltip({ widgetId: widget.id, label: item.fullName, value: item.value, x: rect.left + 5, y: rect.top - 38 }); }} onMouseLeave={() => setActiveTooltip(null)} />
                              ))}
                              {pointsStr.map((item, idx) => (
                                <text key={idx} x={item.x} y={svgH - 4} textAnchor="middle" className="text-[7px] fill-slate-400 font-bold">{item.label}</text>
                              ))}
                            </svg>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                <span>🟢 {widget.vizType.toUpperCase()} MODE ACTIVE</span>
                <span className="font-sans text-blue-550 font-bold flex items-center gap-0.5">Live Sync <ArrowUpRight className="w-2.5 h-2.5" /></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- HR-SECTIE: VERLOFSALDI & BEZETTINGSMATRIX --- */}
      <div id="leave-balances-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">Verlofsaldi & Bezettingsgraad</h3>
              <p className="text-xs text-slate-400 font-medium">Berekend op basis van de geselecteerde tijds- en jaarfilters (o.b.v. 8u werkdag)</p>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-blue-50 text-blue-600 border border-blue-100 font-bold px-3 py-1 rounded-xl uppercase tracking-wider">
            {yearFilter !== 'all' ? `Rapportage ${yearFilter}` : 'Alle Jaren Combinatie'}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[10px] font-bold select-none">
                <th className="py-3 px-4">Medewerker</th>
                <th className="py-3 px-4">E-mailadresse</th>
                <th className="py-3 px-4 text-center">Geregistreerde Verlofblokken</th>
                <th className="py-3 px-4 text-center">Totaal Uren Verlof</th>
                <th className="py-3 px-4 text-right pr-6">Opgenomen Dagen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700 text-xs font-medium">
              {leaveReportData.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${report.color.split(' ')[0]}`}>
                      {report.initials}
                    </div>
                    <span className="font-bold text-slate-800">{report.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs font-normal">
                    {report.email}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600">
                    {report.count}x
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${report.hours > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-50 text-slate-400'}`}>
                      {report.hours} u
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right pr-6 font-mono font-black text-sm text-slate-800">
                    <span className={report.days > 0 ? 'text-rose-600' : 'text-slate-400 font-normal'}>
                      {report.days} {report.days === 1 ? 'dag' : 'dagen'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Tooltip Hover Block */}
      {activeTooltip && (
        <div style={{ position: 'fixed', left: `${activeTooltip.x}px`, top: `${activeTooltip.y}px`, transform: 'translate(-50%, -10px)' }} className="bg-slate-900/95 backdrop-blur-sm pr-3 pl-3.5 py-2 rounded-xl text-white shadow-xl flex items-center gap-2 pointer-events-none z-50 border border-white/10">
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-black uppercase text-white/50 tracking-wider leading-none">{activeTooltip.label}</p>
            <p className="text-xs font-black tracking-tight flex items-center gap-1.5 mt-0.5 leading-none">
              <span className="text-sky-350">{activeTooltip.value} taken</span>
              {activeTooltip.extra && <span className="text-[9px] px-1 bg-white/10 rounded font-semibold text-white/80">{activeTooltip.extra}</span>}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
