import { useState, useEffect, FormEvent } from 'react';
import { PRIORITY_COLORS } from '../constants';
import { Priority, Task, TeamMember } from '../types';
import { X, Calendar, Clock, AlertTriangle, Check, Trash2 } from 'lucide-react';

interface NieuweTaakModalProps {
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  editingTask?: Task | null;
  defaultDate?: string; // YYYY-MM-DD
  defaultMemberId?: string;
  teamMembers: TeamMember[];
  isSuperuser: boolean;
  currentUserId: string;
}

// ISO Week helper
function getISOWeek(dateStr: string): number {
  if (!dateStr) return 22;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 22;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const ALLOWED_TIMES = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
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
  
  const [date, setDate] = useState<string>(defaultDate || '2026-05-26');
  const [week, setWeek] = useState<number>(22);
  const [subject, setSubject] = useState<'Todo' | 'Verlof' | 'Training' | 'Meeting'>('Todo');
  const [description, setDescription] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('09:00');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(false); // State voor herhaling

  // Auto-calculate week based on date
  useEffect(() => {
    const calculatedWeek = getISOWeek(date);
    setWeek(calculatedWeek);
  }, [date]);

  // Dynamically update priority when subject changes
  useEffect(() => {
    if (subject === 'Verlof') {
      setPriority(Priority.CRITICAL);
    } else if (subject === 'Training') {
      setPriority(Priority.HIGH);
    } else if (subject === 'Meeting') {
      if (priority !== Priority.HIGH && priority !== Priority.MEDIUM) {
        setPriority(Priority.MEDIUM);
      }
    }
  }, [subject, priority]);

  // If editing a task, seed form with existing task data
  useEffect(() => {
    if (editingTask) {
      setDate(editingTask.date);
      setWeek(editingTask.week);
      setTeamMemberId(editingTask.teamMemberId);
      setDescription(editingTask.description);
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setPriority(editingTask.priority);
      if (editingTask.subject) {
        setSubject(editingTask.subject);
      } else {
        setSubject('Todo');
      }
    }
  }, [editingTask]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Weekend-beveiliging
    const dateParts = date.split('-');
    if (dateParts.length === 3) {
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10) - 1;
      const d = parseInt(dateParts[2], 10);
      const localDate = new Date(y, m, d);
      const dayOfWeek = localDate.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        alert('Plannen in het weekend is niet toegestaan!');
        return;
      }
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
      week,
      teamMemberId,
      subject,
      description: description.trim() || (subject === 'Verlof' ? 'Verlof' : ''),
      startTime,
      endTime,
      priority,
      repeatWeekly: !editingTask ? repeatWeekly : false // Stuur herhaling mee
    };

    if (editingTask) {
      payload.id = editingTask.id;
    }

    onSave(payload);
  };

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150 font-sans text-slate-900">
      <div
        id="modal-card"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col transform transition-all animate-scale-up"
      >
        {/* Header Block */}
        <div id="modal-header" className="flex justify-between items-center p-6 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 bg-transparent">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
              +
            </div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">
              {editingTask ? 'Taak Aanpassen' : 'Nieuw Agenda Item'}
            </h3>
          </div>
          <button
            id="btn-close-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form elements */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-transparent">
            {/* Datum */}
            <div id="field-date" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> DATUM
              </label>
              <input
                id="input-task-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow"
              />
            </div>

            {/* Week */}
            <div id="field-week" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                WEEK (AUTOMATISCH)
              </label>
              <input
                id="input-task-week"
                type="number"
                disabled
                value={week}
                className="w-full border border-slate-200 bg-slate-100 rounded-lg px-4 py-2 text-sm text-slate-500 font-mono cursor-not-allowed"
              />
            </div>
          </div>

          {/* Teamlid */}
          <div id="field-team-member" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              TOEWIJZEN AAN {!isSuperuser && '(VERGRENDELD)'}
            </label>
            <select
              id="select-task-member"
              value={teamMemberId}
              required
              disabled={!isSuperuser}
              onChange={(e) => setTeamMemberId(e.target.value)}
              className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.initials})
                </option>
              ))}
            </select>
          </div>

          {/* Onderwerp */}
          <div id="field-subject" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              ONDERWERP
            </label>
            <select
              id="select-task-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value as 'Todo' | 'Verlof' | 'Training' | 'Meeting')}
              className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow"
            >
              <option value="Todo">Todo</option>
              <option value="Verlof">Verlof</option>
              <option value="Training">Training</option>
              <option value="Meeting">Meeting</option>
            </select>
          </div>

          {/* Omschrijving */}
          <div id="field-description" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              OMSCHRIJVING {subject === 'Verlof' && '(OPTIONEEL)'}
            </label>
            <input
              id="input-task-description"
              type="text"
              required={subject !== 'Verlof'}
              placeholder={subject === 'Verlof' ? 'Optioneel (bijv. Doktersbezoek)' : 'Bijv. Project Meeting'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 placeholder-slate-400 transition-shadow"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-transparent">
            {/* Starttijd */}
            <div id="field-start" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> START
              </label>
              <select
                id="select-task-start"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow cursor-pointer"
              >
                {ALLOWED_TIMES.map((time) => (
                  <option key={`start-${time}`} value={time}>{time}</option>
                ))}
              </select>
            </div>

            {/* Eindtijd */}
            <div id="field-end" className="space-y-1 bg-transparent">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> EINDE
              </label>
              <select
                id="select-task-end"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow cursor-pointer"
              >
                {ALLOWED_TIMES.map((time) => (
                  <option key={`end-${time}`} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prioriteit */}
          <div id="field-priority" className="space-y-1 bg-transparent">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500" /> PRIORITEIT
            </label>
            <select
              id="select-task-priority"
              value={priority}
              disabled={subject === 'Verlof' || subject === 'Training'}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full border border-slate-250 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-shadow disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              {(subject === 'Todo' || subject === 'Verlof') && (
                <option value={Priority.CRITICAL}>🔴 Critical / Kritiek</option>
              )}
              {(subject === 'Todo' || subject === 'Training' || subject === 'Meeting') && (
                <option value={Priority.HIGH}>🟠 High / Hoog</option>
              )}
              {(subject === 'Todo' || subject === 'Meeting') && (
                <option value={Priority.MEDIUM}>🟡 Medium</option>
              )}
              {subject === 'Todo' && (
                <option value={Priority.LOW}>🟢 Low / Laag</option>
              )}
            </select>
          </div>

          {/* NIEUW: SELECTIEVINKJE VOOR WEKELIJKSE HERHALING (Alleen zichtbaar bij nieuwe taken) */}
          {!editingTask && (
            <div className="flex items-center gap-2.5 bg-blue-50/50 border border-blue-100 rounded-xl p-3 select-none">
              <input
                id="checkbox-repeat-weekly"
                type="checkbox"
                checked={repeatWeekly}
                onChange={(e) => setRepeatWeekly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="checkbox-repeat-weekly" className="text-xs font-bold text-blue-900 cursor-pointer uppercase tracking-wide">
                🔄 Wekelijks herhalen tot einde jaar
              </label>
            </div>
          )}

          {/* Submit Actions Area */}
          <div id="modal-actions" className="pt-5 mt-4 flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-6">
            {editingTask && onDelete ? (
              <button
                id="btn-delete-task"
                type="button"
                onClick={() => onDelete(editingTask.id)}
                className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-4 py-2.5 rounded-lg border border-rose-200 text-sm transition-all focus:outline-none hover:shadow-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wissen</span>
              </button>
            ) : (
              <button
                id="btn-annuleren"
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-slate-250 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase tracking-wider text-xs cursor-pointer"
              >
                Annuleren
              </button>
            )}

            <button
              id="btn-save-task"
              type="submit"
              className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/20 focus:outline-none cursor-pointer"
            >
              <Check className="w-4.5 h-4.5" />
              <span>Opslaan</span>
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .animate-scale-up {
          animation: scaleUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
