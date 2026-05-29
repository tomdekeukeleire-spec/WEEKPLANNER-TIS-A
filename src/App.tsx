import { useState, useEffect, useRef, useMemo } from 'react';
import { UserSession, Task, WebSocketMessage, Priority } from './types';
import LoginScreen from './components/LoginScreen';
import TeamPlanner from './components/TeamPlanner';
import PlannerCanvas from './components/PlannerCanvas';
import ArchiveScreen from './components/ArchiveScreen';
import NieuweTaakModal from './components/NieuweTaakModal';
import { teamMembers } from './constants';
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
  Bell
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'agenda' | 'analytics' | 'archive'>('agenda');
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-26');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultTaskMemberId, setDefaultTaskMemberId] = useState<string>('');
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>('09:00');

  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
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

  // Sync / Connect WebSocket when user session is active
  useEffect(() => {
    if (!session) {
      if (socketRef.current) {
        socketRef.current.close();
      }
      return;
    }

    let isStopped = false;
    let reconnectTimeout: number;

    const connectWS = () => {
      if (isStopped) return;
      setSocketStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}`;
      console.log('Connecting WebSockets to:', url);

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setSocketStatus('connected');
        console.log('WebSocket connection opened successfully!');
        
        // Notify server about user join
        socket.send(JSON.stringify({
          type: 'USER_JOINED',
          user: session
        }));
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('Websocket received action:', msg.type);

          switch (msg.type) {
            case 'INIT':
              setTasks(msg.tasks || []);
              setActiveUsers(msg.activeUsers || []);
              break;

            case 'TASK_CREATED': {
              const incoming = msg.task as Task;
              setTasks(prev => {
                // Idempotent duplicate check
                if (prev.some(t => t.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
              triggerNotification(`➕ Nieuwe taak aangemaakt door ${msg.user}: "${incoming.description}"`);
              break;
            }

            case 'TASK_UPDATED': {
              const incoming = msg.task as Task;
              setTasks(prev => {
                const index = prev.findIndex(t => t.id === incoming.id);
                if (index === -1) return [...prev, incoming];
                const updated = [...prev];
                updated[index] = incoming;
                return updated;
              });
              triggerNotification(`✏️ Taak aangepast door ${msg.user}: "${incoming.description}"`);
              break;
            }

            case 'TASK_DELETED': {
              const { taskId } = msg;
              setTasks(prev => prev.filter(t => t.id !== taskId));
              triggerNotification(`🗑️ Taak verwijderd door ${msg.user}`);
              break;
            }

            case 'USER_JOINED': {
              const joined = msg.user as UserSession;
              setActiveUsers(prev => {
                if (prev.some(u => u.memberId === joined.memberId)) return prev;
                return [...prev, joined];
              });
              triggerNotification(`👋 ${joined.name} heeft zich aangemeld!`);
              break;
            }

            case 'USER_LEFT': {
              const { memberId } = msg;
              setActiveUsers(prev => prev.filter(u => u.memberId !== memberId));
              break;
            }
          }
        } catch (e) {
          console.error('Error handling event payload', e);
        }
      };

      socket.onclose = () => {
        setSocketStatus('disconnected');
        console.log('WebSocket socket disconnected. Reconnecting in 3s...');
        reconnectTimeout = window.setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    };

    connectWS();

    return () => {
      isStopped = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
    };
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
      setSocketStatus('disconnected');
    }
  };

  // Add a task triggered by toolbar or row clicks
  const handleAddTaskTrigger = (memberId: string, initialHour?: string) => {
    setEditingTask(null);
    setDefaultTaskMemberId(memberId || teamMembers[0].id);
    setDefaultTaskTime(initialHour || '09:00');
    setIsModalOpen(true);
  };

  // Edit a task triggered by clicked task block
  const handleEditTaskTrigger = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // Save / Submit task (handles both Create and Update)
  const handleSaveTask = (taskPayload: Partial<Task>) => {
    setIsModalOpen(false);

    if (taskPayload.id) {
      // --- Update Flow ---
      const index = tasks.findIndex(t => t.id === taskPayload.id);
      if (index === -1) return;

      const original = tasks[index];
      const updatedTask: Task = {
        ...original,
        ...taskPayload,
        // Preserve unedited props
      } as Task;

      // Optimistic update
      setTasks(prev => {
        const copy = [...prev];
        copy[index] = updatedTask;
        return copy;
      });

      // Submit to server via WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'UPDATE_TASK',
          task: updatedTask,
          user: session?.name || 'User'
        }));
      }
    } else {
      // --- Create Flow ---
      const newId = Math.random().toString(36).substring(2, 9);
      const newTask: Task = {
        id: newId,
        date: taskPayload.date!,
        week: taskPayload.week!,
        teamMemberId: taskPayload.teamMemberId!,
        description: taskPayload.description!,
        startTime: taskPayload.startTime!,
        endTime: taskPayload.endTime!,
        priority: taskPayload.priority!,
        createdBy: session?.name || 'User',
        createdAt: Date.now()
      };

      // Optimistic local storage update
      setTasks(prev => [...prev, newTask]);

      // Submit over websocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'CREATE_TASK',
          task: newTask,
          user: session?.name || 'User'
        }));
      }
    }
  };

  // Handle task deletion
  const handleDeleteTask = (taskId: string) => {
    setIsModalOpen(false);
    
    // Optimistic local deletion
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // Submit back to ws
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'DELETE_TASK',
        taskId,
        user: session?.name || 'User'
      }));
    }
  };

  // If there's no active session, render the gorgeous Login screen
  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-900 selection:bg-blue-150">
      
      {/* Dynamic Pop up notifications */}
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

      {/* Main Board Header: Matches Professional Polish high-contrast clean style */}
      <header id="main-header" className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center shadow-sm shrink-0 z-40">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & title info with team indicator */}
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
                
                {/* WS Status Indicator inside badge layout */}
                <div id="ws-badge" className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono ${
                  socketStatus === 'connected' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : socketStatus === 'connecting'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    socketStatus === 'connected' ? 'bg-emerald-500' : socketStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                  {socketStatus === 'connected' ? 'synced' : socketStatus === 'connecting' ? 'connecting' : 'offline'}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold font-sans tracking-widest mt-0.5 uppercase">
                PROJECT DASHBOARD 2026 • SAMENWERK PORTAAL
              </p>
            </div>
          </div>

          {/* Interactive Navigation tabs for switching view + User card */}
          <div id="tabs-and-profile" className="flex flex-wrap items-center gap-4">
            
            {/* View Switching Tab Pills */}
            <div id="tab-controls" className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center">
              <button
                id="tab-agenda"
                onClick={() => setActiveTab('agenda')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'agenda'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Overzicht</span>
              </button>
              
              <button
                id="tab-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>

              <button
                id="tab-archive"
                onClick={() => setActiveTab('archive')}
                className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === 'archive'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Archief</span>
              </button>
            </div>

            {/* User Session Profile display & logout option */}
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

      {/* Main Dynamic View Content Container */}
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
          />
        ) : activeTab === 'analytics' ? (
          <PlannerCanvas tasks={tasks} />
        ) : (
          <ArchiveScreen tasks={tasks} />
        )}
      </main>

      {/* Gorgeous Footer block */}
      <footer id="main-footer" className="h-10 bg-slate-800 text-white/50 px-6 flex items-center justify-between text-[10px] uppercase tracking-widest shrink-0 font-medium font-mono">
        <div className="flex gap-4">
          <span>Real-time Sync Active</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            WebSocket Connected
          </span>
        </div>
        <div>Canvas Editor v2.4.0</div>
      </footer>

      {/* Task Creation & Edit Form Pop up overlay */}
      {isModalOpen && (
        <NieuweTaakModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          editingTask={editingTask}
          defaultDate={selectedDate}
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
