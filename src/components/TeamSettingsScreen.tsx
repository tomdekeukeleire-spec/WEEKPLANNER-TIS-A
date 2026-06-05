import { useState, FormEvent } from 'react';
import { TeamMember, Task } from '../types';
import { supabase } from '../supabase';
import { Users, UserPlus, Trash2, ShieldAlert, Sparkles, Check, Mail } from 'lucide-react';

interface TeamSettingsScreenProps {
  teamMembers: TeamMember[];
  tasks: Task[];
  onTriggerNotification: (msg: string) => void;
}

const PRESET_COLORS = [
  { label: 'Brilliant Indigo', value: 'bg-indigo-500 hover:bg-indigo-600' },
  { label: 'Fresh Emerald', value: 'bg-emerald-500 hover:bg-emerald-600' },
  { label: 'Vibrant Pink', value: 'bg-pink-500 hover:bg-pink-600' },
  { label: 'Golden Amber', value: 'bg-amber-500 hover:bg-amber-600' },
  { label: 'Sky Blue', value: 'bg-sky-500 hover:bg-sky-600' },
  { label: 'Radiant Rose', value: 'bg-rose-500 hover:bg-rose-600' },
  { label: 'Classic Teal', value: 'bg-teal-500 hover:bg-teal-600' },
  { label: 'Deep Purple', value: 'bg-purple-500 hover:bg-purple-600' },
  { label: 'Ocean Blue', value: 'bg-blue-500 hover:bg-blue-600' },
  { label: 'Warm Orange', value: 'bg-orange-500 hover:bg-orange-600' },
  { label: 'Neon Cyan', value: 'bg-cyan-500 hover:bg-cyan-600' }
];

