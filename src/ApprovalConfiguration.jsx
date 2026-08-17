import { useMemo, useState } from 'react';
import {
  ArrowLeft, Check, ChevronDown, GripVertical,
  Plus, Save, Search, Settings, Trash2, Users, X,
} from 'lucide-react';
import './approval-configuration.css';

const employees = [
  { id: 'EMP-1021', name: 'Kavitha Rao', title: 'Accounts Manager', department: 'Accounts' },
  { id: 'EMP-1048', name: 'Joseph Mathew', title: 'IT Administrator', department: 'Information Technology' },
  { id: 'EMP-1002', name: 'Dr. Anjali Menon', title: 'Principal', department: 'School Leadership' },
  { id: 'EMP-1094', name: 'Neha Kapoor', title: 'Senior Administrator', department: 'Administration' },
  { id: 'EMP-1127', name: 'Rakesh Iyer', title: 'Records Officer', department: 'Student Records' },
  { id: 'EMP-1017', name: 'Suresh Nair', title: 'Finance Controller', department: 'Accounts' },
  { id: 'EMP-1086', name: 'Preeti Sharma', title: 'Admissions Head', department: 'Admissions' },
  { id: 'EMP-1142', name: 'Manoj Reddy', title: 'Admissions Executive', department: 'Admissions' },
];

const starterActivities = [
  {
    id: 'tc-request', name: 'TC Request', description: 'Transfer certificate issue workflow', active: true,
    participants: [
      { employeeId: 'EMP-1021', department: 'Accounts', role: 'mandatory' },
      { employeeId: 'EMP-1048', department: 'Information Technology', role: 'acknowledgement' },
      { employeeId: 'EMP-1002', department: 'Principal', role: 'mandatory' },
      { employeeId: 'EMP-1094', department: 'Administration', role: 'mandatory' },
      { employeeId: 'EMP-1127', department: 'Student Records', role: 'acknowledgement' },
    ],
  },
  {
    id: 'concession-approval', name: 'Concession Approval', description: 'Student fee concession approval', active: true,
    participants: [{ employeeId: 'EMP-1017', department: 'Accounts', role: 'mandatory' }],
  },
  {
    id: 'admission-cancellation', name: 'Admission Cancellation', description: 'Admission withdrawal and account closure', active: true,
    participants: [
      { employeeId: 'EMP-1017', department: 'Accounts', role: 'mandatory' },
      { employeeId: 'EMP-1086', department: 'Admissions', role: 'mandatory' },
    ],
  },
];

function employeeById(id) { return employees.find((employee) => employee.id === id); }

