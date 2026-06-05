import { useState } from 'react';
import { PRIORITY_COLORS } from '../constants';
import { Task, TeamMember } from '../types';
import { ChevronLeft, ChevronRight, Plus, Search, HelpCircle, AlertCircle, Circle, User } from 'lucide-react';

interface TeamPlannerProps {
  tasks: Task[];
  onAddTask: (memberId: string, initialHour?: string) => void;
  onEditTask: (task: Task) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeUsers: { memberId: string; name: string; initials: string }[];
  teamMembers: TeamMember[];
}

// Convert "HH:MM" string to fractional hours decimal
function parseTimeToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

// Format "YYYY-MM-DD" to include Day Name, Human Date and Week Number
function getExtendedDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  // 1. Dag van de week ophalen en kapitaliseren
  const dayNameFormatter = new Intl.DateTimeFormat('nl-BE', { weekday: 'long' });
  const dayName = dayNameFormatter.format(d);
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  // 2. Humane datum (bijv. 20 apr 2026)
  const dateFormatter = new Intl.DateTimeFormat('nl-BE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const humanDate = dateFormatter.format(d);

  // 3. ISO Weeknummer berekenen
  const dateCopy = new Date(d.getTime());
  dateCopy.setHours(0, 0, 0, 0);
  dateCopy.setDate(dateCopy.getDate() + 3 - (dateCopy.getDay() + 6) % 7);
  const week1 = new Date(dateCopy.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((dateCopy.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  return `${capitalizedDay} ${humanDate} (Week ${weekNum})`;
}

// Verspring datum en sla weekenden automatisch over (vrijdag -> maandag)
function offsetWorkDayStr(dateStr: string, direction: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + direction);

  // Als we op zaterdag (6) belanden: +2 dagen naar maandag of -1 dag naar vrijdag
  if (d.getDay() === 6) {
    d.setDate(d.getDate() + (direction === 1 ? 2 : -1));
  }
  // Als we op zondag (0) belanden: +1 dag naar maandag of -2 dagen naar vrijdag
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + (direction === 1 ? 1 : -2));
  }
  return d.toISOString().split('T')[0];
}

// Get task subject category or compute fallback
function getTaskSubject(task: Task): string {
  if (task.subject) return task.subject;
  if (task.description === 'Verlof' || task.description === 'Leave') return 'Verlof';
  if (task.description === 'Training' || task.description === 'Opleiding') return 'Training';
  if (task.description === 'Meeting' || task.description.toLowerCase().includes('meeting')) return 'Meeting';
  return 'Todo';
}