export default function TeamSettingsScreen({
  teamMembers,
  tasks,
  onTriggerNotification,
}: TeamSettingsScreenProps) {
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [email, setEmail] = useState(''); // Nieuwe state voor e-mail
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate initials from name
  const handleNameChange = (val: string) => {
    setName(val);
    const parts = val.trim().split(/\s+/);
    if (parts.length > 0 && parts[0] !== '') {
      let suggestedValue = '';
      if (parts.length === 1) {
        suggestedValue = parts[0].substring(0, 3).toUpperCase();
      } else {
        suggestedValue = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      setInitials(suggestedValue);
    } else {
      setInitials('');
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedInitials = initials.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Naam is verplicht.');
      return;
    }
    if (!trimmedInitials) {
      setError('Initialen zijn verplicht.');
      return;
    }
    if (!trimmedEmail) {
      setError('E-mailadres is verplicht voor Google-inlog authenticatie.');
      return;
    }

    // Check duplicates op initialen én e-mailadres
    if (teamMembers.some((m) => m.initials === trimmedInitials)) {
      setError(`Er bestaat al een teamlid met initialen "${trimmedInitials}".`);
      return;
    }
    if (teamMembers.some((m) => (m as any).email?.toLowerCase() === trimmedEmail)) {
      setError(`Dit e-mailadres (${trimmedEmail}) is al gekoppeld aan een ander teamlid.`);
      return;
    }

    setSubmitting(true);

    const id = (Math.max(0, ...teamMembers.map((m) => Number(m.id) || 0)) + 1).toString();

    const newMember: any = {
      id,
      name: trimmedName,
      initials: trimmedInitials,
      color: selectedColor,
      email: trimmedEmail, // Wordt nu netjes meegestuurd naar Supabase
    };

    try {
      const { error: dbErr } = await supabase
        .from('team_members')
        .insert(newMember);

      if (dbErr) {
        console.error('Failed to insert member to Supabase:', dbErr);
        setError(`Fout bij toevoegen: ${dbErr.message}. Controleer of de kolom 'email' bestaat in Supabase.`);
      } else {
        setName('');
        setInitials('');
        setEmail('');
        setSelectedColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].value);
        onTriggerNotification(`🚀 "${trimmedName}" is toegevoegd en kan nu veilig inloggen met ${trimmedEmail}!`);
      }
    } catch (err: any) {
      setError(`Netwerkfout: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;

    const memberTasksCount = tasks.filter((t) => t.teamMemberId === memberId).length;
    const taskCountWarning = memberTasksCount > 0 
      ? `\n\n⚠️ LET OP: Dit teamlid heeft momente0l ${memberTasksCount} taak/taken toegewezen. De taken blijven in het systeem staan.`
      : '';

    const confirmed = window.confirm(
      `Weet u zeker dat u "${member.name}" (${member.initials}) wilt verwijderen?${taskCountWarning}`
    );

    if (!confirmed) return;

    try {
      const { error: dbErr } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (dbErr) {
        console.error('Failed to delete member from Supabase:', dbErr);
        onTriggerNotification(`🛑 Fout bij verwijderen: ${dbErr.message}`);
      } else {
        onTriggerNotification(`🗑️ "${member.name}" is verwijderd.`);
      }
    } catch (err: any) {
      onTriggerNotification(`🛑 Netwerkfout bij verwijderen: ${err.message || err}`);
    }
  };

  const getTaskCount = (memberId: string) => {
    return tasks.filter((t) => t.teamMemberId === memberId).length;
  };

  return (
    <div id="settings-screen-container" className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto font-sans">
      
      {/* Panel: Nieuw lid toevoegen */}
      <div id="add-member-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Nieuw Teamlid</h2>
            <p className="text-xs text-slate-400 font-medium">Toegang verlenen via TVH-mail</p>
          </div>
        </div>

        {error && (
          <div id="add-member-error" className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleAddMember} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Volledige Naam</label>
            <input
              type="text"
              placeholder="Bijv. Jan Peeters"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Initialen (ID)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="Bijv. JP"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono font-bold"
              required
            />
          </div>

          {/* NIEUW: EINVOERVELD VOOR E-MAILADRES */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> TVH E-mailadres (Voor Inlog)
            </label>
            <input
              type="email"
              placeholder="jan.peeters@tvh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Kleur & Thema</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((clr) => (
                <button
                  key={clr.value}
                  type="button"
                  onClick={() => setSelectedColor(clr.value)}
                  title={clr.label}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative cursor-pointer border ${clr.value.split(' ')[0]} ${
                    selectedColor === clr.value 
                      ? 'ring-2 ring-blue-500 scale-110 border-white shadow-md' 
                      : 'border-transparent'
                  }`}
                >
                  {selectedColor === clr.value && (
                    <Check className="w-4 h-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/10 transition-all cursor-pointer text-sm"
          >
            <span>{submitting ? 'Bezig...' : 'Teamlid Toevoegen'}</span>
          </button>
        </form>
      </div>

      {/* Tabel: Teamleden Overzicht */}
      <div id="members-list-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Teamleden ({teamMembers.length})</h2>
              <p className="text-xs text-slate-400 font-medium">Beheer wie toegang heeft tot het portaal</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Lid</th>
                <th className="py-3 px-4">E-mailadres</th>
                <th className="py-3 px-4 text-center">Open taken</th>
                <th className="py-3 px-4 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {teamMembers.map((member) => {
                const count = getTaskCount(member.id);
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors text-slate-700 text-sm">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${member.color.split(' ')[0]}`}>
                        {member.initials}
                      </div>
                      <span className="font-semibold text-slate-800">{member.name}</span>
                    </td>
                    {/* NIEUWE KOLOM: TOONT HET GEKOPPELDE E-MAILADRES */}
                    <td className="py-3.5 px-4 font-medium text-slate-500 text-xs">
                      {(member as any).email || <span className="text-slate-300 italic">Geen mail ingevuld</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        count > 0 
                          ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {count} {count === 1 ? 'taak' : 'taken'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer inline-flex items-center"
                        title="Verwijder dit teamlid uit het systeem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {teamMembers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                    <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Geen teamleden gevonden. Voeg er een toe om te beginnen!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl text-amber-800 text-xs leading-relaxed">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
          <div>
            <span className="font-bold">Hoe werkt de Google-koppeling?</span> Wanneer een collega inlogt met zijn TVH-account via Google, controleert de app direct of de inlog-mail exact overeenkomt met de mail in deze tabel. Alleen als er een match is, krijgt de collega direct toegang tot zijn of haar eigen planning.
          </div>
        </div>

      </div>
    </div>
  );
}
