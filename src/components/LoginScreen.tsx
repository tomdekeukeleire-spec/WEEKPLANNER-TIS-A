import React, { useState } from 'react';
import { TeamMember, UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserSession) => void;
  teamMembers: TeamMember[];
}

export default function LoginScreen({ onLoginSuccess, teamMembers }: LoginScreenProps) {
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const member = teamMembers.find(m => m.id === selectedMemberId);
    if (member) {
      // Logt de gebruiker direct lokaal in met de dynamische gegevens uit Supabase
      onLoginSuccess({
        memberId: member.id,
        name: member.name,
        initials: member.initials || member.id,
        role: 'User'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-blue-500/15 antialiased">
              C
            </div>
          </div>
          
          <h2 className="text-center text-2xl font-bold text-slate-800 tracking-tight mb-2">TeamPlanner Login</h2>
          <p className="text-center text-xs text-slate-400 font-medium tracking-wide uppercase mb-6">
            Kies uw profiel om samen te werken
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Gebruiker
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm font-medium text-slate-700"
                required
              >
                <option value="">-- Selecteer uw naam --</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.initials})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-all"
            >
              Inloggen als Teamlid →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
