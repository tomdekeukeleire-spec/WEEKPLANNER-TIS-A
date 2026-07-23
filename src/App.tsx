import { useState, useEffect, useRef } from 'react';
import { UserSession, Task, Priority, TeamMember } from './types';
import LoginScreen from './components/LoginScreen';
import TeamPlanner from './components/TeamPlanner';
import WeekOverview from './components/WeekOverview';
import PlannerCanvas from './components/PlannerCanvas';
import ArchiveScreen from './components/ArchiveScreen';
import TeamSettingsScreen from './components/TeamSettingsScreen';
import NieuweTaakModal from './components/NieuweTaakModal';
import { teamMembers as initialTeamMembers } from './constants';
import { supabase } from './supabase';
import { 
  LogOut, 
  CalendarDays, 
  CalendarRange,
  BarChart3, 
  Archive, 
  Settings 
} from 'lucide-react';

// ==========================================
// SCHONE EN VEILIGE HULPFUNCTIES
// ==========================================

function parseTimeToDecimal(timeStr: string | null | undefined): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return 0; 
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

function getISOWeekFromDate(d: Date): number {
  if (!d || isNaN(d.getTime())) return 22;
  const dateCopy = new Date(d.getTime());
  dateCopy.setHours(0, 0, 0, 0);
  dateCopy.setDate(dateCopy.getDate() + 3 - (dateCopy.getDay() + 6) % 7);
  const week1 = new Date(dateCopy.getFullYear(), 0, 4);
  return 1 + Math.round(((dateCopy.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function dbToTask(row: any): Task {
  return {
    id: String(row.id),
    date: row.date,
    week: Number(row.week),
    teamMemberId: String(row.assigned_to),
    subject: row.subject || undefined,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    priority: row.priority as Priority,
    createdBy: row.created_by || 'User',
    createdAt: Number(row.created_at),
    status: row.status || 'active'
  };
}

function taskToDb(task: Partial<Task>): any {
  const row: any = {};
  if (task.id !== undefined) row.id = task.id;
  if (task.date !== undefined) row.date = task.date;
  if (task.week !== undefined) row.week = Number(task.week);
  if (task.teamMemberId !== undefined) row.assigned_to = task.teamMemberId;
  if (task.subject !== undefined) row.subject = task.subject || null;
  if (task.description !== undefined) row.description = task.description;
  if (task.startTime !== undefined) row.start_time = task.startTime;
  if (task.endTime !== undefined) row.end_time = task.endTime;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.createdBy !== undefined) row.created_by = task.createdBy;
  if (task.createdAt !== undefined) row.created_at = task.createdAt;
  if (task.status !== undefined) row.status = task.status;
  return row;
}

// ==========================================
// HOOFD COMPONENT
// ==========================================
export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembersState, setTeamMembersState] = useState<TeamMember[]>([]); 
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true); 
  const [activeTab, setActiveTab] = useState<'dag' | 'week' | 'analytics' | 'archive' | 'settings'>('dag');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const jjjj = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${jjjj}-${mm}-${dd}`;
  });

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultTaskMemberId, setDefaultTaskMemberId] = useState<string>('');
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>('08:00');
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

  const triggerNotification = (msg: string) => {
    if (notificationTimeoutRef.current) window.clearTimeout(notificationTimeoutRef.current);
    setNotification(msg);
    notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), 4000);
  };

  // Sync Team Members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          setTeamMembersState(initialTeamMembers);
        } else if (data && data.length > 0) {
          setTeamMembersState(data);
        } else {
          setTeamMembersState(initialTeamMembers);
        }
      } catch (err) {
        setTeamMembersState(initialTeamMembers);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchTeamMembers();
  }, []);

  // Sync Google Session
  useEffect(() => {
    if (loadingMembers) return; 

    const syncUserSession = (sbSession: any) => {
      if (!sbSession?.user) {
        setSession(null);
        return;
      }

      const user = sbSession.user;
      const email = user.email || '';
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Teamlid';

      const isTom = email.toLowerCase().includes('tom.de.keukeleire') || fullName.toLowerCase().includes('tom de keukeleire');
      const isBart = email.toLowerCase().includes('bart.vanneste') || fullName.toLowerCase().includes('bart vanneste');

      if (isTom) {
        setSession({ memberId: 'tom-id', name: 'Tom De Keukeleire', initials: 'TDK', role: 'Superuser' });
        setAuthError(null);
        return;
      }
      if (isBart) {
        setSession({ memberId: 'bart-id', name: 'Bart Vanneste', initials: 'BVE', role: 'Superuser' });
        setAuthError(null);
        return;
      }

      const matched = teamMembersState.find(m => {
        const dbEmail = (m as any).email;
        if (!dbEmail || typeof dbEmail !== 'string') return false;
        return dbEmail.trim().toLowerCase() === email.trim().toLowerCase();
      });
      
      if (matched) {
        setSession({ memberId: matched.id, name: matched.name, initials: matched.initials, role: 'User' });
        setAuthError(null);
      } else {
        supabase.auth.signOut();
        setSession(null);
        setAuthError(`Toegang geweigerd. Uw TVH-account (${email}) is niet geautoriseerd voor deze weekplanner. Neem contact op met Tom of Bart.`);
      }
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => syncUserSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => syncUserSession(s));

    return () => subscription.unsubscribe();
  }, [teamMembersState, loadingMembers]);

  // Tasks Sync
  useEffect(() => {
    if (!session) return;
    const fetchTasks = async () => {
      const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
      if (data) setTasks(data.map(dbToTask));
    };
    fetchTasks();

    const channel = supabase
      .channel('public:tasks-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const mapped = dbToTask(payload.new);
          setTasks((prev) => prev.some((t) => t.id === mapped.id) ? prev : [...prev, mapped]);
        } else if (payload.eventType === 'UPDATE') {
          const mapped = dbToTask(payload.new);
          setTasks((prev) => prev.map((t) => t.id === mapped.id ? mapped : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleLogout = async () => {
    if (confirm('Weet u zeker dat u wilt afmelden?')) {
      await supabase.auth.signOut();
      setSession(null);
      setTasks([]);
    }
  };

  const handleAddTaskTrigger = (memberId: string, initialHour?: string, specificDate?: string) => {
    setEditingTask(null);
    const targetId = memberId || (session?.role === 'Superuser' ? teamMembersState[0]?.id : session?.memberId) || '';
    
    // Zorg ervoor dat de app overschakelt naar de juiste dag als we vanuit het weekoverzicht klikken
    if (specificDate) {
      setSelectedDate(specificDate);
    }
    
    setDefaultTaskMemberId(targetId);
    setDefaultTaskTime(initialHour || '08:00');
    setIsModalOpen(true);
  };

  const handleEditTaskTrigger = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskPayload: any) => {
    setIsModalOpen(false);

    const initialDate = taskPayload.date || selectedDate;
    const endDate = taskPayload.endDate || initialDate;
    const isLeaveOrSickness = taskPayload.subject === 'Verlof' || taskPayload.subject === 'Ziekte';

    // -------------------------------------------------------------
    // LOGICA VOOR VERLOF / ZIEKTE (AUTOMATISCH ANNULLEREN OP DE ACHTERGROND)
    // -------------------------------------------------------------
    if (isLeaveOrSickness && !taskPayload.id) {
      const conflicts = tasks.filter(t => {
        if (t.teamMemberId !== taskPayload.teamMemberId || t.status !== 'active' || t.date < initialDate || t.date > endDate) {
          return false;
        }
        const tStart = parseTimeToDecimal(t.startTime);
        const tEnd = parseTimeToDecimal(t.endTime);
        const pStart = parseTimeToDecimal(taskPayload.startTime);
        const pEnd = parseTimeToDecimal(taskPayload.endTime);
        return tStart < pEnd && tEnd > pStart;
      });

      if (conflicts.length > 0) {
        const conflictIds = conflicts.map(c => c.id);
        setTasks(prev => prev.map(t => conflictIds.includes(t.id) ? { ...t, status: 'cancelled' as any } : t));
        
        // FOUTAFHANDELING TOEGEVOEGD
        const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).in('id', conflictIds);
        if (error) alert(`Database fout (Annuleren): ${error.message}`);
      }
    }

    // -------------------------------------------------------------
    // LOGICA VOOR REGULIERE CONFLICT RESOLUTIE (SPLITSEN OF VERVANGEN)
    // -------------------------------------------------------------
    if (taskPayload.conflictResolution && taskPayload.conflictTaskId) {
      const confId = taskPayload.conflictTaskId;
      const targetOldTask = tasks.find(t => t.id === confId);

      if (targetOldTask) {
        if (taskPayload.conflictResolution === 'overwrite') {
          setTasks(prev => prev.filter(t => t.id !== confId));
          const { error } = await supabase.from('tasks').delete().eq('id', confId);
          if (error) alert(`Database fout (Overschrijven): ${error.message}`);
        } 
        else if (taskPayload.conflictResolution === 'split') {
          const oldStart = targetOldTask.startTime;
          const oldEnd = targetOldTask.endTime;
          const newStart = taskPayload.startTime;
          const newEnd = taskPayload.endTime;

          if (oldStart < newStart) {
            const { error } = await supabase.from('tasks').update({ end_time: newStart }).eq('id', confId);
            if (error) alert(`Database fout (Splitsen begin): ${error.message}`);
          } else {
            const { error } = await supabase.from('tasks').delete().eq('id', confId);
            if (error) alert(`Database fout (Verwijderen deel): ${error.message}`);
          }

          if (oldEnd > newEnd) {
            const remainderId = Math.random().toString(36).substring(2, 9);
            const remainderTask: Task = { ...targetOldTask, id: remainderId, startTime: newEnd, endTime: oldEnd, createdAt: Date.now() };
            const { error } = await supabase.from('tasks').insert(taskToDb(remainderTask));
            if (error) alert(`Database fout (Splitsen staart): ${error.message}`);
          }
        }
      }
    }

    // =============================================================
    // VOLG DE REGULIERE OPSLAGKETEN (EXPLICIETE FOUTAFHANDELING)
    // =============================================================
    if (taskPayload.id) {
      const index = tasks.findIndex(t => t.id === taskPayload.id);
      if (index === -1) return;
      const original = tasks[index];
      const updatedTask = { ...original, ...taskPayload } as Task;
      setTasks(prev => { const c = [...prev]; c[index] = updatedTask; return c; });

      // FIX: Check error op Update
      const { error } = await supabase.from('tasks').update(taskToDb(updatedTask)).eq('id', updatedTask.id);
      if (error) {
        alert(`❌ Fout bij updaten in database: ${error.message}`);
        setTasks(prev => { const c = [...prev]; c[index] = original; return c; });
      }

    } else {
      if (endDate && endDate !== initialDate) {
        // Meerdere dagen logica (ingekort voor leesbaarheid)
        const generatedTasks: Task[] = [];
        const dbRows: any[] = [];
        const [sY, sM, sD] = initialDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        let current = new Date(sY, sM - 1, sD);
        const end = new Date(eY, eM - 1, eD);

        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const yyyy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            const dd = String(current.getDate()).padStart(2, '0');
            const newTask: Task = {
              id: Math.random().toString(36).substring(2, 9),
              date: `${yyyy}-${mm}-${dd}`,
              week: getISOWeekFromDate(current),
              teamMemberId: taskPayload.teamMemberId!,
              subject: taskPayload.subject,
              description: taskPayload.description!,
              startTime: taskPayload.startTime!,
              endTime: taskPayload.endTime!,
              priority: taskPayload.priority!,
              createdBy: session?.name || 'User',
              createdAt: Date.now(),
              status: 'active'
            };
            generatedTasks.push(newTask);
            dbRows.push(taskToDb(newTask));
          }
          current.setDate(current.getDate() + 1); 
        }

        if (generatedTasks.length === 0) return alert('De geselecteerde periode bevat geen werkdagen!');

        setTasks(prev => [...prev, ...generatedTasks]);
        
        // FIX: Check error op Multi-Insert
        const { error } = await supabase.from('tasks').insert(dbRows);
        if (error) {
          alert(`❌ Database fout (Periode): ${error.message}`);
          const addedIds = generatedTasks.map(t => t.id);
          setTasks(prev => prev.filter(t => !addedIds.includes(t.id)));
        } else {
          triggerNotification(`📅 Periode succesvol ingepland voor ${generatedTasks.length} werkdagen!`);
        }

      } else if (taskPayload.repeatWeekly) {
         // Wekelijkse herhaling logica
        const targetYear = new Date(initialDate).getFullYear();
        const generatedTasks: Task[] = [];
        const dbRows: any[] = [];
        let currentNewDate = new Date(initialDate);

        while (currentNewDate.getFullYear() === targetYear) {
          const newTask: Task = {
            id: Math.random().toString(36).substring(2, 9),
            date: currentNewDate.toISOString().split('T')[0],
            week: getISOWeekFromDate(currentNewDate),
            teamMemberId: taskPayload.teamMemberId!,
            subject: taskPayload.subject,
            description: taskPayload.description!,
            startTime: taskPayload.startTime!,
            endTime: taskPayload.endTime!,
            priority: taskPayload.priority!,
            createdBy: session?.name || 'User',
            createdAt: Date.now(),
            status: 'active'
          };
          generatedTasks.push(newTask);
          dbRows.push(taskToDb(newTask));
          currentNewDate.setDate(currentNewDate.getDate() + 7);
        }

        setTasks(prev => [...prev, ...generatedTasks]);
        
        // FIX: Check error op Multi-Insert Wekelijks
        const { error } = await supabase.from('tasks').insert(dbRows);
        if (error) {
          alert(`❌ Database fout (Wekelijks): ${error.message}`);
          const addedIds = generatedTasks.map(t => t.id);
          setTasks(prev => prev.filter(t => !addedIds.includes(t.id)));
        } else {
          triggerNotification(`🔄 Wederkerend item succesvol ingepland voor ${generatedTasks.length} weken!`);
        }

      } else {
        // ENKELE TAAK AANMAKEN
        const newId = Math.random().toString(36).substring(2, 9);
        const newTask: Task = {
          id: newId,
          date: initialDate,
          week: taskPayload.week || 22,
          teamMemberId: taskPayload.teamMemberId!,
          subject: taskPayload.subject,
          description: taskPayload.description!,
          startTime: taskPayload.startTime!,
          endTime: taskPayload.endTime!,
          priority: taskPayload.priority!,
          createdBy: session?.name || 'User',
          createdAt: Date.now(),
          status: 'active'
        };
        setTasks(prev => [...prev, newTask]);
        
        // FIX: Check error op Single Insert!
        const { error } = await supabase.from('tasks').insert([taskToDb(newTask)]);
        if (error) {
          alert(`❌ De database weigert deze taak! Reden: ${error.message}`);
          setTasks(prev => prev.filter(t => t.id !== newId));
        }
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsModalOpen(false);
    const targetTask = tasks.find(t => t.id === taskId);
    const original = [...tasks];
    
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // FIX: Check error op Delete
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    
    if (error) {
      alert(`❌ Fout bij verwijderen: ${error.message}`);
      setTasks(original);
    } else {
      if (targetTask && (targetTask.subject === 'Verlof' || targetTask.subject === 'Ziekte')) {
        const hiddenConflicts = original.filter(t => t.teamMemberId === targetTask.teamMemberId && t.date === targetTask.date && t.status === 'cancelled');
        if (hiddenConflicts.length > 0) {
          const hiddenIds = hiddenConflicts.map(h => h.id);
          setTasks(prev => prev.map(t => hiddenIds.includes(t.id) ? { ...t, status: 'active' as any } : t));
          await supabase.from('tasks').update({ status: 'active' }).in('id', hiddenIds);
          triggerNotification(`♻️ Onderliggende taken automatisch heractiveerd en herkleurd!`);
        }
      }
    }
  };

  if (loadingMembers) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (authError) return <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12"><div className="sm:mx-auto w-full max-w-md bg-white py-8 px-4 shadow rounded-lg text-center"><p className="text-xs text-slate-500 mb-6">{authError}</p></div></div>;
  if (!session) return <LoginScreen />;

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-900">
      {notification && (
        <div className="fixed bottom-5 right-5 bg-white border border-slate-200 px-5 py-3.5 rounded-xl shadow-2xl z-50 flex items-center gap-3">
          <div className="text-xs font-semibold leading-tight">{notification}</div>
        </div>
      )}

      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center shadow-sm shrink-0 z-40 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-md">C</div>
          <div><p className="text-[10px] text-slate-400 font-bold uppercase">Weekplanner</p><h1 className="text-xl font-bold text-slate-800">Task Canvas</h1></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center">
            <button onClick={() => setActiveTab('dag')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg ${activeTab === 'dag' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><CalendarDays className="w-4 h-4" /><span>Dag</span></button>
            <button onClick={() => setActiveTab('week')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg ${activeTab === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><CalendarRange className="w-4 h-4" /><span>Week</span></button>
            <button onClick={() => setActiveTab('archive')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg ${activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Archive className="w-4 h-4" /><span>Archief</span></button>
            {session?.role === 'Superuser' && <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Settings className="w-4 h-4" /><span>Instellingen</span></button>}
          </div>
          <button onClick={handleLogout} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 ml-1"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6">
        {activeTab === 'dag' ? <TeamPlanner tasks={tasks} onAddTask={handleAddTaskTrigger} onEditTask={handleEditTaskTrigger} selectedDate={selectedDate} setSelectedDate={setSelectedDate} searchTerm={searchTerm} setSearchTerm={setSearchTerm} activeUsers={[]} teamMembers={teamMembersState} />
        : activeTab === 'week' ? <WeekOverview tasks={tasks} teamMembers={teamMembersState} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onEditTask={handleEditTaskTrigger} onAddTask={handleAddTaskTrigger} />
        : activeTab === 'analytics' ? <PlannerCanvas tasks={tasks} teamMembers={teamMembersState} />
        : activeTab === 'archive' ? <ArchiveScreen tasks={tasks} teamMembers={teamMembersState} onEditTask={handleEditTaskTrigger} />
        : session?.role === 'Superuser' ? <TeamSettingsScreen teamMembers={teamMembersState} tasks={tasks} onTriggerNotification={triggerNotification} />
        : <div className="text-center mt-12">Geen toegang</div>}
      </main>

      {isModalOpen && <NieuweTaakModal onClose={() => setIsModalOpen(false)} onSave={handleSaveTask} onDelete={handleDeleteTask} editingTask={editingTask} defaultDate={selectedDate} defaultTime={defaultTaskTime} defaultMemberId={defaultTaskMemberId} teamMembers={teamMembersState} isSuperuser={session?.role === 'Superuser'} currentUserId={session?.memberId || ''} tasks={tasks} />}
    </div>
  );
}
