import { useState, useEffect, useRef, useMemo } from 'react';
import { UserSession, Task, WebSocketMessage, Priority, TeamMember } from './types';
import LoginScreen from './components/LoginScreen';
import TeamPlanner from './components/TeamPlanner';
import PlannerCanvas from './components/PlannerCanvas';
import ArchiveScreen from './components/ArchiveScreen';
import TeamSettingsScreen from './components/TeamSettingsScreen';
import NieuweTaakModal from './components/NieuweTaakModal';
import { teamMembers as initialTeamMembers } from './constants';
import { supabase } from './supabase';
import { 
  FolderLock, 
  Sparkles, 
  Network, 
  LogOut, 
  HelpCircle,
  CalendarDays,
  BarChart3,
  Archive,
  RefreshCw,
  Bell,
  Settings,
  Users
} from 'lucide-react';

// Conversion helpers mapping local structure to user's Supabase tasks table format
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
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-26');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch team members from Supabase and subscribe to PostgreSQL change events in real-time
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading team members from Supabase:', error);
          setTeamMembersState(initialTeamMembers);
        } else if (data && data.length > 0) {
          setTeamMembersState(data);
        } else {
          setTeamMembersState(initialTeamMembers);
          for (const member of initialTeamMembers) {
            await supabase.from('team_members').upsert(member);
          }
        }
      } catch (err) {
        console.error('Network block loading team members:', err);
        setTeamMembersState(initialTeamMembers);
      }
    };

    fetchTeamMembers();

    // Subscribe to REALTIME postgres updates for dynamic team list
    const teamChannel = supabase
      .channel('public:team_members-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        (payload) => {
          console.log('Realtime change in team_members:', payload);
          if (payload.eventType === 'INSERT') {
            const m = payload.new as TeamMember;
            setTeamMembersState((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              return [...prev, m];
            });
          } else if (payload.eventType === 'UPDATE') {
            const m = payload.new as TeamMember;
            setTeamMembersState((prev) => {
              const idx = prev.findIndex((x) => x.id === m.id);
              if (idx === -1) return [...prev, m];
              const copy = [...prev];
              copy[idx] = m;
              return copy;
            });
          } else if (payload.eventType === 'DELETE') {
            const delId = payload.old.id;
            setTeamMembersState((prev) => prev.filter((x) => x.id !== delId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(teamChannel);
    };
  }, []);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultTaskMemberId, setDefaultTaskMemberId] = useState<string>('');
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>('09:00');

  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connected');
  const [activeUsers, setActiveUsers] = useState<UserSession[]>([]);

  // Instant action notifications banners state
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

  const triggerNotification = (msg: string) => {
    if (notificationTimeoutRef.current) {
      window.clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(msg);
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Restore session from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('planner_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('planner_session');
      }
    }
  }, []);

  // Fetch tasks from Supabase and subscribe to PostgreSQL change events in real-time
  useEffect(() => {
    if (!session) return;

    const fetchTasksFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading tasks from Supabase:', error);
          triggerNotification('💡 Supabase verbinding actief! Voeg uw eerste taak toe of voer de setup SQL uit.');
        } else if (data) {
          setTasks(data.map(dbToTask));
        }
      } catch (err) {
        console.error('Network block loading Supabase:', err);
      }
    };

    fetchTasksFromSupabase();

    // Subscribe to REALTIME postgres updates
    const channel = supabase
      .channel('public:tasks-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('Flipped realtime block payload:', payload);
          if (payload.eventType === 'INSERT') {
            const mapped = dbToTask(payload.new);
            setTasks((prev) => {
              if (prev.some((t) => t.id === mapped.id)) return prev;
              return [...prev, mapped];
            });
            triggerNotification(`➕ Taak toegevoegd: "${mapped.description}"`);
          } else if (payload.eventType === 'UPDATE') {
            const mapped = dbToTask(payload.new);
            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === mapped.id);
              if (idx === -1) return [...prev, mapped];
              const copy = [...prev];
              copy[idx] = mapped;
              return copy;
            });
            triggerNotification(`✏️ Taak herzien: "${mapped.description}"`);
          } else if (payload.eventType === 'DELETE') {
            const delId = payload.old.id;
            setTasks((prev) => prev.filter((t) => t.id !== delId));
            triggerNotification(`🗑️ Een taak is verwijderd`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // FIX: Neutralized broken WebSocket connection loops to stop Vercel from crashing
  useEffect(() => {
    if (!session) return;
    setSocketStatus('connected');
    setActiveUsers([session]);
  }, [session]);

  const handleLoginSuccess = (user: UserSession) => {
    localStorage.setItem('planner_session', JSON.stringify(user));
    setSession(user);
    triggerNotification(`🔓 Welkom terug, ${user.name}!`);
  };

  const handleLogout = () => {
    if (confirm('Weet u zeker dat u wilt afmelden?')) {
      localStorage.removeItem('planner_session');
      setSession(null);
      setActiveUsers([]);
      setTasks([]);
    }
  };

  // FIX: Added logged-in user (Tom) fallback context when creating general tasks
  const handleAddTaskTrigger = (memberId: string, initialHour?: string) => {
    setEditingTask(null);
    setDefaultTaskMemberId(memberId || session?.memberId || teamMembersState[0]?.id || '8');
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
      const updatedTask: Task = { ...original, ...taskPayload } as Task;

      setTasks(prev => {
        const copy = [...prev];
        copy[index] = updatedTask;
        return copy;
      });

      try {
        const dbRow = taskToDb(updatedTask);
        const { error } = await supabase
          .from('tasks')
          .update(dbRow)
          .eq('id', updatedTask.id);

        if (error) {
          console.error('Supabase update failed:', error);
          triggerNotification(`🛑 Fout bij opslaan: ${error.message}`);
          setTasks(prev => {
            const copy = [...prev];
            copy[index] = original;
            return copy;
          });
        }
      } catch (err) {
        console.error('Supabase request errored', err);
      }
    } else {
      const newId = Math.random().toString(36).substring(2, 9);
      const dateVal = taskPayload.date || selectedDate;
      const parsedWeek = taskPayload.week || 22;

      const newTask: Task = {
        id: newId,
        date: dateVal,
        week: parsedWeek,
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
        const dbRow = taskToDb(newTask);
        const { error } = await supabase
          .from('tasks')
          .insert(dbRow);

        if (error) {
          console.error('Supabase insert failed:', error);
          triggerNotification(`🛑 Fout bij invoegen: ${error.message}`);
          setTasks(prev => prev.filter(t => t.id !== newId));
        }
      } catch (err) {
        console.error('Supabase insert request errored', err);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsModalOpen(false);
    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Supabase delete failed:', error);
        triggerNotification(`🛑 Fout bij verwijderen: ${error.message}`);
        setTasks(originalTasks);
      }
    } catch (err) {
      console.error('Supabase delete request errored', err);
    }
  };

  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} teamMembers={teamMembersState} />;
  }

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-900 selection:bg-blue-150">
      
      {notification && (
        <div id="ws-bell-notification" className="fixed bottom-5 right-5 bg-white border border-slate-200 text-slate-800 px-5 py-3.5 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in max-w-sm ring-4 ring-blue-500/5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div className="text-xs font-semibold leading-tight pr-2">
            {notification}
          </div>
        </div>
      )}

      <header id="main-header" className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center shadow-sm shrink-0 z-40">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div id="branding" className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-md shadow-blue-500/15 antialiased">
              C
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold font-sans tracking-widest mb-1 uppercase">
                Weekplanner TIS-A
              </p>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight font-sans">
                  Collaborative Task Canvas
                </h1>
                
                <div id="ws-badge" className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  synced
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold font-sans tracking-widest mt-0.5 uppercase">
                PROJECT DASHBOARD 2026 • SAMENWERK PORTAAL
              </p>
            </div>
          </div>

          <div id="tabs-and-profile" className="flex flex-wrap items-center gap-4">
            <div id="tab-controls" className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center">
              <button
                id="tab-agenda"
                onClick={() => setActiveTab('agenda')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'agenda' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Overzicht</span>
              </button>
              
              <button
                id="tab-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'analytics' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>

              <button
                id="tab-archive"
                onClick={() => setActiveTab('archive')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Archief</span>
              </button>

              <button
                id="tab-settings"
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Instellingen</span>
              </button>
            </div>

            <div id="active-profile-card" className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pr-3 h-11">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                {session?.initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-800 tracking-tight leading-none">{session?.name}</p>
                <p className="text-[9px] text-slate-400 font-mono font-medium tracking-tight mt-0.5">INGELOGD</p>
              </div>
              <button
                id="btn-logout"
                onClick={handleLogout}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                title="Afmelden"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      <main id="main-view" className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'agenda' ? (
          <TeamPlanner
            tasks={tasks}
            onAddTask={handleAddTaskTrigger}
            onEditTask={handleEditTaskTrigger}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            activeUsers={activeUsers}
            teamMembers={teamMembersState}
          />
        ) : activeTab === 'analytics' ? (
          <PlannerCanvas tasks={tasks} teamMembers={teamMembersState} />
        ) : activeTab === 'archive' ? (
          <ArchiveScreen tasks={tasks} teamMembers={teamMembersState} />
        ) : (
          <TeamSettingsScreen
            teamMembers={teamMembersState}
            tasks={tasks}
            onTriggerNotification={triggerNotification}
          />
        )}
      </main>

      <footer id="main-footer" className="h-10 bg-slate-800 text-white/50 px-6 flex items-center justify-between text-[10px] uppercase tracking-widest shrink-0 font-medium font-mono font-sans">
        <div className="flex gap-4">
          <span>Real-time Sync Active</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Supabase Cloud Sync
          </span>
        </div>
        <div>Canvas Editor v2.4.0</div>
      </footer>

      {isModalOpen && (
        <NieuweTaakModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          editingTask={editingTask}
          defaultDate={selectedDate}
          teamMembers={teamMembersState}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
