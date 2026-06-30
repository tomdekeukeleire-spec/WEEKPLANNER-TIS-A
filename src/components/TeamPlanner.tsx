import { Task, TeamMember, Priority } from '../types';
import { Calendar, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface TeamPlannerProps {
  tasks: Task[];
  onAddTask: (memberId: string, initialHour?: string) => void;
  onEditTask: (task: Task) => void;
  selectedDate: string; 
  setSelectedDate: (date: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeUsers: string[];
  teamMembers: TeamMember[];
}

function parseTimeToDecimal(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 8;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dagen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNr = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  return `${dagen[new Date(dateStr).getDay()]} ${new Date(dateStr).getDate()} ${maanden[new Date(dateStr).getMonth()]} ${new Date(dateStr).getFullYear()} (Week ${weekNr})`;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export default function TeamPlanner({
  tasks,
  onAddTask,
  onEditTask,
  selectedDate,
  setSelectedDate,
  searchTerm,
  setSearchTerm,
  teamMembers
}: TeamPlannerProps) {

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const filteredMembers = teamMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.initials.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col font-sans text-slate-900">
      
      {/* BOVENBALK */}
      <div className="p-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1">
          <button onClick={() => changeDate(-1)} className="p-1.5 rounded hover:bg-white text-slate-600 transition-all cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-3 text-xs font-bold text-slate-700 min-w-[220px] text-center">{formatLongDate(selectedDate)}</span>
          <button onClick={() => changeDate(1)} className="p-1.5 rounded hover:bg-white text-slate-600 transition-all cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>ONLINE PLANNER:</span>
          <span className="text-slate-400 font-normal italic">Alleen u bent online</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input type="text" placeholder="Zoeken op taak of persoon.." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-250 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          <button onClick={() => onAddTask('')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-wider px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"><Plus className="w-3.5 h-3.5 stroke-[3]" /><span>Nieuw</span></button>
        </div>
      </div>
