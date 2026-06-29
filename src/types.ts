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
  // We maken subject en status flexibel zodat Vercel niet meer crasht
  subject?: 'Todo' | 'Verlof' | 'Ziekte' | 'Training' | 'Meeting' | string;
  description: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  priority: Priority;
  createdBy: string;
  createdAt: number;
  // HET VRAAGTEKEN: Status is nu optioneel voor oude componenten!
  status?: 'active' | 'cancelled'; 
}

export interface UserSession {
  memberId: string;
  name: string;
  initials: string;
  role: 'User' | 'Superuser';
}
