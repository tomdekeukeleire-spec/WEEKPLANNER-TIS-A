import { useState, useMemo, useEffect } from 'react';
import { teamMembers, PRIORITY_COLORS } from '../constants';
import { Task, Priority } from '../types';
import {
  Layers,
  Activity,
  Clock,
  Users,
  Search,
  Settings,
  X,
  Sliders,
  Calendar,
  BarChart2,
  PieChart,
  TrendingUp,
  Filter,
  ArrowUpRight,
  TrendingDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PlannerCanvasProps {
  tasks: Task[];
}

interface WidgetConfig {
  id: number;
  title: string;
  dataSource: 'subject' | 'priority' | 'user_workload';
  vizType: 'bar' | 'line' | 'pie' | 'area';
  filterSubject: string; // 'all' or specific
  filterPriority: string; // 'all' or specific
}

export default function PlannerCanvas({ tasks }: PlannerCanvasProps) {
  // --- 1. Global Filter States ---
  const [dashSearch, setDashSearch] = useState<string>('');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [globalSubjectFilter, setGlobalSubjectFilter] = useState<string>('all');
  const [globalPriorityFilter, setGlobalPriorityFilter] = useState<string>('all');
  
  // Timeframe Scale and Specific Daily Date Context
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Find standard available dates in task history to allow meaningful Daily filters
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    tasks.forEach(t => { if (t.date) datesSet.add(t.date); });
    const sorted = Array.from(datesSet).sort();
    return sorted.length > 0 ? sorted : ['2026-05-26'];
  }, [tasks]);

  // Track the selected date for 'daily' timeframe. Initialized to second day of seed or first available.
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-26');
  
  // Sync selectedDate with available dates if it gets out of bounds
  useEffect(() => {
    if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  // Extract unique weeks from task registry for week filter
  const uniqueWeeks = useMemo(() => {
    const weeksSet = new Set<number>();
    tasks.forEach(t => { if (t.week) weeksSet.add(t.week); });
    return Array.from(weeksSet).sort((a, b) => a - b);
  }, [tasks]);

  // --- Helper to extract Subjects ---
  const getTaskSubject = (task: Task) => {
    if (task.subject) return task.subject;
    if (task.description === 'Verlof' || task.description === 'Leave') return 'Verlof';
    if (task.description === 'Training' || task.description === 'Opleiding') return 'Training';
    if (task.description === 'Meeting' || task.description.toLowerCase().includes('meeting')) return 'Meeting';
    return 'Todo';
  };

  // --- 2. Calculate Consolidated Global Tasks pool ---
  const globalFilteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search Box term match
      if (dashSearch) {
        const term = dashSearch.toLowerCase();
        const taskDesc = task.description.toLowerCase();
        const taskMember = (teamMembers.find(m => m.id === task.teamMemberId)?.name || '').toLowerCase();
        if (!taskDesc.includes(term) && !taskMember.includes(term)) return false;
      }

      // Person target context
      if (personFilter !== 'all' && task.teamMemberId !== personFilter) return false;

      // Week filter
      if (weekFilter !== 'all' && task.week.toString() !== weekFilter) return false;

      // Global Subject filter
      if (globalSubjectFilter !== 'all') {
        const subjectOfTask = getTaskSubject(task);
        if (subjectOfTask !== globalSubjectFilter) return false;
      }

      // Global Priority filter
      if (globalPriorityFilter !== 'all' && task.priority !== globalPriorityFilter) return false;

      // Time scale check (Daily isolation)
      if (timeframe === 'daily') {
        if (task.date !== selectedDate) return false;
      }

      return true;
    });
  }, [tasks, dashSearch, personFilter, weekFilter, globalSubjectFilter, globalPriorityFilter, timeframe, selectedDate]);

  // --- 3. Top Metrics Row (Calculated based on Consolidated Global pool) ---
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
      if (decE > decS) {
        sumHrs += (decE - decS);
      }
    });
    return Math.round(sumHrs);
  }, [globalFilteredTasks]);

  const activePlannersCount = useMemo(() => {
    const ids = new Set<string>();
    globalFilteredTasks.forEach(t => ids.add(t.teamMemberId));
    return ids.size === 0 ? Math.min(teamMembers.length, 5) : ids.size;
  }, [globalFilteredTasks]);


  // --- 4. Dynamic 4-Chart Dashboard Configuration State ---
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      id: 1,
      title: 'Totaal Taken per Medewerker',
      dataSource: 'user_workload',
      vizType: 'bar',
      filterSubject: 'all',
      filterPriority: 'all'
    },
    {
      id: 2,
      title: 'Onderwerpen Verdeling',
      dataSource: 'subject',
      vizType: 'pie',
      filterSubject: 'all',
      filterPriority: 'all'
    },
    {
      id: 3,
      title: 'Trend Urgente & Hoge Prioriteit',
      dataSource: 'priority',
      vizType: 'line',
      filterSubject: 'all',
      filterPriority: 'all'
    },
    {
      id: 4,
      title: 'Prioriteiten Volume Verloop',
      dataSource: 'priority',
      vizType: 'area',
      filterSubject: 'all',
      filterPriority: 'all'
    }
  ]);

  // Config section editor toggle
  const [editingWidgetId, setEditingWidgetId] = useState<number | null>(null);

  // Widget hover interactive tooltip data
  const [activeTooltip, setActiveTooltip] = useState<{
    widgetId: number;
    label: string;
    value: number;
    extra?: string;
    x: number;
    y: number;
  } | null>(null);

  // Timeframe bins helper for trend charts (Line and Area)
  const timeframeBins = useMemo(() => {
    if (timeframe === 'daily') {
      return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    } else if (timeframe === 'weekly') {
      return ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
    } else {
      // monthly: Gather all unique week descriptors sorted
      const weeksRepresented = uniqueWeeks.length > 0 ? uniqueWeeks : [21, 22, 23, 24];
      return weeksRepresented.map(wk => `Week ${wk}`);
    }
  }, [timeframe, uniqueWeeks]);

  // Cycle date index slider for Daily Mode
  const handleOffsetDate = (offset: number) => {
    const curIdx = uniqueDates.indexOf(selectedDate);
    if (curIdx !== -1) {
      const nextIdx = (curIdx + offset + uniqueDates.length) % uniqueDates.length;
      setSelectedDate(uniqueDates[nextIdx]);
    }
  };

  // Helper inside chart render to process custom bins count
  const getTasksCountForBin = (bin: string, taskPool: Task[]) => {
    if (timeframe === 'daily') {
      const binHr = parseInt(bin.split(':')[0]);
      return taskPool.filter(t => {
        const startH = parseInt(t.startTime.split(':')[0]);
        return startH >= binHr && startH < binHr + 2;
      }).length;
    } else if (timeframe === 'weekly') {
      const matchDays = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
      return taskPool.filter(t => {
        const dayIdx = new Date(t.date).getDay();
        return matchDays[dayIdx] === bin;
      }).length;
    } else {
      // Monthly represented by Weeks
      const weekNum = parseInt(bin.replace(/\D/g, '')) || 22;
      return taskPool.filter(t => t.week === weekNum).length;
    }
  };

  return (
    <div id="analytics-canvas-root" className="space-y-8 pb-16 relative">

      {/* Hero Header Tab Panel */}
      <div id="analytics-header-row" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 rounded bg-blue-600 inline-block" />
            Uitgebreid Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Controleer werkdrukken, taakfrequenties en prioriteiten in realtime.</p>
        </div>

        {/* Timeframe Scale Selector - Toggle with custom highlight active tab */}
        <div id="timeframe-toggles" className="bg-slate-100 hover:bg-slate-150 rounded-xl p-1 flex items-center select-none w-fit border border-slate-200/50">
          <button
            id="btn-timeframe-daily"
            onClick={() => setTimeframe('daily')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === 'daily'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Dagelijks
          </button>
          <button
            id="btn-timeframe-weekly"
            onClick={() => setTimeframe('weekly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === 'weekly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Wekelijks
          </button>
          <button
            id="btn-timeframe-monthly"
            onClick={() => setTimeframe('monthly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === 'monthly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Maandelijks
          </button>
        </div>
      </div>

      {/* 4 Stats Metrics Cards (Reflecting global background filters context) */}
      <div id="stats-grid-4cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Tasks */}
        <div id="stat-card-total" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
            <Layers className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">TOTAAL TAKEN</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{totalTasksCount}</h3>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">Gesynchroniseerd</p>
          </div>
        </div>

        {/* Metric 2: Critical Tasks Alert */}
        <div id="stat-card-critical" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100 shadow-sm shrink-0">
            <Activity className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">HOOG / KRITIEK</p>
            <h3 className="text-xl font-black text-rose-550 tracking-tight mt-1.5 truncate">{criticalAndHighCount}</h3>
            <p className="text-[9px] text-rose-450 font-semibold font-mono mt-0.5 truncate">Dringende acties</p>
          </div>
        </div>

        {/* Metric 3: Planned Hours */}
        <div id="stat-card-hours" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-650 border border-yellow-100 shadow-sm shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">GEPLAND (U)</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{totalHoursPlanned} uur</h3>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">Bestede tijdvlakken</p>
          </div>
        </div>

        {/* Metric 4: Active Planners Count */}
        <div id="stat-card-members" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">ACTIEVE GEBRUIKERS</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1.5 truncate">{activePlannersCount}</h3>
            <p className="text-[9px] text-emerald-600 font-semibold font-mono mt-0.5 truncate">Deelgebied bezetting</p>
          </div>
        </div>
      </div>

      {/* Global & Deep Filter Controller Card */}
      <div id="dashboard-filters" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Dashboard Keyword Search box */}
          <div className="relative w-full lg:max-w-xs shrink-0">
            <input
              id="input-dash-search"
              type="text"
              placeholder="Filter op beschrijving of naam..."
              value={dashSearch}
              onChange={(e) => setDashSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            {dashSearch && (
              <button 
                onClick={() => setDashSearch('')} 
                className="absolute right-2.5 top-2.5 text-slate-450 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Deep Filter Options Row */}
          <div className="flex flex-wrap items-center gap-2.5 w-full justify-end">
            
            {/* Subject Selector dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">ONDERWERP</span>
              <select
                id="select-filter-subject"
                value={globalSubjectFilter}
                onChange={(e) => setGlobalSubjectFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 max-w-[150px]"
              >
                <option value="all">📁 Alle Onderwerpen</option>
                <option value="Todo">Todo</option>
                <option value="Verlof">Verlof</option>
                <option value="Training">Training</option>
                <option value="Meeting">Meeting</option>
              </select>
            </div>

            {/* Priority Selector dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">PRIORITEIT</span>
              <select
                id="select-filter-priority"
                value={globalPriorityFilter}
                onChange={(e) => setGlobalPriorityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 max-w-[150px]"
              >
                <option value="all">⚡ Alle Prioriteiten</option>
                <option value={Priority.CRITICAL}>🔴 Urgent / Kritiek</option>
                <option value={Priority.HIGH}>🟠 Hoog / High</option>
                <option value={Priority.MEDIUM}>🟡 Medium</option>
                <option value={Priority.LOW}>🟢 Low / Laag</option>
              </select>
            </div>

            {/* Team member selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">MEDEWERKER</span>
              <select
                id="select-filter-person"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-705 focus:outline-none focus:border-blue-500 max-w-[150px]"
              >
                <option value="all">👥 Alle Personen</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Week Selection for context mapping */}
            {timeframe !== 'daily' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">WEEK</span>
                <select
                  id="select-filter-week"
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="all font-sans">📅 Alle Weken</option>
                  {uniqueWeeks.map((wk) => (
                    <option key={wk} value={wk.toString()}>
                      Week {wk}
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </div>

        {/* Daily Calendar selection slider displayed ONLY if daily mode is active */}
        {timeframe === 'daily' && (
          <div id="daily-scroller-box" className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-550 shrink-0" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GESELECTEERDE DATUM ANALYSE</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                id="btn-offset-prev"
                onClick={() => handleOffsetDate(-1)}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Vorige beschikbare datum"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <select
                id="select-active-daily-date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-250 rounded-lg px-3 py-1 text-xs font-bold font-mono text-slate-750 focus:outline-none"
              >
                {uniqueDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                id="btn-offset-next"
                onClick={() => handleOffsetDate(1)}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Volgende beschikbare datum"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Dynamic 4-Chart Grid --- */}
      <div id="dynamic-widgets-grid" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {widgets.map((widget, widIdx) => {

          // --- Gather and filter data SPECIFIC to this widget ---
          const widgetFilteredTasks = tasks.filter(task => {
            // Must match keyword of global search
            if (dashSearch) {
              const term = dashSearch.toLowerCase();
              const dM = (teamMembers.find(m => m.id === task.teamMemberId)?.name || '').toLowerCase();
              if (!task.description.toLowerCase().includes(term) && !dM.includes(term)) return false;
            }

            // Global context filters
            if (personFilter !== 'all' && task.teamMemberId !== personFilter) return false;
            if (weekFilter !== 'all' && task.week.toString() !== weekFilter) return false;
            
            // Global Subject filter
            if (globalSubjectFilter !== 'all' && getTaskSubject(task) !== globalSubjectFilter) return false;
            
            // Global Priority filter
            if (globalPriorityFilter !== 'all' && task.priority !== globalPriorityFilter) return false;

            // Scale Timeframe filter
            if (timeframe === 'daily') {
              if (task.date !== selectedDate) return false;
            }

            // --- Apply Widget level custom filters ---
            if (widget.filterSubject !== 'all' && getTaskSubject(task) !== widget.filterSubject) return false;
            if (widget.filterPriority !== 'all' && task.priority !== widget.filterPriority) return false;

            return true;
          });

          // Compiling series items depending on datasource (Pie / Bar / Trend representation)
          const isTrend = widget.vizType === 'line' || widget.vizType === 'area';

          const chartDataItems = (() => {
            if (isTrend) {
              // Trend series over timeframeBins
              return timeframeBins.map(bin => {
                const count = getTasksCountForBin(bin, widgetFilteredTasks);
                return {
                  label: bin,
                  fullName: bin,
                  value: count,
                  color: widget.dataSource === 'subject' ? '#3b82f6' : 
                         widget.dataSource === 'priority' ? '#f43f5e' : '#8b5cf6'
                };
              });
            } else {
              // Categorized static distribution totals
              if (widget.dataSource === 'subject') {
                const subjects: ('Todo' | 'Verlof' | 'Training' | 'Meeting')[] = ['Todo', 'Verlof', 'Training', 'Meeting'];
                const subjectColors = { Todo: '#3b82f6', Verlof: '#fb7185', Training: '#c084fc', Meeting: '#2dd4bf' };
                return subjects.map(sub => {
                  const filteredCount = widgetFilteredTasks.filter(t => getTaskSubject(t) === sub).length;
                  return {
                    label: sub,
                    fullName: sub,
                    value: filteredCount,
                    color: subjectColors[sub]
                  };
                });
              } else if (widget.dataSource === 'priority') {
                const priorityLevels = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW];
                const priorityColors = {
                  [Priority.CRITICAL]: '#f43f5e',
                  [Priority.HIGH]: '#f97316',
                  [Priority.MEDIUM]: '#eab308',
                  [Priority.LOW]: '#10b981'
                };
                return priorityLevels.map(lvl => {
                  const labelStr = lvl === Priority.CRITICAL ? 'Urgent / Kritiek' : lvl === Priority.HIGH ? 'Hoog' : lvl === Priority.MEDIUM ? 'Medium' : 'Laag';
                  const filteredCount = widgetFilteredTasks.filter(t => t.priority === lvl).length;
                  return {
                    label: lvl,
                    fullName: labelStr,
                    value: filteredCount,
                    color: priorityColors[lvl] || '#94a3b8'
                  };
                });
              } else {
                // User workload data compilation
                return teamMembers.map(m => {
                  const count = widgetFilteredTasks.filter(t => t.teamMemberId === m.id).length;
                  return {
                    label: m.initials,
                    fullName: m.name,
                    value: count,
                    color: '#6366f1' // Indigo
                  };
                }).filter(u => u.value > 0); // Don't block screen, but show non-zero entries
              }
            }
          })();

          const maxChartValue = Math.max(...chartDataItems.map(d => d.value), 4);
          const totalWidgetTasksCount = widgetFilteredTasks.length;

          // Arc slicing math for Pie rendering
          const pieSlices = (() => {
            if (widget.vizType !== 'pie') return [];
            let currentAngle = 0;
            const radius = 55;
            const strokeWidth = 14;
            const center = 75;
            const circ = 2 * Math.PI * radius; // ~345.57
            
            const total = chartDataItems.reduce((acc, c) => acc + c.value, 0) || 1;
            
            return chartDataItems.map((item) => {
              const ratio = item.value / total;
              const angle = ratio * 360;
              const offset = circ - (ratio * circ);
              const rotation = currentAngle - 90; // Top oriented
              currentAngle += angle;
              
              return {
                ...item,
                strokeDasharray: circ,
                strokeDashoffset: offset,
                rotation,
                ratio: Math.round(ratio * 100)
              };
            });
          })();

          return (
            <div
              id={`widget-chart-container-${widget.id}`}
              key={widget.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all relative flex flex-col justify-between"
            >
              {/* Widget Header Area */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 h-10">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <span 
                      className={`w-1.5 h-3.5 rounded-full`}
                      style={{ backgroundColor: widIdx === 0 ? '#3b82f6' : widIdx === 1 ? '#ec4899' : widIdx === 2 ? '#eab308' : '#10b981' }}
                    />
                    {widget.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400 font-mono font-medium">
                    <span className="capitalize">{widget.dataSource.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="capitalize">{widget.vizType} Chart</span>
                    <span>•</span>
                    <span>{totalWidgetTasksCount} taken</span>
                    {widget.filterSubject !== 'all' && (
                      <span className="text-blue-550 border border-blue-105 bg-blue-50 px-1 rounded-sm text-[8px] uppercase">{widget.filterSubject} only</span>
                    )}
                  </div>
                </div>

                {/* Edit Config Toggle button */}
                <button
                  id={`btn-toggle-settings-${widget.id}`}
                  onClick={() => setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    editingWidgetId === widget.id
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-650 hover:bg-slate-100'
                  }`}
                  title="Configureer deze grafiek"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Collapsible Config Settings Editor Form */}
              {editingWidgetId === widget.id && (
                <div
                  id={`widget-settings-pane-${widget.id}`}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 animate-fade-in text-[11px]"
                >
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50">
                    <span className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-blue-500" /> GRAFIEK INSTELLINGEN
                    </span>
                    <button
                      onClick={() => setEditingWidgetId(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Input field: Title */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Titel Grafiek</label>
                      <input
                        id={`input-widget-title-${widget.id}`}
                        type="text"
                        value={widget.title}
                        onChange={(e) => {
                          const updated = widgets.map(w => w.id === widget.id ? { ...w, title: e.target.value } : w);
                          setWidgets(updated);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:border-blue-500"
                        placeholder="Grafiek naam..."
                      />
                    </div>

                    {/* Selector: Data Source */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Gegevensbron</label>
                      <select
                        id={`select-widget-source-${widget.id}`}
                        value={widget.dataSource}
                        onChange={(e) => {
                          const updated = widgets.map(w => w.id === widget.id ? { ...w, dataSource: e.target.value as any } : w);
                          setWidgets(updated);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="subject">📁 Taken per Onderwerp</option>
                        <option value="priority">⚡ Taken per Prioriteit</option>
                        <option value="user_workload">👥 Belasting per Medewerker</option>
                      </select>
                    </div>

                    {/* Selector: Visualization Style */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Visualisatie Type</label>
                      <select
                        id={`select-widget-style-${widget.id}`}
                        value={widget.vizType}
                        onChange={(e) => {
                          const updated = widgets.map(w => w.id === widget.id ? { ...w, vizType: e.target.value as any } : w);
                          setWidgets(updated);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="bar">📊 Staafdiagram (Bar)</option>
                        <option value="pie">🍩 Cirkeldiagram (Pie/Donut)</option>
                        <option value="line">📈 Trend Lijndiagram (Line)</option>
                        <option value="area">🏔️ Vlakdiagram (Area)</option>
                      </select>
                    </div>

                    {/* Custom filtering logic on Subject */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Extra Onderwerp Filter</label>
                      <select
                        id={`select-widget-filter-sub-${widget.id}`}
                        value={widget.filterSubject}
                        onChange={(e) => {
                          const updated = widgets.map(w => w.id === widget.id ? { ...w, filterSubject: e.target.value } : w);
                          setWidgets(updated);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-705 focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">Alle Onderwerpen</option>
                        <option value="Todo">Todo</option>
                        <option value="Verlof">Verlof</option>
                        <option value="Training">Training</option>
                        <option value="Meeting">Meeting</option>
                      </select>
                    </div>

                    {/* Custom filtering logic on Priority */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[8px]">Extra Prioriteit Filter</label>
                      <select
                        id={`select-widget-filter-pri-${widget.id}`}
                        value={widget.filterPriority}
                        onChange={(e) => {
                          const updated = widgets.map(w => w.id === widget.id ? { ...w, filterPriority: e.target.value } : w);
                          setWidgets(updated);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">Alle Prioriteiten</option>
                        <option value={Priority.CRITICAL}>Kritiek / Urgent</option>
                        <option value={Priority.HIGH}>Hoog / High</option>
                        <option value={Priority.MEDIUM}>Medium</option>
                        <option value={Priority.LOW}>Laag / Low</option>
                      </select>
                    </div>

                  </div>
                </div>
              )}

              {/* Graphic Plotting Area */}
              <div className="h-44 w-full flex items-center justify-center relative bg-transparent">
                
                {/* --- Chart Type 1: Staafdiagram / Bar Chart --- */}
                {widget.vizType === 'bar' && (
                  <div className="w-full h-full flex flex-col justify-between pt-1 font-sans">
                    {chartDataItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs">
                        <BarChart2 className="w-8 h-8 opacity-25" />
                        <span>Geen gegevens voor staafdiagram</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-end justify-between gap-3 px-2 pt-2 pb-6 border-b border-slate-100 relative">
                        {/* Grid lines in background */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                          <div className="border-t border-slate-100 w-full h-0" />
                          <div className="border-t border-slate-100/70 w-full h-0 shadow-[inset_0_1px_0_rgba(241,245,249,0.5)]" />
                          <div className="border-t border-slate-100/50 w-full h-0" />
                          <div className="w-full h-0" />
                        </div>

                        {chartDataItems.map((item, id) => {
                          const percentage = Math.max((item.value / maxChartValue) * 100, 4);
                          return (
                            <div
                              id={`bar-group-${widget.id}-${id}`}
                              key={id}
                              className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({
                                  widgetId: widget.id,
                                  label: item.fullName,
                                  value: item.value,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 38
                                });
                              }}
                              onMouseLeave={() => setActiveTooltip(null)}
                            >
                              {/* Count display standard view */}
                              <span className="text-[9px] font-black text-slate-700 tracking-tight mb-1 font-mono transition-transform duration-200 group-hover:scale-110">
                                {item.value}
                              </span>

                              {/* Solid Rounded SVG Column */}
                              <div
                                style={{
                                  height: `${percentage}%`,
                                  backgroundColor: item.color
                                }}
                                className="w-full min-w-[12px] max-w-[40px] rounded-t-lg transition-all duration-300 ease-out shadow-sm group-hover:brightness-105 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                              />

                              {/* Centered label initials underneath */}
                              <span className="absolute -bottom-5 text-[9px] font-bold text-slate-450 tracking-tight w-full text-center truncate px-0.5">
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* --- Chart Type 2: Cirkeldiagram / Pie / Donut Chart --- */}
                {widget.vizType === 'pie' && (
                  <div className="w-full h-full flex items-center justify-center gap-6 px-1">
                    {chartDataItems.every(d => d.value === 0) ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs">
                        <PieChart className="w-8 h-8 opacity-25" />
                        <span>Geen gegevens beschikbaar</span>
                      </div>
                    ) : (
                      <>
                        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                          {/* Circle Slice Rings */}
                          <svg width="110" height="110" viewBox="0 0 150 150" className="transform -rotate-90">
                            {/* Background Base Ring */}
                            <circle cx="75" cy="75" r="55" fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                            {pieSlices.map((slice, i) => {
                              if (slice.value === 0) return null;
                              return (
                                <circle
                                  id={`slice-${widget.id}-${slice.label}`}
                                  key={i}
                                  cx="75"
                                  cy="75"
                                  r="55"
                                  fill="transparent"
                                  stroke={slice.color}
                                  strokeWidth="14"
                                  strokeDasharray={slice.strokeDasharray}
                                  strokeDashoffset={slice.strokeDashoffset}
                                  className="transition-all duration-300 cursor-pointer hover:stroke-[17px]"
                                  style={{
                                    transformOrigin: '50% 50%',
                                    transform: `rotate(${slice.rotation}deg)`
                                  }}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({
                                      widgetId: widget.id,
                                      label: slice.fullName,
                                      value: slice.value,
                                      extra: `${slice.ratio}%`,
                                      x: rect.left + rect.width / 2,
                                      y: rect.top - 38
                                    });
                                  }}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                />
                              );
                            })}
                          </svg>

                          <div className="absolute text-center bg-transparent pointer-events-none">
                            <p className="text-xl font-black text-slate-800 tracking-tight leading-none">{totalWidgetTasksCount}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">TAKEN</p>
                          </div>
                        </div>

                        {/* Interactive Legend sidebar */}
                        <div className="flex-1 max-w-[200px] space-y-2 max-h-[160px] overflow-y-auto pr-1 select-none custom-scrollbar">
                          {pieSlices.map((slice, i) => {
                            if (slice.value === 0) return null;
                            return (
                              <div
                                id={`legend-row-${widget.id}-${slice.label}`}
                                key={i}
                                className="flex items-center justify-between text-[10px] font-medium border-b border-slate-50 pb-1"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                                  <span className="truncate text-slate-650 font-bold">{slice.fullName}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono">
                                  <span className="text-slate-400">({slice.ratio}%)</span>
                                  <span className="font-extrabold text-slate-800">{slice.value}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* --- Chart Type 3 & 4: Trend Line Graph or Area Graph --- */}
                {isTrend && (
                  <div className="w-full h-full flex flex-col justify-between font-sans relative">
                    {chartDataItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1.5 text-xs">
                        <TrendingUp className="w-8 h-8 opacity-25" />
                        <span>Trend leeg</span>
                      </div>
                    ) : (
                      (() => {
                        // Drawing path logic
                        const svgW = 400;
                        const svgH = 170;
                        const padX = 25;
                        const padY = 20;
                        const chartW = svgW - padX * 2;
                        const chartH = svgH - padY * 2;
                        const stepX = chartW / Math.max(timeframeBins.length - 1, 1);

                        // Points calculation mapping
                        const pointsStr = chartDataItems.map((item, id) => {
                          const x = padX + id * stepX;
                          const ratio = item.value / maxChartValue;
                          const y = svgH - padY - ratio * chartH;
                          return { x, y, ...item };
                        });

                        // Standard crisp straight coordinates path or spline curves
                        const polylinePoints = pointsStr.map(p => `${p.x},${p.y}`).join(' ');
                        const pathD = pointsStr.reduce((acc, p, i) => {
                          return id => acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
                        }, '')(0);

                        // Closing coordinates for Area visual
                        const areaD = `${pathD} L ${pointsStr[pointsStr.length - 1].x} ${svgH - padY} L ${pointsStr[0].x} ${svgH - padY} Z`;

                        const themeStroke = widget.id === 3 ? '#ec4899' : '#10b981';

                        return (
                          <div className="w-full h-full flex flex-col">
                            <svg
                              id={`svg-widget-chart-${widget.id}`}
                              viewBox={`0 0 ${svgW} ${svgH}`}
                              className="w-full h-full"
                            >
                              <defs>
                                <linearGradient id={`grad-area-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={themeStroke} stopOpacity="0.4" />
                                  <stop offset="100%" stopColor={themeStroke} stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              {/* Base horizontal baseline grids */}
                              <line x1={padX} y1={padY} x2={svgW - padX} y2={padY} stroke="#f1f5f9" strokeWidth="1" />
                              <line x1={padX} y1={padY + chartH / 2} x2={svgW - padX} y2={padY + chartH / 2} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                              <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="#e2e8f0" strokeWidth="1" />

                              {/* Rendering Area cover if style Area matches */}
                              {widget.vizType === 'area' && (
                                <path d={areaD} fill={`url(#grad-area-${widget.id})`} className="transition-all duration-500 ease-out" />
                              )}

                              {/* Main curve trend line */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={themeStroke}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-500 ease-out"
                              />

                              {/* Glow marker dots for mouse triggers */}
                              {pointsStr.map((item, idx) => (
                                <g key={idx}>
                                  <circle
                                    cx={item.x}
                                    cy={item.y}
                                    r="4"
                                    fill={themeStroke}
                                    stroke="white"
                                    strokeWidth="1.5"
                                    className="transition-all duration-300 hover:r-6 cursor-pointer hover:shadow-lg"
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActiveTooltip({
                                        widgetId: widget.id,
                                        label: item.fullName,
                                        value: item.value,
                                        x: rect.left + 5,
                                        y: rect.top - 38
                                      });
                                    }}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              ))}

                              {/* X Axis text grid */}
                              {pointsStr.map((item, idx) => (
                                <text
                                  key={idx}
                                  x={item.x}
                                  y={svgH - 4}
                                  textAnchor="middle"
                                  className="text-[8px] fill-slate-400 font-bold tracking-tight font-sans"
                                >
                                  {item.label}
                                </text>
                              ))}
                            </svg>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

              </div>

              {/* Action summary info line inside workspace */}
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono tracking-wider pt-2 border-t border-slate-100">
                <span>🟢 {widget.vizType.toUpperCase()} MODE ACTIVE</span>
                <span className="font-bold font-sans text-blue-550 flex items-center gap-0.5">
                  Live Sync <ArrowUpRight className="w-2.5 h-2.5 inline" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- HTML Target Interactive Tooltip Hover Block (Avoiding parent clip bounds!) --- */}
      {activeTooltip && (
        <div
          id="chart-hover-tooltip"
          style={{
            position: 'fixed',
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: 'translate(-50%, -10px)'
          }}
          className="bg-slate-900/95 backdrop-blur-sm pr-3 pl-3.5 py-2 rounded-xl text-white shadow-xl flex items-center gap-2 opacity-100 transition-all pointer-events-none z-50 animate-fade-in border border-white/10"
        >
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-black uppercase text-white/50 tracking-wider leading-none">{activeTooltip.label}</p>
            <p className="text-xs font-black tracking-tight flex items-center gap-1.5 mt-0.5 leading-none">
              <span className="text-sky-350">{activeTooltip.value} taken</span>
              {activeTooltip.extra && (
                <span className="text-[9px] px-1 bg-white/10 rounded font-semibold text-white/80">{activeTooltip.extra}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Styled Animations sheet Injection */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.02);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.25);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.45);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
