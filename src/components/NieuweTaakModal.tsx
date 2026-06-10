import { useState, useEffect, FormEvent, useRef } from 'react';
import { PRIORITY_COLORS } from '../constants';
import { Priority, Task, TeamMember } from '../types';
import { X, Calendar, Clock, AlertTriangle, Check, Trash2 } from 'lucide-react';

interface NieuweTaakModalProps {
  onClose: () => void;
  onSave: (task: any) => void;
  onDelete?: (taskId: string) => void;
  editingTask?: Task | null;
  defaultDate?: string;
  defaultMemberId?: string;
  teamMembers: TeamMember[];
  isSuperuser: boolean;
  currentUserId: string;
}

// Helper: Berekent het weeknummer
function getISOWeek(dateStr: string): number {
  if (!dateStr) return 22;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 22;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// DE TRUC: Forceer áltijd de Europese Notatie (DD/MM/YYYY) voor weergave
function formatEurope(ymd: string) {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const ALLOWED_TIMES = [
  '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45',
  '16:00'
];

export default function NieuweTaakModal({
  onClose,
  onSave,
  onDelete,
  editingTask,
  defaultDate,
  defaultMemberId,
  teamMembers,
  isSuperuser,
  currentUserId,
}: NieuweTaakModalProps) {
  const [teamMemberId, setTeamMemberId] = useState<string>(
    editingTask?.teamMemberId || (isSuperuser ? (defaultMemberId || (teamMembers.length > 0 ? teamMembers[0].id : '')) : currentUserId)
  );
  
  const [date, setDate] = useState<string>(defaultDate || '2026-06-09');
  const [endDate, setEndDate] = useState<string>(defaultDate || '2026-06-09');
  const [week, setWeek] = useState<number>(24);
  const [subject, setSubject] = useState<'Todo' | 'Verlof' | 'Training' | 'Meeting'>('Todo');
  const [description, setDescription] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('09:00');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(false);

  // Referenties naar de onzichtbare kalenders
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWeek(getISOWeek(date));
  }, [date]);

  const handleStartDateChange = (val: string) => {
    setDate(val);
    if (endDate < val) setEndDate(val);
  };

  useEffect(() => {
    if (subject === 'Verlof') setPriority(Priority.CRITICAL);
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
      setSubject(editingTask.subject || 'Todo');
    }
  }, [editingTask]);

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

    if (subject !== 'Verlof' && !description.trim()) {
      alert('Vul a.u.b. een omschrijving in.');
      return;
    }

    if (startTime >= endTime) {
      alert('De eindtijd moet na de starttijd liggen.');
      return;
    }

    const payload: any = {
      date,
      endDate: isPeriode ? endDate : date,
      week,
      teamMemberId,
      subject,
      description: description.trim() || (subject === 'Verlof' ? 'Verlof' : ''),
      startTime,
      endTime,
      priority,
      repeatWeekly: !editingTask ? repeatWeekly : false
    };

    if (editingTask) payload.id = editingTask.id;
    onSave(payload);
  };

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
          
          <div className="grid grid-cols-2 gap-4 bg-transparent relative">
            
            {/* STARTDATUM VAK (TRUC) */}
            <div id="field-date" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> STARTDATUM
              </label>
              
              {/* Het zichtbare, Europese vakje */}
              <div 
                onClick={() => { try { startDateRef.current?.showPicker(); } catch(e) {} }}
                className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 flex justify-between items-center cursor-pointer hover:bg-white transition-colors relative"
              >
                <span className="font-medium tracking-wide">{formatEurope(date)}</span>
                <Calendar className="w-4 h-4 text-slate-400" />
                
                {/* De onzichtbare aandrijver */}
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

            {/* EINDDATUM VAK (TRUC) */}
            <div id="field-end-date" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> EINDDATUM {!editingTask && '(OPTIONEEL)'}
              </label>
              
              {/* Het zichtbare, Europese vakje */}
              <div 
                onClick={() => { if (!editingTask) { try { endDateRef.current?.showPicker(); } catch(e) {} } }}
                className={`w-full border border-slate-250 rounded-lg px-3 py-2 text-sm flex justify-between items-center transition-colors relative ${editingTask ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-slate-800 cursor-pointer hover:bg-white'}`}
              >
                <span className="font-medium tracking-wide">{formatEurope(endDate)}</span>
                <Calendar className={`w-4 h-4 ${editingTask ? 'text-slate-300' : 'text-slate-400'}`} />
                
                {/* De onzichtbare aandrijver */}
                <input
                  type="date"
                  ref={endDateRef}
                  required
                  disabled={!!editingTask}
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="absolute opacity-0 w-[1px] h-[1px] pointer-events-none overflow-hidden"
                />
              </div>
            </div>
          </div>

          {/* ... De rest van het formulier blijft identiek ... */}
          <div className="grid grid-cols-3 gap-4 bg-transparent">
            <div className="space-y-1 bg-transparent col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">TOEWIJZEN AAN</label>
              <select value={teamMemberId} required disabled={!isSuperuser} onChange={(e) => setTeamMemberId(e.target.value)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400">
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
            <select value={subject} onChange={(e) => setSubject(e.target.value as any)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none">
              <option value="Todo">Todo</option>
              <option value="Verlof">Verlof</option>
              <option value="Training">Training</option>
              <option value="Meeting">Meeting</option>
            </select>
          </div>

          <div id="field-description" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">OMSCHRIJVING {subject === 'Verlof' && '(OPTIONEEL)'}</label>
            <input type="text" required={subject !== 'Verlof'} placeholder={subject === 'Verlof' ? 'Optioneel (bijv. Doktersbezoek)' : 'Bijv. Project Meeting'} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none placeholder-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-transparent">
            <div id="field-start" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> START</label>
              <select required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none cursor-pointer">
                {ALLOWED_TIMES.map((time) => <option key={`start-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
            <div id="field-end" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> EINDE</label>
              <select required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none cursor-pointer">
                {ALLOWED_TIMES.map((time) => <option key={`end-${time}`} value={time}>{time}</option>)}
              </select>
            </div>
          </div>

          <div id="field-priority" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-blue-500" /> PRIORITEIT</label>
            <select value={priority} disabled={subject === 'Verlof' || subject === 'Training'} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full border border-slate-250 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none disabled:bg-slate-100 text-slate-700">
              {(subject === 'Todo' || subject === 'Verlof') && <option value={Priority.CRITICAL}>🔴 Critical / Kritiek</option>}
              {(subject === 'Todo' || subject === 'Training' || subject === 'Meeting') && <option value={Priority.HIGH}>🟠 High / Hoog</option>}
              {(subject === 'Todo' || subject === 'Meeting') && <option value={Priority.MEDIUM}>🟡 Medium</option>}
              {subject === 'Todo' && <option value={Priority.LOW}>🟢 Low / Laag</option>}
            </select>
          </div>

          {!editingTask && endDate === date && (
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
            <button id="btn-save-task" type="submit" className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/20 focus:outline-none cursor-pointer"><Check className="w-4.5 h-4.5" /><span>Opslaan</span></button>
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