function EmployeePicker({ value, usedIds, onChange }) {
  const selectedEmployee = employeeById(value);
  const [query, setQuery] = useState(selectedEmployee ? `${selectedEmployee.name} — ${selectedEmployee.title}` : '');
  const [open, setOpen] = useState(false);
  const normalized = query.trim().toLowerCase();
  const matches = employees.filter((employee) => {
    if (usedIds.has(employee.id)) return false;
    const reference = `${employee.name} ${employee.id} ${employee.title} ${employee.department}`.toLowerCase();
    return !normalized || reference.includes(normalized) || employee.id === value;
  });

  function choose(employee) {
    setQuery(`${employee.name} — ${employee.title}`);
    setOpen(false);
    onChange(employee.id);
  }

  return (
    <div className="employee-picker">
      <label className="employee-search-control">
        <Search size={15} />
        <input
          value={query}
          onFocus={() => { if (selectedEmployee) setQuery(''); setOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onBlur={() => window.setTimeout(() => { const employee = employeeById(value); setOpen(false); setQuery(employee ? `${employee.name} — ${employee.title}` : ''); }, 140)}
          placeholder="Search employee, ID or department"
          aria-label="Search and select employee"
        />
        <ChevronDown size={15} />
      </label>
      <small className="selected-reference">{selectedEmployee ? `${selectedEmployee.id} · ${selectedEmployee.department}` : 'Start typing to find an employee'}</small>
      {open && <div className="employee-results">
        {matches.length ? matches.map((employee) => (
          <button type="button" key={employee.id} className={employee.id === value ? 'selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(employee)}>
            <span>{employee.name}<small>{employee.title}</small></span>
            <span>{employee.id}<small>{employee.department}</small></span>
          </button>
        )) : <div className="employee-no-results">No matching employees</div>}
      </div>}
    </div>
  );
}

export default function ApprovalConfiguration() {
  const [activities, setActivities] = useState(starterActivities);
  const [selectedId, setSelectedId] = useState(starterActivities[0].id);
  const [search, setSearch] = useState('');
  const [newActivity, setNewActivity] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [toast, setToast] = useState('');
  const selected = activities.find((activity) => activity.id === selectedId);
  const filteredActivities = activities.filter((activity) => activity.name.toLowerCase().includes(search.toLowerCase()));

  const counts = useMemo(() => ({
    mandatory: selected?.participants.filter((item) => item.employeeId && item.role === 'mandatory').length || 0,
    acknowledgement: selected?.participants.filter((item) => item.employeeId && item.role === 'acknowledgement').length || 0,
  }), [selected]);

  function updateSelected(updater) {
    setActivities((current) => current.map((activity) => activity.id === selectedId ? updater(activity) : activity));
  }

  function addParticipant() {
    updateSelected((activity) => ({ ...activity, participants: [...activity.participants, { employeeId: '', department: '', role: 'mandatory' }] }));
  }

  function updateParticipant(index, changes) {
    updateSelected((activity) => ({ ...activity, participants: activity.participants.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }));
  }

  function changeEmployee(index, employeeId) {
    const employee = employeeById(employeeId);
    updateParticipant(index, { employeeId, department: employee.department });
  }

  function removeParticipant(index) {
    updateSelected((activity) => ({ ...activity, participants: activity.participants.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function addActivity() {
    const name = activityName.trim();
    if (!name) return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    setActivities((current) => [...current, { id, name, description: 'Custom approval workflow', active: true, participants: [] }]);
    setSelectedId(id); setActivityName(''); setNewActivity(false);
  }

  function saveConfiguration() {
    if (selected.participants.some((item) => !item.employeeId || !item.department.trim())) {
      setToast('Complete the employee and department fields before saving.');
    } else if (!counts.mandatory) {
      setToast('Add at least one mandatory approver before saving.');
    } else {
      setToast(`${selected.name} configuration saved.`);
    }
    window.setTimeout(() => setToast(''), 2600);
  }

  return (
    <div className="config-page">
      <header className="config-topbar">
        <a href="/" className="config-back"><ArrowLeft size={18} /> Home</a>
        <div><Settings size={18} /><strong>Approval Configuration</strong></div>
        <span>Branch Admin</span>
      </header>

      <div className="config-heading">
        <div><p>Administration / Workflow Configuration</p><h1>Approval Configuration</h1><span>Define who must approve or acknowledge each school activity.</span></div>
        <button className="config-button primary" onClick={saveConfiguration}><Save size={16} /> Save configuration</button>
      </div>

      <main className="config-layout">
        <aside className="activity-list">
          <header><div><h2>Activities</h2><span>{activities.length} configured</span></div><button className="config-icon-button" onClick={() => setNewActivity(true)} title="Add activity"><Plus size={18} /></button></header>
          <label className="activity-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities" /></label>
          <nav>
            {filteredActivities.map((activity) => {
              const mandatory = activity.participants.filter((item) => item.role === 'mandatory').length;
              const optional = activity.participants.length - mandatory;
              return <button key={activity.id} className={activity.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(activity.id)}><span>{activity.name}</span><small>{mandatory} approver{mandatory !== 1 ? 's' : ''}{optional ? ` · ${optional} acknowledgement` : ''}</small></button>;
            })}
          </nav>
        </aside>

        <section className="workflow-editor">
          <header className="workflow-header">
            <div><h2>{selected.name}</h2><p>{selected.description}</p></div>
            <button className="config-button secondary" onClick={addParticipant} disabled={selected.participants.length === employees.length}><Plus size={16} /> Add person</button>
          </header>

          <div className="participant-table">
            <div className="participant-table-head"><span>Order</span><span>Employee</span><span>Department / responsibility</span><span>Requirement</span></div>
            {selected.participants.map((participant, index) => {
              const employee = employeeById(participant.employeeId);
              const usedIds = new Set(selected.participants.filter((_, itemIndex) => itemIndex !== index).map((item) => item.employeeId));
              return (
                <div className="participant-row" key={`${participant.employeeId}-${index}`}>
                  <div className="sequence"><GripVertical size={16} /><b>{index + 1}</b></div>
                  <EmployeePicker value={participant.employeeId} usedIds={usedIds} onChange={(employeeId) => changeEmployee(index, employeeId)} />
                  <label className="department-field"><span>Department</span><input value={participant.department} onChange={(e) => updateParticipant(index, { department: e.target.value })} /></label>
                  <div className="requirement-cell">
                    <div className="requirement-switch-field">
                      <label className="requirement-switch">
                        <input type="checkbox" checked={participant.role === 'mandatory'} onChange={(event) => updateParticipant(index, { role: event.target.checked ? 'mandatory' : 'acknowledgement' })} />
                        <span className="switch-track"><i /></span>
                        <b>{participant.role === 'mandatory' ? 'Mandatory approval' : 'Acknowledgement'}</b>
                      </label>
                      <small className={participant.role}>{participant.role === 'mandatory' ? 'Required to complete' : 'Optional · does not block'}</small>
                    </div>
                    <button className="record-delete" onClick={() => removeParticipant(index)} title={employee ? `Delete ${employee.name}` : 'Delete empty record'} aria-label={employee ? `Delete ${employee.name}` : 'Delete empty record'}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
            {!selected.participants.length && <div className="config-empty"><Users size={26} /><strong>No people configured</strong><p>Add at least one mandatory approver to activate this workflow.</p><button className="config-button secondary" onClick={addParticipant}><Plus size={16} /> Add first person</button></div>}
          </div>
        </section>
      </main>

      {newActivity && <div className="config-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setNewActivity(false)}><section className="new-activity-dialog" role="dialog" aria-modal="true"><header><div><h2>Add activity</h2><p>Create a workflow and then assign its participants.</p></div><button className="config-icon-button" onClick={() => setNewActivity(false)}><X size={18} /></button></header><label>Activity name<input autoFocus value={activityName} onChange={(e) => setActivityName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addActivity()} placeholder="Example: Refund request" /></label><footer><button className="config-button secondary" onClick={() => setNewActivity(false)}>Cancel</button><button className="config-button primary" disabled={!activityName.trim()} onClick={addActivity}><Plus size={16} /> Add activity</button></footer></section></div>}
      {toast && <div className="config-toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
