import { useState, useEffect, FormEvent, useRef } from 'react';
import { Priority, Task, TeamMember } from '../types';
import { X, Calendar, Clock, AlertTriangle, Check, Trash2, Split, RefreshCw } from 'lucide-react';

interface NieuweTaakModalProps {
  onClose: () => void;
  onSave: (task: any) => void;
  onDelete?: (taskId: string) => void;
  editingTask?: Task | null;
  defaultDate?: string;
  defaultTime?: string; // Toegevoegd zodat de prop herkend wordt!
  defaultMemberId?: string;
  teamMembers: TeamMember[];
  isSuperuser: boolean;
  currentUserId: string;
  tasks: Task[]; 
}

function getISOWeek(dateStr: string): number {
  if (!dateStr) return 22;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 22;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatEurope(ymd: string) {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// NU INGESTELD PER 30 MINUTEN EN TOT 17:00 UUR
const ALLOWED_TIMES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

export default function NieuweTaakModal({
  onClose,
  onSave,
  onDelete,
  editingTask,
  defaultDate,
  defaultTime,
  defaultMemberId,
  teamMembers,
  isSuperuser,
  currentUserId,
  tasks
}: NieuweTaakModalProps) {
  const [teamMemberId, setTeamMemberId] = useState<string>(
    editingTask?.teamMemberId || (isSuperuser ? (defaultMemberId || (teamMembers.length > 0 ? teamMembers[0].id : '')) : currentUserId)
  );
  
  const [date, setDate] = useState<string>(defaultDate || '2026-06-09');
  const [endDate, setEndDate] = useState<string>(defaultDate || '2026-06-09');
  const [week, setWeek] = useState<number>(24);
  const [subject, setSubject] = useState<'Todo' | 'Verlof' | 'Ziekte' | 'Training' | 'Meeting'>('Todo');
  const [description, setDescription] = useState<string>('');
  
  // Maak gebruik van defaultTime als deze wordt meegegeven, anders '08:00'
  const [startTime, setStartTime] = useState<string>(defaultTime || '08:00');
  
  // Bereken logische eindtijd (+1 uur) op basis van de starttijd
  const [endTime, setEndTime] = useState<string>(() => {
    if (defaultTime) {
      const idx = ALLOWED_TIMES.indexOf(defaultTime);
      return idx !== -1 && idx + 2 < ALLOWED_TIMES.length ? ALLOWED_TIMES[idx + 2] : '17:00';
    }
    return '09:00';
  });
  
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(false);

  const [regConflictingTask, setRegConflictingTask] = useState<Task | null>(null);
  const [massaConflictCount, setMassaConflictCount] = useState<number>(0);
  const [showMassaWarning, setShowMassaWarning] = useState<boolean>(false);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  // DE OPLOSSING VOOR HET WITTE SCHERM: De variabele globaal definiëren in het component
  const isLeaveOrSickness = subject === 'Verlof' || subject === 'Ziekte';

  useEffect(() => {
    setWeek(getISOWeek(date));
  }, [date]);

  const handleStartDateChange = (val: string) => {
    setDate(val);
    if (endDate < val) setEndDate(val);
    setRegConflictingTask(null);
    setShowMassaWarning(false);
  };

  useEffect(() => {
    if (subject === 'Verlof' || subject === 'Ziekte') setPriority(Priority.CRITICAL);
    else if (subject === 'Training') setPriority(Priority.HIGH);
    else if (subject === 'Meeting' && priority !== Priority.HIGH && priority !== Priority.MEDIUM) setPriority(Priority.MEDIUM);
  }, [subject, priority]);

  useEffect(() => {
    if (editingTask) {
      setDate(editingTask.date);
      setEndDate(editingTask.date);
      setWeek(editingTask.week);
      setTeamMemberId(editingTask.teamMemberId);
      setDescription(editingTask.description);
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setPriority(editingTask.priority);
      setSubject((editingTask.subject as any) || 'Todo');
    }
  }, [editingTask]);

  const executeSubmit = (resolution?: 'split' | 'overwrite') => {
    const isPeriode = !editingTask && endDate && endDate !== date;
    
    const payload: any = {
      date,
      endDate: isPeriode ? endDate : date,
      week,
      teamMemberId,
      subject,
      description: description.trim() || (subject === 'Verlof' ? 'Verlof' : subject === 'Ziekte' ? 'Ziekte' : ''),
      startTime,
      endTime,
      priority,
      repeatWeekly: !editingTask ? repeatWeekly : false,
      conflictResolution: resolution,
      conflictTaskId: regConflictingTask?.id
    };

    if (editingTask) payload.id = editingTask.id;
    onSave(payload);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const isPeriode = !editingTask && endDate && endDate !== date;

    if (!isPeriode) {
      const dateParts = date.split('-');
      if (dateParts.length === 3) {
        const localDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        if (localDate.getDay() === 0 || localDate.getDay() === 6) {
          alert('Plannen in het weekend is niet toegestaan!');
          return;
        }
      }
    }

    if (isPeriode && endDate < date) {
      alert('De einddatum kan niet vòòr de startdatum liggen.');
      return;
    }

    if (!isLeaveOrSickness && !description.trim()) {
      alert('Vul a.u.b. een omschrijving in.');
      return;
    }

    if (startTime >= endTime) {
      alert('De eindtijd moet na de starttijd liggen.');
      return;
    }

    if (!editingTask) {
      if (isLeaveOrSickness) {
        const count = tasks.filter(t => 
          t.teamMemberId === teamMemberId &&
          t.date >= date &&
          t.date <= endDate &&
          t.status === 'active'
        ).length;

        if (count > 0 && !showMassaWarning) {
          setMassaConflictCount(count);
          setShowMassaWarning(true);
          return;
        }
      } else {
        const foundOverlap = tasks.find(t => 
          t.teamMemberId === teamMemberId &&
          t.date === date &&
          t.status === 'active' &&
          (t.startTime < endTime && t.endTime > startTime)
        );

        if (foundOverlap && !regConflictingTask) {
          const isExistingLeave = foundOverlap.subject === 'Verlof' || foundOverlap.subject === 'Ziekte';
          if (isExistingLeave) {
            alert(`⚠️ Boeking geweigerd: ${activeMemberName} is op dit tijdstip afwezig wegens ${foundOverlap.subject}. U kunt hier geen werklast overheen plannen.`);
            return;
          }

          setRegConflictingTask(foundOverlap);
          return; 
        }
      }
    }

    executeSubmit();
  };

  const activeMemberName = teamMembers.find(m => m.id === teamMemberId)?.name || 'Dit teamlid';

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans text-slate-900">
      <div id="modal-card" className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col transform transition-all animate-scale-up">
        
        <div id="modal-header" className="flex justify-between items-center p-6 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 bg-transparent">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">+</div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">
              {editingTask ? 'Taak Aanpassen' : 'Nieuw Agenda Item'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {showMassaWarning && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Massa-annulering vereist!</h4>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    {activeMemberName} heeft in deze periode al <strong>{massaConflictCount} actieve ta(a)k(en)</strong> gepland staan.
                  </p>
                  <p className="text-xs text-rose-600 mt-1 font-medium">
                    Als u doorgaat, worden deze taken automatisch gemarkeerd als geannuleerd (grijs).
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1 justify-end">
                <button type="button" onClick={() => setShowMassaWarning(false)} className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-100">Terug</button>
                <button type="button" onClick={() => executeSubmit()} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 shadow-md">Ja, vageer agenda</button>
              </div>
            </div>
          )}

          {regConflictingTask && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Uuroverlapping gedetecteerd!</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Er staat al een boeking tussen <strong>{regConflictingTask.startTime} - {regConflictingTask.endTime}</strong>:<br />
                    <span className="font-mono bg-amber-100 px-1 rounded text-[11px] font-bold text-amber-800">{regConflictingTask.description || regConflictingTask.subject}</span>
                  </p>
                  <p className="text-xs text-amber-800 font-bold mt-2 uppercase tracking-wide text-[10px]">Kies de gewenste actie:</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <button type="button" onClick={() => setRegConflictingTask(null)} className="p-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100">↩️ Aanpassen</button>
                <button type="button" onClick={() => executeSubmit('split')} className="p-2 bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl hover:bg-amber-200 flex flex-col items-center justify-center gap-1"><Split className="w-4 h-4" />✂️ Splitsen</button>
                <button type="button" onClick={() => executeSubmit('overwrite')} className="p-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 flex flex-col items-center justify-center gap-1 shadow-md"><RefreshCw className="w-4 h-4" />🗑️ Vervangen</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 bg-transparent relative">
            <div id="field-date" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> STARTDATUM
              </label>
              
              <div 
                onClick={() => { try { startDateRef.current?.showPicker(); } catch(e) {} }}
                className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 flex justify-between items-center cursor-pointer hover:bg-white transition-colors relative"
              >
                <span className="font-medium tracking-wide">{formatEurope(date)}</span>
                <Calendar className="w-4 h-4 text-slate-400" />
                
                <input
                  type="date"
                  ref={startDateRef}
                  required
                  value={date}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="absolute opacity-0 w-[1px] h-[1px] pointer-events-none overflow-hidden"
                />
              </div>
            </div>

            <div id="field-end-date" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> EINDDATUM {!editingTask && '(OPTIONEEL)'}
              </label>
              
              <div 
                onClick={() => { if (!editingTask) { try { endDateRef.current?.showPicker(); } catch(e) {} } }}
                className={`w-full border border-slate-250 rounded-lg px-3 py-2 text-sm flex justify-between items-center transition-colors relative ${editingTask ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-slate-800 cursor-pointer hover:bg-white'}`}
              >
                <span className="font-medium tracking-wide">{formatEurope(endDate)}</span>
                <Calendar className={`w-4 h-4 ${editingTask ? 'text-slate-300' : 'text-slate-400'}`} />
                
                <input
                  type="date"
                  ref={endDateRef}
                  required
                  disabled={!!editingTask}
                  value={endDate}
                  min={date}
                  onChange={(e) => { setEndDate(e.target.value); setShowMassaWarning(false); }}
                  className="absolute opacity-0 w-[1px] h-[1px] pointer-events-none overflow-hidden"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 bg-transparent">
            <div className="space-y-1 bg-transparent col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">TOEWIJZEN AAN</label>
              <select value={teamMemberId} required disabled={!isSuperuser} onChange={(e) => { setTeamMemberId(e.target.value); setRegConflictingTask(null); setShowMassaWarning(false); }} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400">
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name} ({member.initials})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">WEEK</label>
              <input type="number" disabled value={week} className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono text-center cursor-not-allowed" />
            </div>
          </div>

          <div id="field-subject" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">ONDERWERP</label>
            <select value={subject} onChange={(e) => { setSubject(e.target.value as any); setRegConflictingTask(null); setShowMassaWarning(false); }} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none">
              <option value="Todo">Todo</option>
              <option value="Verlof">Verlof</option>
              <option value="Ziekte">Ziekte</option>
              <option value="Training">Training</option>
              <option value="Meeting">Meeting</option>
            </select>
          </div>

          <div id="field-description" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">OMSCHRIJVING {(subject === 'Verlof' || subject === 'Ziekte') && '(OPTIONEEL)'}</label>
            <input type="text" required={subject !== 'Verlof' && subject !== 'Ziekte'} placeholder={subject === 'Verlof' ? 'Verlof' : subject === 'Ziekte' ? 'Ziekteverlof' : 'Bijv. Project Meeting'} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none placeholder-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-transparent">
            <div id="field-start" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> START</label>
              <select required value={startTime} onChange={(e) => { setStartTime(e.target.value); setRegConflictingTask(null); }} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none cursor-pointer">
                {ALLOWED_TIMES.map((time) => <option key={`start-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
            <div id="field-end" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> EINDE</label>
              <select required value={endTime} onChange={(e) => { setEndTime(e.target.value); setRegConflictingTask(null); }} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none cursor-pointer">
                {ALLOWED_TIMES.map((time) => <option key={`end-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
          </div>

          <div id="field-priority" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-blue-500" /> PRIORITEIT</label>
            <select value={priority} disabled={subject === 'Verlof' || subject === 'Ziekte' || subject === 'Training'} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none disabled:bg-slate-100 text-slate-700">
              {(subject === 'Todo' || subject === 'Verlof' || subject === 'Ziekte') && <option value={Priority.CRITICAL}>🔴 Critical / Kritiek</option>}
              {(subject === 'Todo' || subject === 'Training' || subject === 'Meeting') && <option value={Priority.HIGH}>🟠 High / Hoog</option>}
              {(subject === 'Todo' || subject === 'Meeting') && <option value={Priority.MEDIUM}>🟡 Medium</option>}
              {subject === 'Todo' && <option value={Priority.LOW}>🟢 Low / Laag</option>}
            </select>
          </div>

          {!editingTask && endDate === date && !isLeaveOrSickness && (
            <div className="flex items-center gap-2.5 bg-blue-50/50 border border-blue-100 rounded-xl p-3 select-none">
              <input id="checkbox-repeat-weekly" type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer" />
              <label htmlFor="checkbox-repeat-weekly" className="text-xs font-bold text-blue-900 cursor-pointer uppercase tracking-wide">🔄 Wekelijks herhalen tot einde jaar</label>
            </div>
          )}

          <div id="modal-actions" className="pt-5 mt-4 flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-6">
            {editingTask && onDelete ? (
              <button id="btn-delete-task" type="button" onClick={() => onDelete(editingTask.id)} className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-4 py-2.5 rounded-lg border border-rose-200 text-sm transition-all cursor-pointer"><Trash2 className="w-4 h-4" /><span>Wissen</span></button>
            ) : (
              <button id="btn-annuleren" type="button" onClick={onClose} className="px-6 py-3 border border-slate-250 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase tracking-wider text-xs cursor-pointer">Annuleren</button>
            )}
            <button id="btn-save-task" type="submit" disabled={showMassaWarning || !!regConflictingTask} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/20 focus:outline-none disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"><Check className="w-4.5 h-4.5" /><span>Opslaan</span></button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.15s ease-out forwards; }
        .animate-scale-up { animation: scaleUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
}
