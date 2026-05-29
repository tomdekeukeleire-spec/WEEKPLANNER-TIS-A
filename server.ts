import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { Priority, Task, TeamMember, UserSession, WebSocketMessage } from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Since we compile to CommonJS and run source with tsx, let's use process.cwd() for path resolution.
const dbPath = path.join(process.cwd(), 'tasks_db.json');

// Default initial Team Members
const teamMembers: TeamMember[] = [
  { id: '1', name: 'Matthew Ottevaere', initials: 'MO', color: 'bg-indigo-500' },
  { id: '2', name: 'Tim Nijs', initials: 'TN', color: 'bg-emerald-500' },
  { id: '3', name: 'Steven Lippens', initials: 'SL', color: 'bg-pink-500' },
  { id: '4', name: 'Gino Oosterlynck', initials: 'GO', color: 'bg-amber-500' },
  { id: '5', name: 'Wim Verdonck', initials: 'WV', color: 'bg-sky-500' },
  { id: '6', name: 'Tom De Keukeleire', initials: 'TDK', color: 'bg-rose-500' },
  { id: '7', name: 'Kristof Cardon', initials: 'KC', color: 'bg-teal-500' },
  { id: '8', name: 'Bart De Bruyn', initials: 'BDB', color: 'bg-purple-500' },
  { id: '9', name: 'Jüry Lahousse', initials: 'JL', color: 'bg-blue-500' },
  { id: '10', name: 'Hein Taelman', initials: 'HT', color: 'bg-orange-500' },
  { id: '11', name: 'Stijn Vierstraete', initials: 'SV', color: 'bg-cyan-500' },
];

// Load or Seed Initial Tasks from Spreadsheet
let tasks: Task[] = [];

function loadTasks() {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      tasks = JSON.parse(data);
      console.log(`Loaded ${tasks.length} tasks from database.`);
    } catch (e) {
      console.error('Error reading database file, using seeds instead', e);
      tasks = generateSeedTasks();
    }
  } else {
    tasks = generateSeedTasks();
    saveTasks();
  }
}

function saveTasks() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving tasks to db file', e);
  }
}

