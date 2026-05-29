import { useState, useMemo } from 'react';
import { Task, Priority } from '../types';
import { teamMembers } from '../constants';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Filter, 
  X, 
  Layers,
  Calendar,
  Clock,
  Briefcase
} from 'lucide-react';

interface ArchiveScreenProps {
  tasks: Task[];
}

type SortField = 'date' | 'week' | 'member' | 'subject' | 'description' | 'startTime' | 'endTime' | 'priority';
type SortOrder = 'asc' | 'desc' | 'none';

export default function ArchiveScreen({ tasks }: ArchiveScreenProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  // Sorting states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Compute Task Subject
  const getTaskSubject = (task: Task): string => {
    if (task.subject) return task.subject;
    if (task.description === 'Verlof' || task.description === 'Leave') return 'Verlof';
    if (task.description === 'Training' || task.description === 'Opleiding') return 'Training';
    if (task.description === 'Meeting' || task.description.toLowerCase().includes('meeting')) return 'Meeting';
    return 'Todo';
  };

  const getMemberName = (memberId: string): string => {
    return teamMembers.find(m => m.id === memberId)?.name || 'Onbekend';
  };

  // Filter tasks based on global search & custom filter parameters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const subject = getTaskSubject(task);
      const memberName = getMemberName(task.teamMemberId);
      
      // Filter by Team Member
      if (filterMemberId !== 'all' && task.teamMemberId !== filterMemberId) {
        return false;
      }

      // Filter by Subject
      if (filterSubject !== 'all' && subject !== filterSubject) {
        return false;
      }

      // Filter by Priority
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return false;
      }

      // Match search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const descMatch = task.description.toLowerCase().includes(query);
        const memberMatch = memberName.toLowerCase().includes(query);
        const subjectMatch = subject.toLowerCase().includes(query);
        const priorityMatch = task.priority.toLowerCase().includes(query);
        const dateMatch = task.date.includes(query);
        const weekMatch = `week ${task.week}`.includes(query);
        
        if (!descMatch && !memberMatch && !subjectMatch && !priorityMatch && !dateMatch && !weekMatch) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, searchTerm, filterMemberId, filterSubject, filterPriority]);

  // Sort filtered tasks
  const sortedTasks = useMemo(() => {
    if (sortOrder === 'none') return filteredTasks;

    return [...filteredTasks].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'date':
          valA = a.date;
          valB = b.date;
          break;
        case 'week':
          valA = a.week;
          valB = b.week;
          break;
        case 'member':
          valA = getMemberName(a.teamMemberId);
          valB = getMemberName(b.teamMemberId);
          break;
        case 'subject':
          valA = getTaskSubject(a);
          valB = getTaskSubject(b);
          break;
        case 'description':
          valA = a.description.toLowerCase();
          valB = b.description.toLowerCase();
          break;
        case 'startTime':
          valA = a.startTime;
          valB = b.startTime;
          break;
        case 'endTime':
          valA = a.endTime;
          valB = b.endTime;
          break;
        case 'priority':
          // Prioritize order: Critical > High > Medium > Low
          const pLevels = { [Priority.CRITICAL]: 4, [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
          valA = pLevels[a.priority] || 0;
          valB = pLevels[b.priority] || 0;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTasks, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') setSortOrder('none');
      else setSortOrder('asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Helper render sort arrow indicator 
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field || sortOrder === 'none') {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-350 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    );
  };

  // Reset all filters safely
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterMemberId('all');
    setFilterSubject('all');
    setFilterPriority('all');
    setSortField('date');
    setSortOrder('desc');
  };

  // Download / Export raw data to a clean CSV
  const handleDownloadCSV = () => {
    // 1. Columns headers declaration
    const headers = [
      'Datum',
      'Week',
      'Toegewezen Aan',
      'Onderwerp',
      'Omschrijving',
      'Start',
      'Einde',
      'Prioriteit'
    ];

    // Helper utility to safely escape custom characters for standard CSV compliance
    const escapeCSV = (val: string | number | undefined): string => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 2. Map dataset rows
    const rows = sortedTasks.map(task => [
      task.date,
      task.week,
      getMemberName(task.teamMemberId),
      getTaskSubject(task),
      task.description,
      task.startTime,
      task.endTime,
      task.priority
    ]);

    // 3. Assemble CSV text block
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\r\n');

    // 4. Prefix with UTF-8 BOM (\uFEFF) so Excel opens it with right character sets
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 5. Trigger physical browser download anchor link
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `taken_archief_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="archive-view-root" className="space-y-6 pb-12 animate-fade-in">
      
      {/* Archive Header section */}
      <div id="archive-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 rounded bg-slate-700 inline-block" />
            Takenarchief & Historiek Spreadsheet
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Beheer en exporteer de volledige database van alle ingeplande taken en agenda items.
          </p>
        </div>

        {/* Buttons / Controls layer */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-export-csv"
            onClick={handleDownloadCSV}
            disabled={sortedTasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div id="archive-filters" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div id="filters-flex" className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Main search term input */}
          <div className="relative w-full lg:max-w-xs shrink-0">
            <input
              id="input-archive-search"
              type="text"
              placeholder="Zoek in het archief..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-slate-500 focus:bg-white transition-all placeholder-slate-405"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2.5 text-slate-450 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dropdown selects */}
          <div className="flex flex-wrap items-center gap-3 w-full justify-end">
            
            {/* Medewerker Filter option */}
            <div className="flex items-center gap-1.5 text-xs text-slate-550">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider hidden sm:inline">TEAMLID</span>
              <select
                id="select-archive-filter-member"
                value={filterMemberId}
                onChange={(e) => setFilterMemberId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-slate-500 focus:bg-white max-w-[140px]"
              >
                <option value="all">👥 Iedereen</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Onderwerp Filter option */}
            <div className="flex items-center gap-1.5 text-xs text-slate-550">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider hidden sm:inline">ONDERWERP</span>
              <select
                id="select-archive-filter-subject"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-slate-500 focus:bg-white max-w-[140px]"
              >
                <option value="all">📁 Alle onderwerpen</option>
                <option value="Todo">Todo</option>
                <option value="Verlof">Verlof</option>
                <option value="Training">Training</option>
                <option value="Meeting">Meeting</option>
              </select>
            </div>

            {/* Prioriteit Filter option */}
            <div className="flex items-center gap-1.5 text-xs text-slate-550">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider hidden sm:inline">PRIORITEIT</span>
              <select
                id="select-archive-filter-priority"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-slate-500 focus:bg-white max-w-[140px]"
              >
                <option value="all">⚡ Alle prioriteiten</option>
                <option value={Priority.CRITICAL}>🔴 Urgent / Kritiek</option>
                <option value={Priority.HIGH}>🟠 Hoog / High</option>
                <option value={Priority.MEDIUM}>🟡 Medium</option>
                <option value={Priority.LOW}>🟢 Low / Laag</option>
              </select>
            </div>

            {/* Clear filters Button */}
            {(searchTerm || filterMemberId !== 'all' || filterSubject !== 'all' || filterPriority !== 'all' || sortOrder !== 'none') && (
              <button
                id="btn-clear-archive-filters"
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-150 border border-slate-200 text-slate-655 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

          </div>
        </div>

        {/* Counter Summary badge row */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
          <span>HUIDIGE SELECTIE</span>
          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
            {sortedTasks.length} van de {tasks.length} resultaten
          </span>
        </div>
      </div>

      {/* Spreadsheet grid layout */}
      <div id="archive-table-container" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-250 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider select-none font-sans">
                {/* 1. Date */}
                <th 
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Datum</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>
                
                {/* 2. Week */}
                <th 
                  onClick={() => handleSort('week')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors w-[100px]"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Week</span>
                    {renderSortIndicator('week')}
                  </div>
                </th>

                {/* 3. Assigned to */}
                <th 
                  onClick={() => handleSort('member')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Toegewezen aan</span>
                    {renderSortIndicator('member')}
                  </div>
                </th>

                {/* 4. Subject */}
                <th 
                  onClick={() => handleSort('subject')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors w-[120px]"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Onderwerp</span>
                    {renderSortIndicator('subject')}
                  </div>
                </th>

                {/* 5. Description */}
                <th 
                  onClick={() => handleSort('description')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Omschrijving</span>
                    {renderSortIndicator('description')}
                  </div>
                </th>

                {/* 6. Start time */}
                <th 
                  onClick={() => handleSort('startTime')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors w-[90px]"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Start</span>
                    {renderSortIndicator('startTime')}
                  </div>
                </th>

                {/* 7. End time */}
                <th 
                  onClick={() => handleSort('endTime')}
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors w-[90px]"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Einde</span>
                    {renderSortIndicator('endTime')}
                  </div>
                </th>

                {/* 8. Priority */}
                <th 
                  onClick={() => handleSort('priority')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors w-[130px]"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Prioriteit</span>
                    {renderSortIndicator('priority')}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table body content */}
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700 font-sans">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="font-semibold text-slate-500">Geen gearchiveerde taken gevonden</span>
                      <span className="text-[10px] text-slate-400">Wijzig de filterwaarden of voeg nieuwe taken toe.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedTasks.map((task, idx) => {
                  const subject = getTaskSubject(task);
                  const member = teamMembers.find(m => m.id === task.teamMemberId);
                  
                  // Helper style classes for nice visual tags
                  const subjectBadgeClass = 
                    subject === 'Verlof' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    subject === 'Training' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                    subject === 'Meeting' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                    'bg-blue-50 text-blue-700 border border-blue-100';

                  const priorityBadgeClass = 
                    task.priority === Priority.CRITICAL ? 'bg-rose-100 text-rose-800 font-extrabold border border-rose-200' :
                    task.priority === Priority.HIGH ? 'bg-orange-100 text-orange-850 font-bold' :
                    task.priority === Priority.MEDIUM ? 'bg-yellow-100 text-yellow-850 font-bold' :
                    'bg-emerald-150 text-emerald-850';

                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/15' : ''}`}
                    >
                      {/* Date */}
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-500 border-r border-slate-50">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-350 shrink-0" />
                          <span>{task.date}</span>
                        </div>
                      </td>

                      {/* Week */}
                      <td className="py-2.5 px-4 font-mono text-slate-450 border-r border-slate-50">
                        Wk {task.week}
                      </td>

                      {/* Assigned to */}
                      <td className="py-2.5 px-4 border-r border-slate-50">
                        {member ? (
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-md text-[9px] font-black text-white flex items-center justify-center shrink-0 ${member.color.split(' ')[0]}`}>
                              {member.initials}
                            </span>
                            <span className="truncate font-semibold text-slate-800">{member.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Onbekend</span>
                        )}
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-4 border-r border-slate-50">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider leading-none ${subjectBadgeClass}`}>
                          {subject}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-4 border-r border-slate-50 font-medium text-slate-800 max-w-[280px] truncate" title={task.description}>
                        {task.description}
                      </td>

                      {/* Start Time */}
                      <td className="py-2.5 px-4 font-mono text-slate-500 border-r border-slate-50">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-350" />
                          <span>{task.startTime}</span>
                        </div>
                      </td>

                      {/* End Time */}
                      <td className="py-2.5 px-4 font-mono text-slate-500 border-r border-slate-50">
                        {task.endTime}
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-4 font-semibold">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide leading-none ${priorityBadgeClass}`}>
                          {task.priority === Priority.CRITICAL ? 'Urgent' : task.priority.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