export default function TeamPlanner({
  tasks,
  onAddTask,
  onEditTask,
  selectedDate,
  setSelectedDate,
  searchTerm,
  setSearchTerm,
  activeUsers,
  teamMembers,
}: TeamPlannerProps) {
  
  // Aangepaste urenreeks: van 08:00 tot 16:00 (sluit perfect aan op de 15-minuten restrictie)
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const totalSlots = hours.length - 1; // 8 uursblokken

  // Filter tasks belonging only to the selected date
  const tasksForDay = tasks.filter(t => t.date === selectedDate);

  // Apply Search Filter on Team Members or Task description
  const filteredTeamMembers = teamMembers.filter(member => {
    const nameMatch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
    const initialsMatch = member.initials.toLowerCase().includes(searchTerm.toLowerCase());
    const hasMatchingTask = tasksForDay.some(task => 
      task.teamMemberId === member.id && 
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return nameMatch || initialsMatch || hasMatchingTask || searchTerm === '';
  });

  // Calculate sum of active tasks per hour slot
  const slotSumCounts = Array(totalSlots).fill(0);
  tasksForDay.forEach(task => {
    const tStart = parseTimeToDecimal(task.startTime);
    const tEnd = parseTimeToDecimal(task.endTime);
    
    for (let i = 0; i < totalSlots; i++) {
       const slotStart = 8 + i;
       const slotEnd = slotStart + 1;
       if (tStart < slotEnd && tEnd > slotStart) {
         slotSumCounts[i]++;
       }
    }
  });

  // Calculate coordinates (%) of task bar within 08:00 to 16:00 view
  const getTaskLayout = (task: Task) => {
    const earliestHour = 8;
    const latestHour = 16;
    const viewSpan = latestHour - earliestHour; // 8 hours
    
    const taskStart = parseTimeToDecimal(task.startTime);
    const taskEnd = parseTimeToDecimal(task.endTime);
    
    const visibleStart = Math.max(earliestHour, Math.min(latestHour, taskStart));
    const visibleEnd = Math.max(earliestHour, Math.min(latestHour, taskEnd));
    const span = visibleEnd - visibleStart;

    if (span <= 0) return { left: '0%', width: '0%', visible: false };

    const left = `${((visibleStart - earliestHour) / viewSpan) * 100}%`;
    const width = `${(span / viewSpan) * 100}%`;
    
    return { left, width, visible: true };
  };

  return (
    <div id="team-planner-root" className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans text-slate-900">
      {/* Upper Navigation Rail */}
      <div id="planner-sub-header" className="flex flex-col sm:flex-row justify-between items-center bg-white border-b border-slate-200 px-6 py-4 gap-4">
        
        {/* Date Selector Row */}
        <div id="date-navigation" className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
          <button
            id="btn-day-prev"
            onClick={() => setSelectedDate(offsetWorkDayStr(selectedDate, -1))}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white active:bg-slate-150 transition-all cursor-pointer"
            title="Vorige Werkdag"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span id="label-selected-date" className="text-sm font-bold text-slate-800 px-4 min-w-[240px] text-center tracking-tight">
            {getExtendedDateLabel(selectedDate)}
          </span>

          <button
            id="btn-day-next"
            onClick={() => setSelectedDate(offsetWorkDayStr(selectedDate, 1))}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white active:bg-slate-150 transition-all cursor-pointer"
            title="Volgende Werkdag"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Live Active Partners Overlay */}
        <div id="active-users-bar" className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-xs font-medium">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold uppercase tracking-wider text-[10px] text-blue-800 font-mono">ONLINE PLANNER:</span>
          <div className="flex -space-x-1.5 overflow-hidden">
            {activeUsers.length === 0 ? (
              <span className="text-slate-400 italic font-normal text-xs pl-1">Alleen u bent online</span>
            ) : (
              activeUsers.map((u, i) => (
                <div
                  id={`online-user-avatar-${u.memberId || i}`}
                  key={i}
                  title={`${u.name} (Online)`}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-850 text-white font-bold text-[9px] flex items-center justify-center border border-blue-400"
                >
                  {u.initials}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Search & Action Controls */}
        <div id="planner-actions" className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              id="input-planner-search"
              type="text"
              placeholder="Zoeken op taak of persoon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all focus:bg-white placeholder-slate-400"
            />
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          </div>

          <button
            id="btn-trigger-nieuw-taak"
            onClick={() => onAddTask('', '08:00')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm px-4.5 py-2.5 rounded-xl shadow-lg shadow-blue-500/10 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nieuw</span>
          </button>
        </div>
      </div>

      {/* Grid Timeline Scrollable Wrap */}
      <div id="planner-scroll-container" className="overflow-x-auto">
        <div id="planner-internal-grid" className="min-w-[1000px] flex flex-col bg-white">
          
          {/* Timeline columns Header */}
          <div id="grid-header-row" className="flex border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/50">
            <div className="w-52 py-1.5 px-3 text-slate-500 border-r border-slate-200 font-sans flex items-center">
              TEAMLID
            </div>
            <div className="flex-1 grid grid-cols-8 relative">
              {hours.slice(0, -1).map((hour, idx) => (
                <div
                  key={idx}
                  className="py-1.5 text-center border-r border-slate-100 font-mono text-slate-500 relative"
                >
                  {hour}
                  <span className="absolute bottom-1 right-[-4px] text-[8px] font-normal text-slate-300 pointer-events-none">
                    |
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Body Rows of Team Members */}
          <div id="grid-rows-container" className="divide-y divide-slate-100">
            {filteredTeamMembers.map((member) => {
              const memberTasks = tasksForDay.filter(t => t.teamMemberId === member.id);
              
              return (
                <div id={`planner-member-row-${member.id}`} key={member.id} className="flex relative hover:bg-slate-50/30 transition-colors shrink-0">
                  {/* Left profile card */}
                  <div className="w-52 py-1.5 px-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2.5 min-h-[46px]">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shadow-sm flex-shrink-0 ${member.color.split(' ')[0]}`}>
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate font-sans tracking-tight leading-tight">
                        {member.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">
                        {memberTasks.length} {memberTasks.length === 1 ? 'taak' : 'taken'}
                      </p>
                    </div>
                  </div>

                  {/* Horizontal visual slots */}
                  <div id={`row-slots-${member.id}`} className="flex-1 grid grid-cols-8 relative p-1.5 items-center bg-transparent">
                    {/* Vertical guideline divider overlays */}
                    <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                      {Array(totalSlots).fill(0).map((_, idx) => (
                        <div key={idx} className="border-r border-slate-100/50 h-full" />
                      ))}
                    </div>

                    {/* Interactive empty click handler to create task at specific hour */}
                    <div 
                      className="absolute inset-0 cursor-crosshair"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const colWidth = rect.width / 8;
                        const clickedCol = Math.floor(clickX / colWidth);
                        const hourVal = 8 + clickedCol;
                        const hourStr = `${hourVal < 10 ? '0' : ''}${hourVal}:00`;
                        onAddTask(member.id, hourStr);
                      }}
                    />

                    {/* Task blocks absolute layer wrapper */}
                    <div className="absolute inset-x-2.5 h-[34px] pointer-events-none">
                      {memberTasks.map((task) => {
                        const layout = getTaskLayout(task);
                        if (!layout.visible) return null;
                        
                        const colorConfig = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                        const taskSubject = getTaskSubject(task);

                        return (
                          <div
                            id={`task-bar-${task.id}`}
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task);
                            }}
                            style={{ left: layout.left, width: layout.width }}
                            className={`absolute top-0 h-[32px] rounded-lg border-l-[3px] px-2 py-0.5 flex flex-col justify-center pointer-events-auto cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] transition-all overflow-hidden ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text}`}
                            title={`Taak: ${task.description}\nTijd: ${task.startTime} - ${task.endTime}\nPrioriteit: ${task.priority}`}
                          >
                            <span className="text-[9px] font-bold truncate leading-none uppercase block w-full">
                              {taskSubject}
                            </span>
                            <span className="text-[8px] opacity-85 leading-normal truncate block w-full mt-0.5">
                              {task.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTeamMembers.length === 0 && (
              <div id="no-search-results" className="text-center p-12 text-slate-400">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium">Geen teamleden of taken gevonden voor "{searchTerm}"</p>
              </div>
            )}
          </div>

          {/* Aggregate sum bottom footer row */}
          <div id="grid-summary-row" className="flex border-t border-slate-200 bg-slate-50/70 font-mono text-[10px] font-bold text-slate-700">
            <div className="w-52 py-1.5 px-3 text-slate-700 border-r border-slate-200 font-sans flex items-center min-h-[38px]">
              🔒 TOTAAL SCHEMATISCH
            </div>
            <div className="flex-1 grid grid-cols-8">
              {slotSumCounts.map((count, idx) => (
                <div
                  key={idx}
                  className="py-1 px-1 text-center border-r border-slate-100 flex flex-col items-center justify-center"
                  title={`Drukste uur: ${count} taken actief`}
                >
                  <span className={`px-2.5 py-1 rounded-lg text-sm transition-all ${
                    count === 0 
                      ? 'bg-slate-100/50 text-slate-400' 
                      : count >= 5 
                        ? 'bg-rose-100 text-rose-700 shadow-sm border border-rose-200' 
                        : 'bg-blue-100 text-blue-700 shadow-sm border border-blue-200'
                  }`}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      
      {/* Dynamic legend bar */}
      <div id="planner-legend" className="flex flex-wrap items-center justify-between gap-4 bg-slate-100 border-t border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-slate-600">
          <span className="font-semibold uppercase text-[10px] tracking-wider text-slate-500">KLEURWISSER:</span>
          {Object.entries(PRIORITY_COLORS).map(([lvl, color]) => (
            <div key={lvl} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${color.bg.split(' ')[0]}`} />
              <span>{color.badge}</span>
            </div>
          ))}
        </div>
        
        <div className="text-slate-500 text-[11px] font-mono italic">
          💡 Klik op een lege cel om taken aan te maken. Klik op bestaande taken om ze te bewerken of te verwijderen. Weekenddagen worden automatisch overgeslagen.
        </div>
      </div>
    </div>
  );
}
