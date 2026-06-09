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

// VEILIG: Convert "HH:MM" naar decimaal getal (voorkomt crashes op lege/foute data)
function parseTimeToDecimal(timeStr: string | null | undefined): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return 0; 
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

// VEILIG: ISO Weeknummer berekenen op basis van Date object
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
    id: row.id,
    date: row.date,
    week: Number(row.week),
    teamMemberId: row.assigned_to,
    subject: row.subject || undefined,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    priority: row.priority as Priority,
    createdBy: row.created_by || 'User',
    createdAt: Number(row.created_at)
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

  // Sync Team Members vanuit de database
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

  // Sync Google Session + Harde Poortwachter controle (NU COMPLEET CRASH-PROOF)
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

      // 1. VIP Ingang: Tom of Bart (Altijd direct Superuser)
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

      // 2. CRASH-PROOF MATCHING: Controleer eerst of het database-veld text bevat om crashes te voorkomen!
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

  const handleAddTaskTrigger = (memberId: string, initialHour?: string) => {
    setEditingTask(null);
    const targetId = memberId || (session?.role === 'Superuser' ? teamMembersState[0]?.id : session?.memberId) || '';
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

    const tStart = parseTimeToDecimal(taskPayload.startTime || '08:00');
    const tEnd = parseTimeToDecimal(taskPayload.endTime || '09:00');
    const initialDate = taskPayload.date || selectedDate;

    const hasConflict = tasks.some(t => 
      t.teamMemberId === taskPayload.teamMemberId &&
      t.date === initialDate &&
      t.id !== taskPayload.id &&
      (parseTimeToDecimal(t.startTime) < tEnd && parseTimeToDecimal(t.endTime) > tStart)
    );

    if (hasConflict) {
      const proceed = window.confirm(`⚠️ Let op: Dit teamlid heeft al een andere taak gepland op dit tijdstip (${taskPayload.startTime} - ${taskPayload.endTime}). Wilt u deze boeking toch forceren?`);
      if (!proceed) return;
    }

    if (taskPayload.id) {
      const index = tasks.findIndex(t => t.id === taskPayload.id);
      if (index === -1) return;
      const original = tasks[index];
      const updatedTask = { ...original, ...taskPayload } as Task;
      setTasks(prev => { const c = [...prev]; c[index] = updatedTask; return c; });

      try {
        await supabase.from('tasks').update(taskToDb(updatedTask)).eq('id', updatedTask.id);
      } catch {
        setTasks(prev => { const c = [...prev]; c[index] = original; return c; });
      }
    } else {
      if (taskPayload.repeatWeekly) {
        const generatedTasks: Task[] = [];
        const dbRows: any[] = [];
        let currentNewDate = new Date(initialDate);

        while (currentNewDate.getFullYear() === 2026) {
          const dateStr = currentNewDate.toISOString().split('T')[0];
          const calculatedWeek = getISOWeekFromDate(currentNewDate);
          const generatedId = Math.random().toString(36).substring(2, 9);

          const newTask: Task = {
            id: generatedId,
            date: dateStr,
            week: calculatedWeek,
            teamMemberId: taskPayload.teamMemberId!,
            subject: taskPayload.subject,
            description: taskPayload.description!,
            startTime: taskPayload.startTime!,
            endTime: taskPayload.endTime!,
            priority: taskPayload.priority!,
            createdBy: session?.name || 'User',
            createdAt: Date.now()
          };

          generatedTasks.push(newTask);
          dbRows.push(taskToDb(newTask));
          currentNewDate.setDate(currentNewDate.getDate() + 7);
        }

        setTasks(prev => [...prev, ...generatedTasks]);
        try {
          await supabase.from('tasks').insert(dbRows);
          triggerNotification(`🔄 Wederkerend item succesvol ingepland voor ${generatedTasks.length} weken!`);
        } catch {
          const addedIds = generatedTasks.map(t => t.id);
          setTasks(prev => prev.filter(t => !addedIds.includes(t.id)));
        }

      } else {
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
          createdAt: Date.now()
        };
        setTasks(prev => [...prev, newTask]);
        try {
          await supabase.from('tasks').insert(taskToDb(newTask));
        } catch {
          setTasks(prev => prev.filter(t => t.id !== newId));
        }
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsModalOpen(false);
    const original = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch {
      setTasks(original);
    }
  };

  if (loadingMembers) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Systeem Beveiliging Laden...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto w-full max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">⚠️</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Geen Toegang</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">{authError}</p>
            <button onClick={() => setAuthError(null)} className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg transition-colors">Terug naar login</button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-900">
      {notification && (
        <div className="fixed bottom-5 right-5 bg-white border border-slate-200 text-slate-800 px-5 py-3.5 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in max-w-sm ring-4 ring-blue-500/5">
          <div className="text-xs font-semibold leading-tight">{notification}</div>
        </div>
      )}

      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center shadow-sm shrink-0 z-40 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-md">C</div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Weekplanner TIS-A</p>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Collaborative Task Canvas</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center">
            <button onClick={() => setActiveTab('dag')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'dag' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><CalendarDays className="w-4 h-4" /><span>Dagoverzicht</span></button>
            <button onClick={() => setActiveTab('week')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><CalendarRange className="w-4 h-4" /><span>Weekoverzicht</span></button>
            <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'analytics' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><BarChart3 className="w-4 h-4" /><span>Analytics</span></button>
            <button onClick={() => setActiveTab('archive')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Archive className="w-4 h-4" /><span>Archief</span></button>
            
            {session?.role === 'Superuser' && (
              <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Settings className="w-4 h-4" /><span>Instellingen</span></button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pr-3 h-11">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">{session.initials}</div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-none">{session.name}</p>
              <p className="text-[9px] text-slate-400 font-mono tracking-tight mt-0.5">{session.role}</p>
            </div>
            <button onClick={handleLogout} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 ml-1 cursor-pointer" title="Afmelden"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6">
        {activeTab === 'dag' ? (
          <TeamPlanner tasks={tasks} onAddTask={handleAddTaskTrigger} onEditTask={handleEditTaskTrigger} selectedDate={selectedDate} setSelectedDate={setSelectedDate} searchTerm={searchTerm} setSearchTerm={setSearchTerm} activeUsers={[]} teamMembers={teamMembersState} />
        ) : activeTab === 'week' ? (
          <WeekOverview tasks={tasks} teamMembers={teamMembersState} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onEditTask={handleEditTaskTrigger} />
        ) : activeTab === 'analytics' ? (
          <PlannerCanvas tasks={tasks} teamMembers={teamMembersState} />
        ) : activeTab === 'archive' ? (
          <ArchiveScreen tasks={tasks} teamMembers={teamMembersState} onEditTask={handleEditTaskTrigger} />
        ) : activeTab === 'settings' && session?.role === 'Superuser' ? (
          <TeamSettingsScreen teamMembers={teamMembersState} tasks={tasks} onTriggerNotification={triggerNotification} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto my-12 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">⚠️</div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Toegang Geweigerd</h3>
            <p className="text-sm text-slate-500">U heeft geen beheerdersrechten om de instellingen te bekijken.</p>
          </div>
        )}
      </main>

      {isModalOpen && (
        <NieuweTaakModal 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveTask} 
          onDelete={handleDeleteTask} 
          editingTask={editingTask} 
          defaultDate={selectedDate} 
          defaultMemberId={defaultTaskMemberId}
          teamMembers={teamMembersState} 
          isSuperuser={session?.role === 'Superuser'}
          currentUserId={session?.memberId || ''}
        />
      )}
    </div>
  );
}
