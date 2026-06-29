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

      <div className="overflow-x-auto w-full">
        <div className="min-w-[1100px] w-full">
          
          {/* KOLOM KOPPEN */}
          <div className="grid grid-cols-12 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 tracking-wider uppercase select-none">
            <div className="col-span-2 py-3 pl-4 border-r border-slate-100">Teamlid</div>
            {HOURS.map(h => (
              <div key={`head-h-${h}`} className="col-span-1 py-3 text-center border-r border-slate-100 last:border-r-0 font-mono">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
            <div className="col-span-1 py-3 text-center font-mono">17:00</div> 
          </div>

          <div className="divide-y divide-slate-100 bg-white">
            {filteredMembers.map(member => {
              const memberTasks = tasks.filter(t => t.teamMemberId === member.id && t.date === selectedDate);
              const activeCount = memberTasks.filter(t => t.status === 'active').length;

              return (
                <div key={member.id} className="grid grid-cols-12 items-center group hover:bg-slate-50/30 transition-colors">
                  
                  {/* LINKER KOLOM */}
                  <div className="col-span-2 py-3 pl-4 pr-2 border-r border-slate-100 flex items-center gap-3 select-none">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                      {member.initials}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{member.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400 font-mono leading-tight mt-0.5">
                        {activeCount} {activeCount === 1 ? 'taak' : 'taken'}
                      </p>
                    </div>
                  </div>

                  {/* TIMELINE RIJ */}
                  <div className="col-span-10 h-14 relative bg-transparent grid grid-cols-9 divide-x divide-slate-100/70">
                    
                    {HOURS.map((h, i) => (
                      <div 
                        key={`cell-${member.id}-${h}`} 
                        onClick={() => onAddTask(member.id, `${String(h).padStart(2, '0')}:00`)}
                        className="h-full hover:bg-blue-50/20 cursor-pointer transition-colors"
                      />
                    ))}

                    {memberTasks.map(task => {
                      const tDecStart = parseTimeToDecimal(task.startTime);
                      const tDecEnd = parseTimeToDecimal(task.endTime);
                      
                      const leftPercent = ((tDecStart - 8) / 9) * 100;
                      const widthPercent = ((tDecEnd - tDecStart) / 9) * 100;

                      let colorClass = 'bg-amber-500 text-white border-amber-600'; 
                      if (task.priority === Priority.CRITICAL) colorClass = 'bg-rose-600 text-white border-rose-700'; 
                      if (task.priority === Priority.HIGH) colorClass = 'bg-orange-500 text-white border-orange-600'; 
                      if (task.priority === Priority.LOW) colorClass = 'bg-emerald-500 text-white border-emerald-600'; 

                      if (task.subject === 'Verlof') colorClass = 'bg-rose-600 text-white border-rose-700';
                      if (task.subject === 'Ziekte') colorClass = 'bg-purple-600 text-white border-purple-700';

                      const isCancelled = task.status === 'cancelled';
                      const finalColorStyle = isCancelled
                        ? 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 line-through pointer-events-none'
                        : colorClass;

                      const topOffset = isCancelled ? 'top-[30px] h-[18px]' : 'top-[12px] h-[32px] z-10 shadow-sm';

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => { e.stopPropagation(); if (!isCancelled) onEditTask(task); }}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          className={`absolute ${topOffset} border ${finalColorStyle} rounded-md px-2 flex flex-col justify-center transition-all cursor-pointer select-none overflow-hidden group/item`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-90 truncate block leading-none mt-px">
                              {isCancelled ? '[GEANNULEERD] ' : ''}{task.subject || 'TODO'}
                            </span>
                            <span className="text-[9px] font-mono font-bold opacity-75 shrink-0 leading-none mt-px">
                              {task.startTime}-{task.endTime}
                            </span>
                          </div>
                          {task.description && task.description !== task.subject && (
                            <p className="text-[10px] font-medium opacity-90 truncate leading-none mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      );
                    })}

                  </div>

                </div>
              );
            })}
          </div>

          {/* ONDERSTE BALK: DRUKTEMETERS */}
          <div className="grid grid-cols-12 bg-slate-50 border-t border-b border-slate-100 items-center select-none">
            <div className="col-span-2 py-3 pl-4 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔒 Totaal Schematisch</span>
            </div>
            
            <div className="col-span-10 grid grid-cols-9 h-12 divide-x divide-slate-100">
              {HOURS.map(h => {
                const activeTasksInHour = tasks.filter(t => 
                  t.date === selectedDate &&
                  t.status === 'active' && 
                  parseTimeToDecimal(t.startTime) < h + 1 &&
                  parseTimeToDecimal(t.endTime) > h
                ).length;

                let badgeColor = 'bg-blue-50 text-blue-600 ring-blue-500/10';
                if (activeTasksInHour >= 5) badgeColor = 'bg-rose-50 text-rose-600 ring-rose-500/10';
                else if (activeTasksInHour >= 3) badgeColor = 'bg-amber-50 text-amber-600 ring-amber-500/10';

                return (
                  <div key={`total-h-${h}`} className="h-full flex items-center justify-center bg-transparent">
                    <span className={`w-7 h-7 rounded font-mono font-bold text-[11px] flex items-center justify-center ring-1 ring-inset ${badgeColor}`}>
                      {activeTasksInHour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="py-3 px-4 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-slate-400 tracking-wide select-none">
            <div className="flex items-center gap-3">
              <span className="uppercase tracking-wider">Kleurwisser:</span>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600" /><span>Urgent / Verlof</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /><span>Hoog</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /><span>Medium</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-600" /><span>Ziekte</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span>Laag</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /><span>Geannuleerd</span></div>
            </div>
            <div className="italic text-slate-400 font-normal">
              💡 Klik op een lege cel voor een nieuwe taak. Weekenddagen worden automatisch overgeslagen.
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
