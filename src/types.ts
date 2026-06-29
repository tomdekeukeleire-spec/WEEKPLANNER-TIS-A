export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color?: string;
  email?: string;
  role?: string;
}

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  week: number;
  teamMemberId: string;
  subject?: 'Todo' | 'Verlof' | 'Ziekte' | 'Training' | 'Meeting';
  description: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  priority: Priority;
  createdBy: string;
  createdAt: number;
  // NIEUW: Dit zorgt dat de poortwachter van TypeScript stopt met staken!
  status: 'active' | 'cancelled'; 
}

export interface UserSession {
  memberId: string;
  name: string;
  initials: string;
  role: 'User' | 'Superuser';
}