function generateSeedTasks(): Task[] {
  const seeds: Task[] = [];
  const startIdGen = () => Math.random().toString(36).substring(2, 9);

  // 26/05/2026 tasks
  // Tim Nijs: Verlof 08:00 to 17:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '2', // Tim Nijs
    description: 'Verlof',
    startTime: '08:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Steven Lippens: complaints (High) 09:00-10:00 & todo (Medium) 09:00-13:00 & complaints (High) 14:00-15:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '09:00',
    endTime: '10:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '3',
    description: 'Todo',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '14:00',
    endTime: '15:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Gino Oosterlynck: Leave 08:00-17:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '4',
    description: 'Leave',
    startTime: '08:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Wim Verdonck: advanced sheet 10:00-12:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '5',
    description: 'Advanced Sheet',
    startTime: '10:00',
    endTime: '12:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Tom De Keukeleire: Advanced Sheets features 10:00-12:00 High, Leave 13:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '6',
    description: 'Advanced Sheets features',
    startTime: '10:00',
    endTime: '12:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '6',
    description: 'Leave',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Bart De Bruyn: Todo 13:00-14:00 & Todo 14:00-16:00 Medium, U88 training Jüry 14:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '8',
    description: 'Todo',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '8',
    description: 'U88 training Jüry',
    startTime: '14:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // Jüry Lahousse: EQD 09:00-10:00 Medium, opleiding 13:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '9',
    description: 'EQD',
    startTime: '09:00',
    endTime: '10:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-26',
    week: 22,
    teamMemberId: '9',
    description: 'Opleiding',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // --- 27/05/2026 Wednesday ---
  // Matthew Ottevaere: Meeting 15:00-17:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '1',
    description: 'Meeting',
    startTime: '15:00',
    endTime: '17:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Tim Nijs: Verlof 08:00-17:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '2',
    description: 'Verlof',
    startTime: '08:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Steven Lippens: complaints (High) 09:00-10:00 & todo (Medium) 09:00-13:00, complaints 15:00-16:00, permanentie 16:00-17:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '09:00',
    endTime: '10:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '3',
    description: 'Todo',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '15:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '3',
    description: 'Permanentie',
    startTime: '16:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Gino Oosterlynck: Leave 13:00-17:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '4',
    description: 'Leave',
    startTime: '13:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Wim Verdonck: to do 09:00-13:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '5',
    description: 'To do',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Tom De Keukeleire: AI cleansing tool TCM 13:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '6',
    description: 'AI cleansing tool TCM',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Bart De Bruyn: Todo 13:00-16:00 Medium, Global memo meeting 14:00-15:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '8',
    description: 'Todo',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '8',
    description: 'Global memo meeting',
    startTime: '14:00',
    endTime: '15:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Hein Taelman: ToDo EQD 09:00-13:00 Low
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '10',
    description: 'ToDo EQD',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.LOW,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Stijn Vierstraete: Todo 09:00-12:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-27',
    week: 22,
    teamMemberId: '11',
    description: 'Todo',
    startTime: '09:00',
    endTime: '12:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // --- 28/05/2026 Thursday ---
  // Matthew Ottevaere: Meeting 14:00-15:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '1',
    description: 'Meeting',
    startTime: '14:00',
    endTime: '15:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Tim Nijs: Verlof 08:00-17:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '2',
    description: 'Verlof',
    startTime: '08:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Steven Lippens: complaints (High) 09:00-10:00 & todo (Medium) 09:00-13:00, complaints 15:00-16:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '09:00',
    endTime: '10:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '3',
    description: 'Todo',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '15:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Gino Oosterlynck: todo 13:00-14:00, Equipment Data Cleansing Meeting 14:00-15:00, todo 15:00-16:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '4',
    description: 'Todo',
    startTime: '13:00',
    endTime: '14:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '4',
    description: 'Equipment Data Cleansing Meeting',
    startTime: '14:00',
    endTime: '15:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '4',
    description: 'Todo',
    startTime: '15:00',
    endTime: '16:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Wim Verdonck: equipment data 14:00-15:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '5',
    description: 'Equipment data',
    startTime: '14:00',
    endTime: '15:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Tom De Keukeleire: Leave 13:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '6',
    description: 'Leave',
    startTime: '13:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Hein Taelman: ToDo EQD 09:00-13:00 Low
  seeds.push({
    id: startIdGen(),
    date: '2026-05-28',
    week: 22,
    teamMemberId: '10',
    description: 'ToDo EQD',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.LOW,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  // --- 29/05/2026 Friday ---
  // Tim Nijs: Verlof 08:00-17:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '2',
    description: 'Verlof',
    startTime: '08:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Steven Lippens: complaints (High) 09:00-10:00 & complaints 16:00-17:00
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '09:00',
    endTime: '10:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '3',
    description: 'Complaints',
    startTime: '16:00',
    endTime: '17:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Gino Oosterlynck: Monthly sprint planning 12:00-13:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '4',
    description: 'Monthly sprint planning',
    startTime: '12:00',
    endTime: '13:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Wim Verdonck: to do 13:00-17:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '5',
    description: 'To do',
    startTime: '13:00',
    endTime: '17:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Tom De Keukeleire: Todo 09:00-13:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '6',
    description: 'Todo',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Kristof Cardon: todo 12:00-16:00 Medium
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '7',
    description: 'Todo',
    startTime: '12:00',
    endTime: '16:00',
    priority: Priority.MEDIUM,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Hein Taelman: Leave 08:00-16:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '10',
    description: 'Leave',
    startTime: '08:00',
    endTime: '16:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });
  // Stijn Vierstraete: To do 09:00-13:00 High
  seeds.push({
    id: startIdGen(),
    date: '2026-05-29',
    week: 22,
    teamMemberId: '11',
    description: 'To do',
    startTime: '09:00',
    endTime: '13:00',
    priority: Priority.HIGH,
    createdBy: 'System',
    createdAt: Date.now(),
  });

  return seeds;
}

loadTasks();

// Track active online users mapped by socket connections
const activeSockets = new Map<WebSocket, UserSession>();

app.use(express.json());

// Auth & Session endpoints
app.post('/api/auth/login', (req, res) => {
  const { memberId } = req.body;
  const member = teamMembers.find((m) => m.id === memberId);
  if (!member) {
    return res.status(404).json({ error: 'Team member not found' });
  }
  const session: UserSession = {
    memberId: member.id,
    name: member.name,
    initials: member.initials,
    loggedInAt: Date.now(),
  };
  res.json({ success: true, session });
});

// REST Endpoint to fetch tasks (fallback or initial load)
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// Get team members catalog
app.get('/api/team', (req, res) => {
  res.json(teamMembers);
});

// Broadcast helper
function broadcast(message: WebSocketMessage, excludeSocket?: WebSocket) {
  const payload = JSON.stringify(message);
  activeSockets.forEach((_, socket) => {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
}

// Vite integration & startup setup packed inside async bootstrap to bypass CJS top-level await limits
async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve single page app index.html for all other entries
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // WS mounting
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected as WebSocket');

    // When a socket connects, wait for them to bind to a UserSession, or send immediate seed data
    ws.send(JSON.stringify({
      type: 'INIT',
      tasks,
      activeUsers: Array.from(activeSockets.values()),
    }));

    ws.on('message', (messageRaw: string) => {
      try {
        const msg = JSON.parse(messageRaw);
        console.log('Received socket action:', msg.type);

        switch (msg.type) {
          case 'USER_JOINED': {
            const session = msg.user as UserSession;
            activeSockets.set(ws, session);
            // Broadcast to everyone else that user has joined
            broadcast({ type: 'USER_JOINED', user: session });
            // Send re-sync list of online people to everyone
            broadcast({
              type: 'INIT',
              tasks,
              activeUsers: Array.from(activeSockets.values()),
            });
            break;
          }

          case 'CREATE_TASK': {
            const newTask = msg.task as Task;
            // De-duplicate / idempotency check
            if (!tasks.some(t => t.id === newTask.id)) {
              tasks.push(newTask);
              saveTasks();
              broadcast({ type: 'TASK_CREATED', task: newTask, user: msg.user || 'Unknown' });
            }
            break;
          }

          case 'UPDATE_TASK': {
            const updatedTask = msg.task as Task;
            const index = tasks.findIndex((t) => t.id === updatedTask.id);
            if (index !== -1) {
              tasks[index] = updatedTask;
              saveTasks();
              broadcast({ type: 'TASK_UPDATED', task: updatedTask, user: msg.user || 'Unknown' });
            }
            break;
          }

          case 'DELETE_TASK': {
            const { taskId } = msg;
            const initialLength = tasks.length;
            tasks = tasks.filter((t) => t.id !== taskId);
            if (tasks.length !== initialLength) {
              saveTasks();
              broadcast({ type: 'TASK_DELETED', taskId, user: msg.user || 'Unknown' });
            }
            break;
          }
        }
      } catch (e) {
        console.error('Error handling WebSocket message', e);
      }
    });

    ws.on('close', () => {
      const session = activeSockets.get(ws);
      if (session) {
        console.log(`User ${session.name} disconnected`);
        activeSockets.delete(ws);
        broadcast({ type: 'USER_LEFT', memberId: session.memberId });
        // Send adjusted online users to all remaining clients
        broadcast({
          type: 'INIT',
          tasks,
          activeUsers: Array.from(activeSockets.values()),
        });
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Planner Canvas Full-Stack server booted successfully!`);
    console.log(`Access the UI at: http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
});
