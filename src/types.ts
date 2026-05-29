export enum Priority {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  week: number;
  teamMemberId: string;
  subject?: 'Todo' | 'Verlof' | 'Training' | 'Meeting';
  description: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  priority: Priority;
  createdBy: string;
  createdAt: number;
}

export interface TeamMember {
  id: string; // initials formatted as well, e.g. "BDB"
  name: string;
  initials: string;
  color: string; // Hex or tailwind class for avatar background
}

export interface UserSession {
  memberId: string;
  name: string;
  initials: string;
  loggedInAt: number;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  activeUsers: { name: string; initials: string; memberId: string }[];
}

export type WebSocketMessage =
  | { type: 'INIT'; tasks: Task[]; activeUsers: UserSession[] }
  | { type: 'TASK_CREATED'; task: Task; user: string }
  | { type: 'TASK_UPDATED'; task: Task; user: string }
  | { type: 'TASK_DELETED'; taskId: string; user: string }
  | { type: 'USER_JOINED'; user: UserSession }
  | { type: 'USER_LEFT'; memberId: string };
