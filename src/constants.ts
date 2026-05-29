import { TeamMember } from './types';

export const teamMembers: TeamMember[] = [
  { id: '1', name: 'Matthew Ottevaere', initials: 'MO', color: 'bg-indigo-500 hover:bg-indigo-600' },
  { id: '2', name: 'Tim Nijs', initials: 'TN', color: 'bg-emerald-500 hover:bg-emerald-600' },
  { id: '3', name: 'Steven Lippens', initials: 'SL', color: 'bg-pink-500 hover:bg-pink-600' },
  { id: '4', name: 'Gino Oosterlynck', initials: 'GO', color: 'bg-amber-500 hover:bg-amber-600' },
  { id: '5', name: 'Wim Verdonck', initials: 'WV', color: 'bg-sky-500 hover:bg-sky-600' },
  { id: '6', name: 'Tom De Keukeleire', initials: 'TDK', color: 'bg-rose-500 hover:bg-rose-600' },
  { id: '7', name: 'Kristof Cardon', initials: 'KC', color: 'bg-teal-500 hover:bg-teal-600' },
  { id: '8', name: 'Bart De Bruyn', initials: 'BDB', color: 'bg-purple-500 hover:bg-purple-600' },
  { id: '9', name: 'Jüry Lahousse', initials: 'JL', color: 'bg-blue-500 hover:bg-blue-600' },
  { id: '10', name: 'Hein Taelman', initials: 'HT', color: 'bg-orange-500 hover:bg-orange-600' },
  { id: '11', name: 'Stijn Vierstraete', initials: 'SV', color: 'bg-cyan-500 hover:bg-cyan-600' },
];

export const PRIORITY_COLORS = {
  Critical: {
    bg: 'bg-rose-500 hover:bg-rose-600',
    border: 'border-rose-600',
    text: 'text-white',
    badge: '🔴 Urgent/Kritiek',
    hexBadge: '#f43f5e'
  },
  High: {
    bg: 'bg-orange-500 hover:bg-orange-600',
    border: 'border-orange-600',
    text: 'text-white',
    badge: '🟠 Hoog/High',
    hexBadge: '#f97316'
  },
  Medium: {
    bg: 'bg-yellow-400 hover:bg-yellow-500',
    border: 'border-yellow-500',
    text: 'text-slate-900',
    badge: '🟡 Medium',
    hexBadge: '#eab308'
  },
  Low: {
    bg: 'bg-emerald-500 hover:bg-emerald-600',
    border: 'border-emerald-600',
    text: 'text-white',
    badge: '🟢 Low/Laag',
    hexBadge: '#10b981'
  }
};
