import React from 'react';
import { Task, TeamMember } from '../types';
import { PRIORITY_COLORS } from '../constants';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';

interface WeekOverviewProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onEditTask: (task: Task) => void;
  onAddTask: (memberId: string, initialHour?: string, specificDate?: string) => void; 
}

// Helper om de maandag van de huidige week te vinden
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pas aan als het zondag is
  return new Date(d.setDate(diff));
}

// Helper om een Date object te formatteren naar YYYY-MM-DD
function formatYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper voor menselijke dagnamen in de tabelkop
function formatDayHeader(date: Date): string {
  const dayName = new Intl.DateTimeFormat('nl-BE', { weekday: 'long' }).format(date);
  const capitalize = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const dayMonth = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' }).format(date);
  return `${capitalize} ${dayMonth}`;
}

// ISO Weeknummer berekenaar
function getWeekNumber(d: Date): number {
  const dateCopy = new Date(d.getTime());
  dateCopy.setHours(0, 0, 0, 0);
  dateCopy.setDate(dateCopy.getDate() + 3 - (dateCopy.getDay() + 6) % 7);
  const week1 = new Date(dateCopy.getFullYear(), 0, 4);
  return 1 + Math.round(((dateCopy.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

export default function WeekOverview({
  tasks,
  teamMembers,
  selectedDate,
  setSelectedDate,
  onEditTask,
  onAddTask
}: WeekOverviewProps) {
  const currentMonday = getMonday(selectedDate);
  const weekNum = getWeekNumber(currentMonday);

  // Genereer de 5 werkdagen (Maandag t/m Vrijdag)
  const workDays = Array.from({ length: 5 }, (_, i) => {
    const dayDate = new Date(currentMonday.getTime());
    dayDate.setDate(currentMonday.getDate() + i);
    return {
      dateStr: formatYYYYMMDD(dayDate),
      label: formatDayHeader(dayDate),
    };
  });

  // Navigeer een hele week terug of vooruit
  const handleWeekOffset = (weeks: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + weeks * 7);
    setSelectedDate(formatYYYYMMDD(newDate));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans text-slate-900">
      {/* Week Navigator Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
          <button
            onClick={() => handleWeekOffset(-1)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-all cursor-pointer"
            title="Vorige Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-slate-800 px-5 min-w-[120px] text-center tracking-tight flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-blue-500" /> Week {weekNum}
          </span>
          <button
            onClick={() => handleWeekOffset(1)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-all cursor-pointer"
            title="Volgende Week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 font-medium italic">
          💡 Klik op een leeg vak om een taak toe te voegen, of op een taak-badge om te bewerken.
        </p>
      </div>

      {/* Tabel Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <th className="w-48 p-4 border-r border-slate-200">TEAMLID</th>
              {workDays.map((day) => (
                <th key={day.dateStr} className="p-4 border-r border-slate-100 w-1/5">
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {teamMembers.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50/20 transition-colors">
                {/* Profielcel links */}
                <td className="p-3 border-r border-slate-200 bg-slate-50/30 font-medium vertical-align-top">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${member.color.split(' ')[0]}`}>
                      {member.initials}
                    </div>
                    <span className="text-xs font-bold text-slate-800 truncate block max-w-[130px]">
                      {member.name}
                    </span>
                  </div>
                </td>

                {/* 5 Dagen Cellen */}
                {workDays.map((day) => {
                  // Filter taken voor dit specifieke lid op deze specifieke dag
                  const dayTasks = tasks
                    .filter((t) => t.teamMemberId === member.id && t.date === day.dateStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <td 
                      key={day.dateStr} 
                      className="p-2 border-r border-slate-100 min-h-[80px] align-top relative cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => onAddTask(member.id, '09:00', day.dateStr)}
                    >
                      <div className="space-y-1.5 h-full">
                        {dayTasks.length > 0 ? (
                          dayTasks.map((task) => {
                            
                            // Toon geannuleerde taken als grijs in het weekoverzicht
                            const isCancelled = task.status === 'cancelled';
                            const colors = isCancelled
                              ? { bg: 'bg-slate-200 opacity-70', border: 'border-slate-300 line-through', text: 'text-slate-500' }
                              : PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                              
                            const subjectLabel = task.subject || 'Todo';

                            return (
                              <div
                                key={task.id}
                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                className={`group p-1.5 rounded-lg border-l-2 text-[10px] font-medium transition-all shadow-sm ${!isCancelled && 'hover:shadow hover:scale-[1.01] cursor-pointer'} block overflow-hidden ${colors.bg} ${colors.border} ${colors.text}`}
                                title={`Tijd: ${task.startTime} - ${task.endTime}\n${task.description}`}
                              >
                                <div className="flex justify-between items-center font-bold text-[9px]
