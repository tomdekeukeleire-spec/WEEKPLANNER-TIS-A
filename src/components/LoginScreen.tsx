import { useState, FormEvent } from 'react';
import { teamMembers } from '../constants';
import { UserSession } from '../types';
import { Users, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('8'); // Default to Bart De Bruyn
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: selectedMemberId }),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        onLoginSuccess(data.session);
      } else {
        setError(data.error || 'Log-in mislukt');
      }
    } catch (err) {
      setError('Verbinding met server verloren.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-950">
      {/* Absolute decorative gradient highlights */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
      
      <div id="login-card" className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl relative z-10 transition-all hover:shadow-2xl">
        <div id="login-header" className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl mb-4 border border-blue-100">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">TeamPlanner Login</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Kies uw profiel om samen te werken</p>
        </div>

        {error && (
          <div id="login-error-alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div id="member-field" className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Gebruiker</label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50 custom-scrollbar">
              {teamMembers.map((member) => (
                <button
                  id={`btn-select-member-${member.id}`}
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer ${
                    selectedMemberId === member.id
                      ? 'bg-blue-50 text-blue-900 border border-blue-200 shadow-sm'
                      : 'text-slate-600 border border-transparent hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${member.color.split(' ')[0]}`}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-850">{member.name}</p>
                    <p className="text-xs text-slate-400 font-medium">ID: {member.initials}</p>
                  </div>
                  {selectedMemberId === member.id && (
                    <div className="w-2,2 h-2.2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div id="pin-field" className="space-y-2">
            <div className="flex justify-between items-center bg-transparent">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Pincode (Optioneel)</label>
              <span className="text-[10px] text-slate-400 font-medium italic">Standaard direct toegang</span>
            </div>
            <div className="relative">
              <input
                id="input-login-pin"
                type="password"
                maxLength={6}
                placeholder="Vul code in (b.v. 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono tracking-widest"
              />
              <ShieldCheck className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-400" />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/10 transition-all group cursor-pointer"
          >
            <span>{loading ? 'Bezig met inloggen...' : `Inloggen als ${selectedMember ? selectedMember.initials : 'Gebruiker'}`}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
      
      <div id="login-footer" className="mt-8 text-center text-xs text-slate-400 font-mono font-medium">
        Planner Canvas v2.4.0 • TVH Belgium Team Collaboration
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.05);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
}
