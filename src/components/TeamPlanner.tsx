import { Task, TeamMember, Priority } from '../types';
import { Calendar, Search, Plus, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';

interface TeamPlannerProps {
  tasks: Task[];
  onAddTask: (memberId: string, initialHour?: string) => void;
  onEditTask: (task: Task) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeUsers: string[];
  teamMembers: TeamMember[];
}

// Hulpmiddelen voor tijdlijnberekening
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
  
  // Bereken weeknummer
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNr = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  return `${dagen[new Date(dateStr).getDay()]} ${new Date(dateStr).getDate()} ${maanden[new Date(dateStr).getMonth()]} ${new Date(dateStr).getFullYear()} (Week ${weekNr})`;
}

// Urenbalk configuratie (08:00 tot 16:00 = 8 kolommen)
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15];

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

  // Navigatie-knoppen voor de datum
  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Filter teamleden op basis van de zoekbalk
  const filteredMembers = teamMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.initials.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans text-slate-900">
      
      {/* BOVENBALK: DATUMNAVIGATIE, ONLINE STATUS EN ZOEKBANK */}
      <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-white text-slate-600 transition-all cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-4 text-xs font-bold text-slate-700 min-w-[240px] text-center">{formatLongDate(selectedDate)}</span>
          <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-white text-slate-600 transition-all cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-4 py-2 rounded-xl text-xs font-semibold text-blue-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>ONLINE PLANNER:</span>
          <span className="text-slate-400 font-normal italic">Alleen u bent online</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input type="text" placeholder="Zoeken op taak of persoon.." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          <button onClick={() => onAddTask('')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/15 transition-all cursor-pointer"><Plus className="w-4 h-4 stroke-[3]" /><span>Nieuw</span></button>
        </div>
      </div>

      {/* HET CANVAS ROOSTER */}
      <div className="overflow-x-auto w-full">
        <div className="min-w-[1000px] w-full">
          
          {/* KOLOM KOPPEN (UREN) */}
          <div className="grid grid-cols-12 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 tracking-wider uppercase select-none">
            <div className="col-span-2 p-3 pl-6 border-r border-slate-100">Teamlid</div>
            {HOURS.map(h => (
              <div key={`head-h-${h}`} className="col-span-1 p-3 text-center border-r border-slate-100 last:border-r-0 font-mono">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
            <div className="col-span-2" /> {/* Uitlijning opvuller */}
          </div>

          {/* RIJEN PER MEDEWERKER */}
          <div className="divide-y divide-slate-100 bg-white">
            {filteredMembers.map(member => {
              // Haal alle taken op voor dit specifieke lid op deze dag
              const memberTasks = tasks.filter(t => t.teamMemberId === member.id && t.date === selectedDate);
              
              // -------------------------------------------------------------
              // LOGICA 1: TELLER REgEERT ALLEEN OP ACTIEVE TAKEN (BRAINSTORM)
              // -------------------------------------------------------------
              const activeCount = memberTasks.filter(t => t.status === 'active').length;

              return (
                <div key={member.id} className="grid grid-cols-12 items-center group hover:bg-slate-50/30 transition-colors">
                  
                  {/* LINKER KOLOM: NAAM EN TELLER */}
                  <div className="col-span-2 py-4 pl-6 pr-3 border-r border-slate-100 flex items-center gap-3 select-none">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                      {member.initials}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{member.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5 font-mono">
                        {activeCount} {activeCount === 1 ? 'taak' : 'taken'}
                      </p>
                    </div>
                  </div>

                  {/* RECHTER TIMELINE GEBIED (8 KOLOMMEN BREED) */}
                  <div className="col-span-10 h-16 relative bg-transparent grid grid-cols-8 divide-x divide-slate-100/70">
                    
                    {/* Lege klikbare achtergrondblokken per uur om snel te boeken */}
                    {HOURS.map((h, i) => (
                      <div 
                        key={`cell-${member.id}-${h}`} 
                        onClick={() => onAddTask(member.id, `${String(h).padStart(2, '0')}:00`)}
                        className="h-full hover:bg-blue-50/20 cursor-pointer transition-colors"
                      />
                    ))}

                    {/* DE DRIJVENDE TAAKBALKEN (DUBBELE BAND EN KLEUREN LOGICA) */}
                    {memberTasks.map(task => {
                      const tDecStart = parseTimeToDecimal(task.startTime);
                      const tDecEnd = parseTimeToDecimal(task.endTime);
                      
                      // Bereken de exacte horizontale positie en breedte in procenten
                      const leftPercent = ((tDecStart - 8) / 8) * 100;
                      const widthPercent = ((tDecEnd - tDecStart) / 8) * 100;

                      // Bepaal de kleur op basis van de prioriteit
                      let colorClass = 'bg-amber-500 text-white border-amber-600'; // Medium (Geel/Amber)
                      if (task.priority === Priority.CRITICAL) colorClass = 'bg-rose-600 text-white border-rose-700'; // Urgent
                      if (task.priority === Priority.HIGH) colorClass = 'bg-orange-500 text-white border-orange-600'; // Hoog
                      if (task.priority === Priority.LOW) colorClass = 'bg-emerald-500 text-white border-emerald-600'; // Laag

                      // Verlof & Ziekte specifieke branding
                      if (task.subject === 'Verlof') colorClass = 'bg-rose-600 text-white border-rose-700';
                      if (task.subject === 'Ziekte') colorClass = 'bg-purple-600 text-white border-purple-700';

                      // -------------------------------------------------------------
                      // LOGICA 3 & 4: STYLING BIJ STATUS CANCELLED (BRAINSTORM)
                      // -------------------------------------------------------------
                      const isCancelled = task.status === 'cancelled';
                      const finalColorStyle = isCancelled
                        ? 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 line-through pointer-events-none'
                        : colorClass;

                      // Verschuif geannuleerde taken iets naar onderen als er een dubbele band (verlof) actief is
                      const topOffset = isCancelled ? 'top-[34px] h-[24px]' : 'top-[10px] h-[36px] z-10 shadow-sm';

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => { e.stopPropagation(); if (!isCancelled) onEditTask(task); }}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          className={`absolute ${topOffset} border rounded-lg px-2.5 flex flex-col justify-center transition-all cursor-pointer select-none overflow-hidden group/item`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-90 truncate block">
                              {/* Voeg [GEANNULEERD] markering toe indien van toepassing */}
                              {isCancelled ? '[GEANNULEERD] ' : ''}{task.subject || 'TODO'}
                            </span>
                            <span className="text-[9px] font-mono font-bold opacity-75 shrink-0">
                              {task.startTime}-{task.endTime}
                            </span>
                          </div>
                          {task.description && task.description !== task.subject && (
                            <p className="text-[10px] font-medium opacity-90 truncate leading-normal -mt-0.5">
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

          {/* -------------------------------------------------------------
          // LOGICA 2: ONDERSTE BALK: DRUKTEMETERS / TOTAAL SCHEMATISCH
          // ------------------------------------------------------------- */}
          <div className="grid grid-cols-12 bg-slate-50 border-t border-b border-slate-100 items-center select-none">
            <div className="col-span-2 p-3 pl-6 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔒 Totaal Schematisch</span>
            </div>
            
            <div className="col-span-10 grid grid-cols-8 h-12 divide-x divide-slate-100">
              {HOURS.map(h => {
                // Tel HOEVEEL taken actief zijn tijdens DIT specifieke uur (geannuleerde worden uitgesloten!)
                const activeTasksInHour = tasks.filter(t => 
                  t.date === selectedDate &&
                  t.status === 'active' && // <--- HIER SLUITEN WE DE GRIJZE TAKEN UIT!
                  parseTimeToDecimal(t.startTime) < h + 1 &&
                  parseTimeToDecimal(t.endTime) > h
                ).length;

                // Dynamische badge-kleur op basis van drukte in de werkplaats
                let badgeColor = 'bg-blue-50 text-blue-600 ring-blue-500/10';
                if (activeTasksInHour >= 5) badgeColor = 'bg-rose-50 text-rose-600 ring-rose-500/10';
                else if (activeTasksInHour >= 3) badgeColor = 'bg-amber-50 text-amber-600 ring-amber-500/10';

                return (
                  <div key={`total-h-${h}`} className="h-full flex items-center justify-center bg-transparent">
                    <span className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center ring-1 ring-inset ${badgeColor}`}>
                      {activeTasksInHour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LEGENDA / FOOTER */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-[10px] font-bold text-slate-400 tracking-wide select-none">
            <div className="flex items-center gap-4">
              <span className="uppercase tracking-wider">Kleurwisser:</span>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-600" /><span>Urgent/Kritiek / Verlof</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-500" /><span>Hoog/High</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /><span>Medium</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-600" /><span>Ziekteverlof</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /><span>Low/Laag</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-300" /><span>Geannuleerde uren</span></div>
            </div>
            <div className="italic text-slate-400 font-normal">
              💡 Klik op een lege cel om taken aan te maken. Klik op bestaande taken om ze te bewerken of te verwijderen. Weekenddagen worden automatisch overgeslagen.
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
