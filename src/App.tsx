import { useState, useEffect, useRef } from 'react';
import { UserSession, Task, Priority, TeamMember } from './types';
import LoginScreen from './components/LoginScreen';
import TeamPlanner from './components/TeamPlanner';
import PlannerCanvas from './components/PlannerCanvas';
import ArchiveScreen from './components/ArchiveScreen';
import TeamSettingsScreen from './components/TeamSettingsScreen';
import NieuweTaakModal from './components/NieuweTaakModal';
import { teamMembers as initialTeamMembers } from './constants';
import { supabase } from './supabase';
import { 
  LogOut, 
  CalendarDays, 
  BarChart3, 
  Archive, 
  Bell, 
  Settings 
} from 'lucide-react';

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

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembersState, setTeamMembersState] = useState<TeamMember[]>(initialTeamMembers);
  const [activeTab, setActiveTab] = useState<'agenda' | 'analytics' | 'archive' | 'settings'>('agenda');

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
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>('09:00');
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
        }
      } catch (err) {
        setTeamMembersState(initialTeamMembers);
      }
    };
    fetchTeamMembers();
  }, []);

  // Sync Google Auth Browser Session + Auto Login / Superuser Router
  useEffect(() => {
    const syncUserSession = (sbSession: any) => {
      if (!sbSession?.user) {
        setSession(null);
        return;
      }

      const user = sbSession.user;
      const email = user.email || '';
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Teamlid';

      // INTERNE CONTROLE: Superusers (Tom & Bart) definiëren op basis van Google-profiel
      const isTom = email.toLowerCase().includes('tom.de.keukeleire') || fullName.toLowerCase().includes('tom de keukeleire');
      const isBart = email.toLowerCase().includes('bart.vanneste') || fullName.toLowerCase().includes('bart vanneste');

      if (isTom) {
        setSession({ memberId: 'tom-id', name: 'Tom De Keukeleire', initials: 'TDK', role: 'Superuser' });
        return;
      }
      if (isBart) {
        setSession({ memberId: 'bart-id', name: 'Bart Vanneste', initials: 'BVE', role: 'Superuser' });
        return;
      }

      // Reguliere gebruikers automatisch matchen met de database op basis van naam
      const matched = teamMembersState.find(m => fullName.toLowerCase().includes(m.name.toLowerCase()));
      if (matched) {
        setSession({ memberId: matched.id, name: matched.name, initials: matched.initials, role: 'User' });
      } else {
        // Fallback voor onbekende profielen
        const initials = fullName.split(' ').map((n: any) => n[0]).join('').toUpperCase().substring(0, 3);
        setSession({ memberId: 'gen-' + user.id.substring(0, 4), name: fullName, initials, role: 'User' });
      }
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => syncUserSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => syncUserSession(s));

    return () => subscription.unsubscribe();
  }, [teamMembersState]);

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
    // Als superuser klikt, standaard de eerste medewerker selecteren ipv de eigen superuser-id
    const targetId = memberId || (session?.role === 'Superuser' ? teamMembersState[0]?.id : session?.memberId) || '';
    setDefaultTaskMemberId(targetId);
    setDefaultTaskTime(initialHour || '09:00');
    setIsModalOpen(true);
  };

  const handleEditTaskTrigger = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskPayload: Partial<Task>) => {
    setIsModalOpen(false);
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
      const newId = Math.random().toString(36).substring(2, 9);
      const newTask: Task = {
        id: newId,
        date: taskPayload.date || selectedDate,
        week: taskPayload.week || 22,
        teamMemberId: taskPayload.teamMemberId!,
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
            <button onClick={() => setActiveTab('agenda')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'agenda' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><CalendarDays className="w-4 h-4" /><span>Overzicht</span></button>
            <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'analytics' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><BarChart3 className="w-4 h-4" /><span>Analytics</span></button>
            <button onClick={() => setActiveTab('archive')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Archive className="w-4 h-4" /><span>Archief</span></button>
            <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Settings className="w-4 h-4" /><span>Instellingen</span></button>
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
        {activeTab === 'agenda' ? (
          <TeamPlanner tasks={tasks} onAddTask={handleAddTaskTrigger} onEditTask={handleEditTaskTrigger} selectedDate={selectedDate} setSelectedDate={setSelectedDate} searchTerm={searchTerm} setSearchTerm={setSearchTerm} activeUsers={[]} teamMembers={teamMembersState} />
        ) : activeTab === 'analytics' ? (
          <PlannerCanvas tasks={tasks} teamMembers={teamMembersState} />
        ) : activeTab === 'archive' ? (
          <ArchiveScreen tasks={tasks} teamMembers={teamMembersState} />
        ) : (
          <TeamSettingsScreen teamMembers={teamMembersState} tasks={tasks} onTriggerNotification={triggerNotification} />
        )}
      </main>

      {isModalOpen && (
        <NieuweTaakModal onClose={() => setIsModalOpen(false)} onSave={handleSaveTask} onDelete={handleDeleteTask} editingTask={editingTask} defaultDate={selectedDate} teamMembers={teamMembersState} />
      )}
    </div>
  );
}
