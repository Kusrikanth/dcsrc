import { useMemo, useRef, useState } from 'react';
import {
  Bell, Bold, BookOpen, CalendarDays, Cake, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CheckCheck, ClipboardCheck, Clock3, FileText, Home, Italic, Library, Link, List, Menu, MessageCircle, MessageSquareText, Search, Settings,
  Plus, Save, Smartphone, Underline, UserCheck, UserRoundCog, Users, X, XCircle,
} from 'lucide-react';
import './home.css';

const initialApprovals = [
  { id: 1, type: 'Leave request', person: 'Aarav Mehta', detail: 'Class IX-A · Medical leave', range: '18–20 Aug', submitted: 'Today, 9:12 AM', priority: 'Urgent', requirement: 'mandatory' },
  { id: 2, type: 'Fee concession', person: 'Meera Nair', detail: 'Class VII-C · Sibling concession', range: '2026–27', submitted: 'Yesterday', priority: 'Normal', requirement: 'mandatory' },
  { id: 3, type: 'Purchase request', person: 'R. Prakash', detail: 'Science Department · Lab supplies', range: '₹18,450', submitted: '15 Aug', priority: 'Normal', requirement: 'mandatory' },
  { id: 4, type: 'TC request acknowledgement', person: 'Nisha Kapoor', detail: 'Class X-B · IT clearance notification', range: 'TC-2026-184', submitted: '14 Aug', priority: 'Normal', requirement: 'acknowledgement' },
];

const initialActions = [
  { id: 'ACT-201', title: 'Verify pending TC documents', owner: 'K. Srikanth', assignee: 'Neha Kapoor', createdAt: '2026-08-14T09:10', deadline: '2026-08-17T04:00', source: 'TC Request', status: 'open' },
  { id: 'ACT-202', title: 'Reconcile concession approval receipts', owner: 'Kavitha Rao', assignee: 'K. Srikanth', createdAt: '2026-08-15T11:25', deadline: '2026-08-18T12:30', source: 'Fee Concession', status: 'open' },
  { id: 'ACT-198', title: 'Publish updated bus route list', owner: 'Joseph Mathew', assignee: 'K. Srikanth', createdAt: '2026-08-12T10:00', deadline: '2026-08-15T03:00', source: 'Transport', status: 'completed', completedDate: '2026-08-16T09:20', closedAt: '16 Aug, 9:20 AM', remarks: 'Updated route list published to the parent app.' },
];

const feedItems = [
  { icon: FileText, title: 'Term I examination schedule published', meta: 'Examination Office · 24 minutes ago', tag: 'Academic' },
  { icon: Users, title: 'Class IX parent-teacher meeting', meta: 'Saturday, 22 August · Auditorium', tag: 'Notice' },
  { icon: BookOpen, title: 'Updated library circulation policy', meta: 'Library · Yesterday', tag: 'Policy' },
];

const events = [
  { day: '18', month: 'AUG', title: 'Inter-house quiz', time: '10:00 AM', place: 'Main auditorium' },
  { day: '20', month: 'AUG', title: 'Faculty development workshop', time: '2:30 PM', place: 'Seminar hall' },
  { day: '22', month: 'AUG', title: 'Parent-teacher meeting', time: '9:00 AM', place: 'Classrooms' },
];

const birthdays = [
  { initials: 'AK', name: 'Ananya Krishnan', role: 'Student · VIII-B' },
  { initials: 'VS', name: 'Vikram Singh', role: 'Faculty · Mathematics' },
  { initials: 'RM', name: 'Riya Malhotra', role: 'Student · X-A' },
];

const fixedHolidays = {
  '2026-08-15': 'Independence Day',
  '2026-09-05': "Teachers' Day",
};

const punchRecords = {
  '2026-08-01': ['08:42 AM', '04:36 PM'], '2026-08-03': ['08:51 AM', '04:42 PM'],
  '2026-08-04': ['08:47 AM', '04:39 PM'], '2026-08-05': ['08:55 AM', '04:48 PM'],
  '2026-08-06': ['08:44 AM', '04:35 PM'], '2026-08-07': ['08:49 AM', '04:51 PM'],
  '2026-08-08': ['08:52 AM', '01:18 PM'], '2026-08-10': ['08:41 AM', '04:46 PM'],
  '2026-08-11': ['08:58 AM', '04:40 PM'], '2026-08-12': ['08:45 AM', '04:54 PM'],
  '2026-08-13': ['08:48 AM', '04:44 PM'], '2026-08-14': ['08:43 AM', '04:31 PM'],
};

const calendarEmployees = [
  { id: 'EMP-1008', name: 'K. Srikanth', title: 'Branch Administrator', department: 'Administration' },
  { id: 'EMP-1094', name: 'Neha Kapoor', title: 'Senior Administrator', department: 'Administration' },
  { id: 'EMP-1021', name: 'Kavitha Rao', title: 'Accounts Manager', department: 'Accounts' },
  { id: 'EMP-1048', name: 'Joseph Mathew', title: 'IT Administrator', department: 'Information Technology' },
  { id: 'EMP-1086', name: 'Preeti Sharma', title: 'Admissions Head', department: 'Admissions' },
];

const initialEmployeeNotes = {
  'EMP-1094': { '2026-08-05': '<strong>Admissions review</strong><p>Completed the document verification review for 18 applicants.</p>' },
  'EMP-1021': { '2026-08-11': '<strong>Fee reconciliation</strong><p>Reconciled online receipts and shared exceptions with Finance.</p>' },
  'EMP-1048': { '2026-08-07': '<strong>Network maintenance</strong><p>Updated access points in the senior school block.</p>' },
};

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function CalendarEmployeeFilter({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const current = calendarEmployees.find((employee) => employee.id === selected);
  const matches = calendarEmployees.filter((employee) => `${employee.name} ${employee.id} ${employee.title} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="calendar-employee-filter"><button type="button" onClick={() => { setQuery(''); setOpen((value) => !value); }}><Users size={15} /><span><strong>{current.name}</strong><small>{current.id} · {current.department}</small></span><ChevronDown size={14} /></button>{open && <div className="calendar-employee-menu"><label><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID or department" /></label><div>{matches.map((employee) => <button type="button" className={employee.id === selected ? 'selected' : ''} key={employee.id} onClick={() => { onSelect(employee.id); setOpen(false); }}><span>{employee.name}<small>{employee.title}</small></span><span>{employee.id}<small>{employee.department}</small></span></button>)}{!matches.length && <p>No reporting members found</p>}</div></div>}</div>;
}

function WorkingCalendar({ onTaskCreated }) {
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 7, 1));
  const [selectedEmployee, setSelectedEmployee] = useState(calendarEmployees[0].id);
  const [notes, setNotes] = useState(initialEmployeeNotes);
  const [tasks, setTasks] = useState({});
  const [editorDate, setEditorDate] = useState('');
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);

  function changeMonth(amount) { setVisibleMonth(new Date(year, month + amount, 1)); }

  return (
    <section className="panel work-calendar-panel">
      <header className="panel-header calendar-header">
        <div><h2>Working calendar</h2><p>Attendance status, punches and school holidays</p></div>
        <div className="calendar-header-actions"><CalendarEmployeeFilter selected={selectedEmployee} onSelect={setSelectedEmployee} /><div className="calendar-controls"><button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button><strong>{visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><button className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={17} /></button></div></div>
      </header>
      <div className="calendar-legend"><span><i className="present" />Present</span><span><i className="holiday" />Holiday</span><span><i className="no-status" />No status</span></div>
      <div className="calendar-grid" role="grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />;
          const key = dateKey(year, month, day);
          const weekday = new Date(year, month, day).getDay();
          const holiday = fixedHolidays[key] || (weekday === 0 ? 'Sunday · Weekly holiday' : '');
          const basePunches = punchRecords[key];
          const employeeIndex = calendarEmployees.findIndex((employee) => employee.id === selectedEmployee);
          const punches = basePunches && !(employeeIndex > 0 && (day + employeeIndex) % 9 === 0) ? basePunches : null;
          const status = holiday ? 'holiday' : punches ? 'present' : 'no-status';
          const savedTasks = tasks[selectedEmployee]?.[key] || [];
          return <button type="button" className={`calendar-day ${status}`} key={key} role="gridcell" onClick={() => setEditorDate(key)}><b>{day}</b>{punches && <span>Present</span>}{holiday && <span>{weekday === 0 ? 'Sunday' : 'Holiday'}</span>}{notes[selectedEmployee]?.[key] && <i className="calendar-note-dot" title="Date has a note" />}{savedTasks.length > 0 && <i className="calendar-task-dot" title={`${savedTasks.length} task${savedTasks.length > 1 ? 's' : ''}`} />}<div className="calendar-tooltip">{holiday ? <><strong>{holiday}</strong><small>No punch required</small></> : punches ? <><strong>Present</strong><small>Punch in: {punches[0]}</small><small>Punch out: {punches[1]}</small><small>Worked: 7h 52m</small></> : <><strong>No status</strong><small>No attendance or holiday information.</small></>}{notes[selectedEmployee]?.[key] && <small className="tooltip-note">Saved note available</small>}{savedTasks.length > 0 && <small className="tooltip-task">{savedTasks.length} assigned task{savedTasks.length > 1 ? 's' : ''}</small>}<small className="tooltip-action">Click to add or edit a note</small></div></button>;
        })}
      </div>
      {editorDate && <CalendarNoteDialog date={editorDate} employee={calendarEmployees.find((item) => item.id === selectedEmployee)} initialValue={notes[selectedEmployee]?.[editorDate] || ''} onClose={() => setEditorDate('')} onSave={(content, task) => { setNotes((current) => ({ ...current, [selectedEmployee]: { ...(current[selectedEmployee] || {}), [editorDate]: content } })); if (task) { setTasks((current) => ({ ...current, [selectedEmployee]: { ...(current[selectedEmployee] || {}), [editorDate]: [...(current[selectedEmployee]?.[editorDate] || []), task] } })); onTaskCreated(task, selectedEmployee, editorDate); } setEditorDate(''); }} />}
    </section>
  );
}

function CalendarNoteDialog({ date, employee, initialValue, onClose, onSave }) {
  const editorRef = useRef(null);
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignee, setAssignee] = useState(calendarEmployees[0].id);
  const [error, setError] = useState('');
  const displayDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  function command(name, value = null) { editorRef.current?.focus(); document.execCommand(name, false, value); }
  function addLink() { const url = window.prompt('Enter the link URL'); if (url) command('createLink', url); }
  function save() {
    if (createTask && (!taskTitle.trim() || !deadline || !assignee)) { setError('Task title, deadline and assignee are required.'); return; }
    const task = createTask ? { id: Date.now(), title: taskTitle.trim(), deadline, assignee } : null;
    onSave(editorRef.current?.innerHTML.trim() || '', task);
  }

  return <div className="calendar-note-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="calendar-note-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-note-title"><header><div><h2 id="calendar-note-title">Calendar note</h2><p>{employee.name} · {employee.id} · {displayDate}</p></div><button className="icon-button" onClick={onClose} aria-label="Close note editor"><X size={18} /></button></header><div className="rich-toolbar" aria-label="Text formatting"><button onClick={() => command('bold')} title="Bold"><Bold size={16} /></button><button onClick={() => command('italic')} title="Italic"><Italic size={16} /></button><button onClick={() => command('underline')} title="Underline"><Underline size={16} /></button><span /><button onClick={() => command('insertUnorderedList')} title="Bulleted list"><List size={16} /></button><button onClick={addLink} title="Insert link"><Link size={16} /></button></div><div ref={editorRef} className="calendar-rich-editor" contentEditable suppressContentEditableWarning data-placeholder="Type a note, reminder or update for this date..." dangerouslySetInnerHTML={{ __html: initialValue }} /><div className="task-option"><button type="button" className={createTask ? 'active' : ''} onClick={() => { setCreateTask((value) => !value); setError(''); }}><ClipboardCheck size={16} /><span><strong>Create a task</strong><small>Assign this follow-up to yourself or another employee</small></span><i>{createTask ? 'On' : 'Off'}</i></button>{createTask && <div className="task-builder"><label className="task-title-field">Task title<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Enter task title" /></label><label>Deadline<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><TaskAssigneePicker value={assignee} onChange={setAssignee} />{error && <p className="task-error">{error}</p>}</div>}</div><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Save size={15} />{createTask ? 'Save note & create task' : 'Save note'}</button></footer></section></div>;
}

function TaskAssigneePicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = calendarEmployees.find((item) => item.id === value);
  const matches = calendarEmployees.filter((item) => `${item.name} ${item.id} ${item.title} ${item.department}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="task-assignee"><span>Assign to</span><button type="button" onClick={() => { setQuery(''); setOpen((state) => !state); }}><UserCheck size={15} /><span><strong>{selected.name}{selected.id === calendarEmployees[0].id ? ' (Self)' : ''}</strong><small>{selected.id} · {selected.department}</small></span><ChevronDown size={14} /></button>{open && <div className="task-assignee-menu"><label><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username or employee ID" /></label>{matches.map((item) => <button type="button" key={item.id} className={item.id === value ? 'selected' : ''} onClick={() => { onChange(item.id); setOpen(false); }}><span>{item.name}{item.id === calendarEmployees[0].id ? ' (Self)' : ''}<small>{item.title}</small></span><span>{item.id}<small>{item.department}</small></span></button>)}</div>}</div>;
}

function CloseActionDialog({ action, onClose, onConfirm }) {
  const [remarks, setRemarks] = useState('');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="close-action-dialog" role="dialog" aria-modal="true"><header><div className="dialog-icon approve"><CheckCircle2 size={20} /></div><div><h2>Close action</h2><p>{action.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="close-action-summary"><span>{action.id} · Assigned to {action.assignee}</span><strong>Due {new Date(action.deadline).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</strong></div><label>Closure remarks<textarea autoFocus rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Enter what was completed or the outcome" /></label><small>Remarks are required before this action can be closed.</small><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!remarks.trim()} onClick={() => onConfirm(remarks)}><Check size={15} />Mark as completed</button></footer></section></div>;
}

function AddActionDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignee, setAssignee] = useState(calendarEmployees[0].id);
  const [error, setError] = useState('');
  function create() { if (!title.trim() || !deadline || !assignee) { setError('Task title, deadline and assignee are required.'); return; } onCreate({ title: title.trim(), deadline, assignee }); }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="add-action-dialog" role="dialog" aria-modal="true"><header><div className="dialog-icon approve"><ClipboardCheck size={20} /></div><div><h2>Create an action</h2><p>Assign a task to yourself or another employee</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="add-action-fields"><label>Task title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter task title" /></label><label>Deadline<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><TaskAssigneePicker value={assignee} onChange={setAssignee} />{error && <p>{error}</p>}</div><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={create}><Plus size={15} />Create action</button></footer></section></div>;
}

function ReassignActionDialog({ action, onClose, onReassign }) {
  const currentEmployee = calendarEmployees.find((employee) => employee.name === action.assignee);
  const [assignee, setAssignee] = useState(currentEmployee?.id || calendarEmployees[0].id);
  const [remarks, setRemarks] = useState('');
  const unchanged = currentEmployee?.id === assignee;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="reassign-action-dialog" role="dialog" aria-modal="true"><header><div className="dialog-icon reassign"><UserRoundCog size={20} /></div><div><h2>Reassign action</h2><p>{action.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="reassign-summary"><span>Current assignee</span><strong>{action.assignee}</strong><small>{action.id} · Due {new Date(action.deadline).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</small></div><div className="reassign-fields"><TaskAssigneePicker value={assignee} onChange={setAssignee} /><label>Reassignment note (optional)<textarea rows="3" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context for the new assignee" /></label></div><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={unchanged} onClick={() => onReassign(assignee, remarks)}><UserRoundCog size={15} />Reassign</button></footer></section></div>;
}

function ActionCommentDialog({ action, onClose, onAddComment }) {
  const [comment, setComment] = useState('');
  const comments = action.comments || [];
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="action-comment-dialog" role="dialog" aria-modal="true"><header><div className="dialog-icon comment"><MessageSquareText size={20} /></div><div><h2>Action comments</h2><p>{action.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>{comments.length > 0 && <div className="comment-history">{comments.map((item) => <article key={item.id}><span>{item.author.split(' ').map((part) => part[0]).join('').slice(0,2)}</span><div><strong>{item.author}<small>{item.createdAt}</small></strong><p>{item.text}</p></div></article>)}</div>}<label className="new-action-comment">Add comment<textarea autoFocus rows="4" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a progress update or comment" /></label><small className="comment-help">Adding a comment will not close this action.</small><footer><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!comment.trim()} onClick={() => onAddComment(comment.trim())}><MessageSquareText size={15} />Add comment</button></footer></section></div>;
}

function ActionUserFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = calendarEmployees.find((employee) => employee.id === value);
  const matches = calendarEmployees.filter((employee) => `${employee.name} ${employee.id} ${employee.title} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="action-user-filter"><button type="button" onClick={() => { setQuery(''); setOpen((state) => !state); }}><Users size={14} /><span><strong>{selected ? selected.name : 'All users'}</strong><small>{selected ? `${selected.id} · ${selected.department}` : 'No employee filter'}</small></span><ChevronDown size={14} /></button>{open && <div className="action-user-menu"><label><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID or department" /></label><button type="button" className={!value ? 'selected' : ''} onClick={() => { onChange(''); setOpen(false); }}><span>All users<small>Show every assignee</small></span></button>{matches.map((employee) => <button type="button" className={employee.id === value ? 'selected' : ''} key={employee.id} onClick={() => { onChange(employee.id); setOpen(false); }}><span>{employee.name}<small>{employee.title}</small></span><span>{employee.id}<small>{employee.department}</small></span></button>)}</div>}</div>;
}

function RangeCalendarMonth({ monthDate, range, onSelect, onMonthChange }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const monthNames = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString('en-IN', { month:'long' }));
  return <div className="range-calendar-month"><div className="range-month-selects"><select value={year} onChange={(event) => onMonthChange(new Date(Number(event.target.value),month,1))}>{[2025,2026,2027].map((item) => <option key={item}>{item}</option>)}</select><select value={month} onChange={(event) => onMonthChange(new Date(year,Number(event.target.value),1))}>{monthNames.map((name,index) => <option key={name} value={index}>{name}</option>)}</select></div><div className="range-weekdays">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => <span key={day}>{day}</span>)}</div><div className="range-days">{cells.map((day,index) => { if (!day) return <i key={`empty-${index}`} />; const key = dateKey(year,month,day); const inRange = range.start && range.end && key >= range.start && key <= range.end; return <button type="button" key={key} className={`${key === range.start || key === range.end ? 'edge' : ''}${inRange ? ' in-range' : ''}`} onClick={() => onSelect(key)}>{day}</button>; })}</div></div>;
}

function ActionDateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [firstMonth, setFirstMonth] = useState(new Date(2026,7,1));
  const display = value.start ? `${new Date(`${value.start}T00:00:00`).toLocaleDateString('en-GB')} to ${new Date(`${(value.end || value.start)}T00:00:00`).toLocaleDateString('en-GB')}` : 'Select date range';
  function selectDate(key) { if (!value.start || value.end) onChange({ start:key, end:'' }); else onChange(key < value.start ? { start:key, end:value.start } : { start:value.start, end:key }); }
  function preset(daysBack, endOffset = 0) { const end = new Date(2026,7,16 - endOffset); const start = new Date(end); start.setDate(end.getDate() - daysBack); onChange({ start:dateKey(start.getFullYear(),start.getMonth(),start.getDate()), end:dateKey(end.getFullYear(),end.getMonth(),end.getDate()) }); }
  function shiftMonth(amount) { setFirstMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); }
  const secondMonth = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 1);
  return <div className="action-range-picker"><button type="button" onClick={() => setOpen((state) => !state)}><CalendarDays size={14} /><span><small>Date range</small><strong>{display}</strong></span></button>{open && <div className="range-popover"><aside><strong>Choose a period</strong><button onClick={() => preset(0)}>Today</button><button onClick={() => preset(0,1)}>Yesterday</button><button onClick={() => preset(6)}>This Week</button><button onClick={() => preset(6,7)}>Last Week</button><button onClick={() => preset(29)}>Last 30 Days</button><button onClick={() => preset(89)}>Last 90 Days</button></aside><div className="range-calendars"><button className="range-nav previous" onClick={() => shiftMonth(-1)}><ChevronLeft size={15} /></button><RangeCalendarMonth monthDate={firstMonth} range={value} onSelect={selectDate} onMonthChange={setFirstMonth} /><RangeCalendarMonth monthDate={secondMonth} range={value} onSelect={selectDate} onMonthChange={(date) => setFirstMonth(new Date(date.getFullYear(),date.getMonth()-1,1))} /><button className="range-nav next" onClick={() => shiftMonth(1)}><ChevronRight size={15} /></button><footer><button onClick={() => onChange({start:'',end:''})}>Clear</button><button className="apply-range" onClick={() => setOpen(false)} disabled={!value.start}>Apply range</button></footer></div></div>}</div>;
}

function ActionsPanel({ actions, onCloseAction, onAddAction, onReassignAction, onAddComment }) {
  const [tab, setTab] = useState('open');
  const [closing, setClosing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [reassigning, setReassigning] = useState(null);
  const [commenting, setCommenting] = useState(null);
  const [dateType, setDateType] = useState('deadline');
  const [dateRange, setDateRange] = useState({ start:'', end:'' });
  const [userFilter, setUserFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const selectedUser = calendarEmployees.find((employee) => employee.id === userFilter);
  const visible = actions.filter((action) => {
    const actionDate = action[dateType]?.slice(0,10);
    const searchable = `${action.title} ${action.id} ${action.source} ${action.owner} ${action.assignee} ${action.deadline} ${action.remarks || ''} ${(action.comments || []).map((comment) => comment.text).join(' ')}`.toLowerCase();
    return action.status === tab
      && (!dateRange.start || (actionDate && actionDate >= dateRange.start && actionDate <= (dateRange.end || dateRange.start)))
      && (!selectedUser || action.assignee === selectedUser.name)
      && (!keyword.trim() || searchable.includes(keyword.trim().toLowerCase()));
  });

  return <section className="panel actions-panel">
    <header className="panel-header"><div><h2>My Tasks</h2><p>Tasks assigned to you and your team</p></div><div className="action-header-controls"><div className="action-tabs"><button className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>Open <span>{actions.filter((item) => item.status === 'open').length}</span></button><button className={tab === 'completed' ? 'active' : ''} onClick={() => setTab('completed')}>Completed <span>{actions.filter((item) => item.status === 'completed').length}</span></button></div><button className="add-action-button" onClick={() => setAdding(true)}><Plus size={15} />Add</button></div></header>
    <label className="panel-keyword-search"><Search size={15} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search tasks by title, ID, source, assignee or comment" />{keyword && <button onClick={() => setKeyword('')} aria-label="Clear task search"><X size={14} /></button>}</label>
    <div className="action-filters"><ActionUserFilter value={userFilter} onChange={setUserFilter} /><label className="action-date-type"><select value={dateType} onChange={(event) => setDateType(event.target.value)}><option value="deadline">Due date</option><option value="createdAt">Created date</option><option value="completedDate">Completed date</option></select><ChevronDown size={13} /></label><ActionDateRangePicker value={dateRange} onChange={setDateRange} />{(userFilter || dateRange.start) && <button className="clear-action-filters" onClick={() => { setUserFilter(''); setDateRange({start:'',end:''}); }}>Clear</button>}</div>
    <div className="action-list">{visible.map((action) => <article className="action-row" key={action.id}><span className={`action-icon ${action.status}`}><ClipboardCheck size={17} /></span><div><strong>{action.title}</strong><p>{action.id} · {action.source}{action.comments?.length ? ` · ${action.comments.length} comment${action.comments.length > 1 ? 's' : ''}` : ''}</p><small>{action.status === 'open' ? `Assigned to ${action.assignee} · Due ${new Date(action.deadline).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}` : `Closed ${action.closedAt} · ${action.remarks}`}</small></div>{action.status === 'open' ? <div className="open-action-buttons"><button className="comment-action-button" title="Add comment" onClick={() => setCommenting(action)}><MessageSquareText size={17} />{action.comments?.length > 0 && <i>{action.comments.length}</i>}</button><button className="reassign-action-button" title="Reassign action" onClick={() => setReassigning(action)}><UserRoundCog size={17} /></button><button className="complete-action-button" title="Close action" onClick={() => setClosing(action)}><Check size={18} /></button></div> : <span className="completed-label"><CheckCheck size={15} />Completed</span>}</article>)}{!visible.length && <div className="empty-state"><CheckCircle2 size={27} /><strong>No matching {tab} actions</strong><p>Change or clear the date range and employee filters.</p></div>}</div>
    {closing && <CloseActionDialog action={closing} onClose={() => setClosing(null)} onConfirm={(remarks) => { onCloseAction(closing.id, remarks); setClosing(null); setTab('completed'); }} />}
    {adding && <AddActionDialog onClose={() => setAdding(false)} onCreate={(task) => { onAddAction(task); setAdding(false); setTab('open'); }} />}
    {reassigning && <ReassignActionDialog action={reassigning} onClose={() => setReassigning(null)} onReassign={(assignee, remarks) => { onReassignAction(reassigning.id, assignee, remarks); setReassigning(null); }} />}
    {commenting && <ActionCommentDialog action={commenting} onClose={() => setCommenting(null)} onAddComment={(comment) => { onAddComment(commenting.id, comment); setCommenting(null); }} />}
  </section>;
}

const homeworkRecords = [
  { id: 1, title: 'Light and Reflection - Practice Questions', kind: 'Homework', datetime: '2026-08-16T11:20:00', curriculum: 'CBSE', targets: ['VIII-B','VIII-C'] },
  { id: 2, title: 'Quadratic Equations Worksheet.pdf', kind: 'File', datetime: '2026-08-16T10:05:00', curriculum: 'CBSE', targets: ['X-A','X-B'] },
  { id: 3, title: 'The Last Leaf - Reading Assignment', kind: 'Homework', datetime: '2026-08-16T09:35:00', curriculum: 'CBSE', targets: ['IX-A','IX-C'] },
  { id: 4, title: 'भारत की खोज - Chapter Notes.pdf', kind: 'File', datetime: '2026-08-16T08:50:00', curriculum: 'CBSE', targets: ['VII-A','VII-B','VII-C'] },
  { id: 5, title: 'Plant Transport Lab Observation', kind: 'Homework', datetime: '2026-08-15T02:10:00', curriculum: 'Cambridge', targets: ['VI-A','VI-B'] },
  { id: 6, title: 'Indian Constitution Reference Notes.pdf', kind: 'File', datetime: '2026-08-14T12:30:00', curriculum: 'State Board', targets: ['IX-B'] },
];

function MultiFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  function toggle(option) { onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]); }
  return <div className="home-multi-filter"><button type="button" onClick={() => setOpen((value) => !value)}><span>{label}<small>{selected.length ? `${selected.length} selected` : 'All'}</small></span><ChevronDown size={14} /></button>{open && <div className="home-filter-menu">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} /><span>{option}</span></label>)}{selected.length > 0 && <button type="button" className="clear-filter" onClick={() => onChange([])}>Clear selection</button>}</div>}</div>;
}

function HomeworkChart() {
  const [curricula, setCurricula] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [date, setDate] = useState('');
  const effectiveDate = date || '2026-08-16';
  const rows = homeworkRecords.filter((record) => {
    if (!record.datetime.startsWith(effectiveDate)) return false;
    if (curricula.length && !curricula.includes(record.curriculum)) return false;
    if (classes.length && !record.targets.some((target) => classes.includes(target.split('-')[0]))) return false;
    if (sections.length && !record.targets.some((target) => sections.includes(target.split('-')[1]))) return false;
    return true;
  });

  return <section className="panel homework-panel">
    <header className="panel-header"><div><h2>Homework overview</h2><p>{date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Today'} · Homework and files shared through the system</p></div><BookOpen size={19} /></header>
    <div className="homework-filters"><MultiFilter label="Curriculum" options={['CBSE','Cambridge','State Board']} selected={curricula} onChange={setCurricula} /><MultiFilter label="Class" options={['VI','VII','VIII','IX','X']} selected={classes} onChange={setClasses} /><MultiFilter label="Section" options={['A','B','C','D']} selected={sections} onChange={setSections} /><label className="homework-date"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} />{!date && <small>Defaults to today</small>}</label></div>
    <div className="homework-table"><div className="homework-table-head"><span>Title</span><span>Date & time</span><span>Classes</span></div>{rows.map((record) => <article className="homework-record" key={record.id}><div><span className={`homework-kind ${record.kind.toLowerCase()}`}>{record.kind === 'File' ? <FileText size={15} /> : <BookOpen size={15} />}</span><div><strong>{record.title}</strong><small>{record.kind} · {record.curriculum}</small></div></div><time>{new Date(record.datetime).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}<small>{new Date(record.datetime).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</small></time><span className="class-list">{record.targets.join(', ')}</span></article>)}{!rows.length && <div className="homework-empty"><FileText size={22} /><strong>No homework or files found</strong><p>Change the filters or select another date.</p></div>}</div>
  </section>;
}

const communications = {
  whatsapp: [
    { id: 'wa-1', title: 'PTM reminder', audience: 'Class IX parents', time: '10:15 AM', message: 'Dear Parent, the Class IX Parent-Teacher Meeting is scheduled for Saturday, 22 August from 9:00 AM. Please confirm your attendance.', sent: 128, engaged: 109 },
    { id: 'wa-2', title: 'Fee due reminder', audience: 'Pending fee accounts', time: 'Yesterday', message: 'This is a reminder that the Term I fee payment is due by 20 August. Please ignore this message if payment has already been completed.', sent: 74, engaged: 61 },
  ],
  app: [
    { id: 'app-1', title: 'Homework published', audience: 'Class VIII-B', time: '11:20 AM', message: 'Science homework on Light and Reflection has been published. Submission is due on 18 August.', sent: 46, engaged: 33 },
    { id: 'app-2', title: 'School bus update', audience: 'Route 12 users', time: '9:05 AM', message: 'Route 12 is delayed by approximately 15 minutes due to traffic near Tarnaka.', sent: 82, engaged: 68 },
  ],
};

function CommunicationPreview() {
  const [channel, setChannel] = useState('whatsapp');
  const [selectedId, setSelectedId] = useState(communications.whatsapp[0].id);
  const items = communications[channel];
  const selected = items.find((item) => item.id === selectedId) || items[0];

  function selectChannel(nextChannel) { setChannel(nextChannel); setSelectedId(communications[nextChannel][0].id); }

  return <section className="panel communication-panel">
    <header className="panel-header"><div><h2>Messages & notifications</h2><p>Delivery performance and recipient preview</p></div><div className="communication-tabs"><button className={channel === 'whatsapp' ? 'active' : ''} onClick={() => selectChannel('whatsapp')}><MessageCircle size={14} />WhatsApp</button><button className={channel === 'app' ? 'active' : ''} onClick={() => selectChannel('app')}><Smartphone size={14} />Mobile app</button></div></header>
    <div className="communication-body">
      <div className="communication-list">
        <div className="communication-stats"><span><b>{selected.sent}</b>{channel === 'whatsapp' ? 'Sent' : 'Delivered'}</span><span><b>{selected.engaged}</b>{channel === 'whatsapp' ? 'Read' : 'Opened'}</span><span><b>{Math.round(selected.engaged / selected.sent * 100)}%</b>Engagement</span></div>
        <div className="delivery-track"><i style={{width:`${selected.engaged / selected.sent * 100}%`}} /></div>
        {items.map((item) => <button key={item.id} className={item.id === selected.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><span className={channel}><MessageSquareText size={15} /></span><div><strong>{item.title}</strong><p>{item.audience}</p></div><small>{item.time}</small></button>)}
      </div>
      <div className={`mobile-preview ${channel}`} aria-label={`${channel === 'whatsapp' ? 'WhatsApp message' : 'Mobile app notification'} preview`}>
        <div className="mobile-status"><span>9:41</span><span>LTE · 87%</span></div>
        {channel === 'whatsapp' ? <>
          <div className="whatsapp-head"><span>DPS</span><div><strong>Delhi Public School</strong><small>official account</small></div></div>
          <div className="chat-screen"><div className="date-chip">TODAY</div><div className="message-bubble"><p>{selected.message}</p><small>{selected.time} <CheckCheck size={12} /></small></div></div>
        </> : <>
          <div className="app-head"><span>DPS</span><strong>Delhi Public School</strong></div>
          <div className="app-screen"><div className="app-notification"><span><Bell size={16} /></span><div><small>DELHI PUBLIC SCHOOL · NOW</small><strong>{selected.title}</strong><p>{selected.message}</p></div></div><button>View details</button></div>
        </>}
      </div>
    </div>
  </section>;
}

function ApprovalDialog({ item, action, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const isReject = action === 'reject';
  const isAcknowledgement = action === 'acknowledge';
  const disabled = !reason.trim();

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="approval-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        <header>
          <div className={`dialog-icon ${isReject ? 'reject' : 'approve'}`}>
            {isReject ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h2 id="approval-title">{isReject ? 'Reject request' : isAcknowledgement ? 'Acknowledge request' : 'Approve request'}</h2>
            <p>{item.type} for {item.person}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        </header>
        <div className="request-summary">
          <span>Request details</span>
          <strong>{item.detail}</strong>
          <small>{item.range} · Submitted {item.submitted.toLowerCase()}</small>
        </div>
        <label htmlFor="approval-reason">{isReject ? 'Reason for rejection' : isAcknowledgement ? 'Acknowledgement comment' : 'Approval comment'}</label>
        <textarea
          id="approval-reason"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isReject ? 'Enter a clear reason for rejecting this request' : isAcknowledgement ? 'Enter an acknowledgement comment' : 'Enter an approval comment'}
          rows="4"
        />
        <small className="decision-review-note">Ensure you double-check the relevant information before approving or acknowledging this request.</small>
        {!reason.trim() && <small className="field-help">A comment is required to continue.</small>}
        <footer>
          <button className="button secondary" onClick={onClose}>Cancel</button>
          <button className={`button ${isReject ? 'danger' : 'primary'}`} disabled={disabled} onClick={() => onConfirm(reason)}>
            {isReject ? <X size={16} /> : <Check size={16} />}
            {isReject ? 'Reject request' : isAcknowledgement ? 'Acknowledge' : 'Approve request'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function HomeScreen() {
  const currentUser = { name: 'K. Srikanth', role: 'Branch Admin', canApprove: true };
  const [approvals, setApprovals] = useState(initialApprovals);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  const [actions, setActions] = useState(initialActions);
  const [filter, setFilter] = useState('All requests');
  const [approvalSearch, setApprovalSearch] = useState('');

  const visibleApprovals = useMemo(() => approvals.filter((item) => {
    const searchable = `${item.type} ${item.person} ${item.detail} ${item.range} ${item.submitted} ${item.priority} ${item.requirement}`.toLowerCase();
    return (filter === 'All requests' || item.type === filter) && (!approvalSearch.trim() || searchable.includes(approvalSearch.trim().toLowerCase()));
  }), [approvals, filter, approvalSearch]);

  function completeApproval(reason) {
    const { item, action } = dialog;
    setApprovals((current) => current.filter((request) => request.id !== item.id));
    setDialog(null);
    const completedAction = action === 'approve' ? 'approved' : action === 'acknowledge' ? 'acknowledged' : 'rejected';
    setToast(`${item.type} ${completedAction}${reason ? ' with a note' : ''}.`);
    window.setTimeout(() => setToast(''), 2600);
  }

  function addCalendarTask(task, ownerId, sourceDate) {
    const owner = calendarEmployees.find((item) => item.id === ownerId);
    const assignee = calendarEmployees.find((item) => item.id === task.assignee);
    setActions((current) => [{ id: `ACT-${Date.now().toString().slice(-4)}`, title: task.title, owner: owner.name, assignee: assignee.name, createdAt: `${sourceDate}T09:00`, deadline: task.deadline, source: `Calendar · ${sourceDate}`, status: 'open' }, ...current]);
  }

  function closeAction(id, remarks) {
    setActions((current) => current.map((action) => action.id === id ? { ...action, status: 'completed', remarks, completedDate: new Date().toISOString(), closedAt: new Date().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) } : action));
    setToast('Action marked as completed.');
    window.setTimeout(() => setToast(''), 2600);
  }

  function addDirectAction(task) {
    const assignee = calendarEmployees.find((item) => item.id === task.assignee);
    setActions((current) => [{ id: `ACT-${Date.now().toString().slice(-4)}`, title: task.title, owner: currentUser.name, assignee: assignee.name, createdAt: new Date().toISOString(), deadline: task.deadline, source: 'Manual action', status: 'open' }, ...current]);
    setToast('New action created.');
    window.setTimeout(() => setToast(''), 2600);
  }

  function reassignAction(id, assigneeId, remarks) {
    const assignee = calendarEmployees.find((item) => item.id === assigneeId);
    setActions((current) => current.map((action) => action.id === id ? { ...action, previousAssignee: action.assignee, assignee: assignee.name, reassignmentRemarks: remarks, reassignedAt: new Date().toISOString() } : action));
    setToast(`Action reassigned to ${assignee.name}.`);
    window.setTimeout(() => setToast(''), 2600);
  }

  function addActionComment(id, text) {
    const entry = { id: Date.now(), text, author: currentUser.name, createdAt: new Date().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) };
    setActions((current) => current.map((action) => action.id === id ? { ...action, comments: [...(action.comments || []), entry] } : action));
    setToast('Comment added. Action remains open.');
    window.setTimeout(() => setToast(''), 2600);
  }

  return (
    <div className="home-app">
      <aside className="side-nav">
        <div className="school-brand"><span>DPS</span><div><strong>Delhi Public School</strong><small>School ERP</small></div></div>
        <nav aria-label="Main navigation">
          <a className="active" href="/"><Home size={18} />Home</a>
          <a href="#attendance"><UserCheck size={18} />Attendance</a>
          <a href="#feed"><MessageSquareText size={18} />Feeds</a>
          <a href="#events"><CalendarDays size={18} />Calendar</a>
          <a href="/student-profile"><BookOpen size={18} />Student Profile</a>
          <a href="/approval-configuration"><Settings size={18} />Approval Setup</a>
          <a href="/documentation-management"><Library size={18} />Documentation</a>
        </nav>
      </aside>

      <main className="home-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu"><Menu size={20} /></button>
          <label className="global-search"><Search size={17} /><input placeholder="Search students, staff or menu" /></label>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button>
            <div className="account"><span>KS</span><div><strong>K. Srikanth</strong><small>Branch Admin</small></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="home-content">
          <section className="welcome-band">
            <div><p>Sunday, 16 August 2026</p><h1>Good morning, Srikanth</h1><span>Here is what needs your attention today.</span></div>
            <div className="campus-selector"><small>Campus</small><strong>NH - Nacharam</strong><ChevronDown size={16} /></div>
          </section>

          <section className="metric-grid" aria-label="Today at a glance">
            <article><span className="metric-icon teal"><UserCheck size={20} /></span><div><small>Student attendance</small><strong>94.8%</strong><p>2,361 of 2,490 present</p></div></article>
            <article><span className="metric-icon green"><CheckCircle2 size={20} /></span><div><small>Staff attendance</small><strong>97.2%</strong><p>174 of 179 present</p></div></article>
            {currentUser.canApprove && <article><span className="metric-icon orange"><ClipboardCheck size={20} /></span><div><small>Pending actions</small><strong>{approvals.length}</strong><p>{approvals.filter((a) => a.requirement === 'mandatory').length} approvals · {approvals.filter((a) => a.requirement === 'acknowledgement').length} acknowledgements</p></div></article>}
            <article><span className="metric-icon red"><Clock3 size={20} /></span><div><small>Students on leave</small><strong>32</strong><p>8 requests awaiting review</p></div></article>
          </section>

          <div className="dashboard-grid">
            {currentUser.canApprove && approvals.length > 0 && <section className="panel approvals-panel">
              <header className="panel-header"><div><h2>Approvals & acknowledgements</h2><p>Mandatory decisions and non-blocking notifications</p></div>
                <label className="compact-select"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All requests</option><option>Leave request</option><option>Fee concession</option><option>Purchase request</option><option>Event permission</option></select><ChevronDown size={15} /></label>
              </header>
              <label className="panel-keyword-search"><Search size={15} /><input value={approvalSearch} onChange={(event) => setApprovalSearch(event.target.value)} placeholder="Search requests by person, type, class or reference" />{approvalSearch && <button onClick={() => setApprovalSearch('')} aria-label="Clear approval search"><X size={14} /></button>}</label>
              <div className="approval-list">
                {visibleApprovals.length ? visibleApprovals.map((item) => (
                  <article className="approval-row" key={item.id}>
                    <span className="request-type-icon"><FileText size={18} /></span>
                    <div className="approval-info"><div><strong>{item.type}</strong>{item.priority === 'Urgent' && <span className="urgent-tag">Urgent</span>}<span className={`requirement-tag ${item.requirement}`}>{item.requirement === 'mandatory' ? 'Mandatory' : 'Acknowledgement'}</span></div><p>{item.person}</p><small>{item.detail} · {item.range} · {item.submitted}{item.requirement === 'acknowledgement' ? ' · Does not block completion' : ''}</small></div>
                    <div className="approval-actions">
                      {item.requirement === 'mandatory' ? <><button className="icon-button reject-button" title="Reject" aria-label={`Reject ${item.type}`} onClick={() => setDialog({ item, action: 'reject' })}><X size={18} /></button><button className="icon-button approve-button" title="Approve" aria-label={`Approve ${item.type}`} onClick={() => setDialog({ item, action: 'approve' })}><Check size={18} /></button></> : <button className="acknowledge-button" onClick={() => setDialog({ item, action: 'acknowledge' })}><Check size={15} /> Acknowledge</button>}
                    </div>
                  </article>
                )) : <div className="empty-state"><Search size={27} /><strong>No matching requests</strong><p>Change or clear the keyword and request filters.</p></div>}
              </div>
            </section>}

            {actions.some((action) => action.status === 'open') && <ActionsPanel actions={actions} onCloseAction={closeAction} onAddAction={addDirectAction} onReassignAction={reassignAction} onAddComment={addActionComment} />}
            <WorkingCalendar onTaskCreated={addCalendarTask} />

            <section className="panel birthdays-panel">
              <header className="panel-header"><div><h2>Birthdays today</h2><p>Send your wishes</p></div><Cake size={19} /></header>
              {birthdays.map((person) => <article className="birthday-row" key={person.name}><span>{person.initials}</span><div><strong>{person.name}</strong><p>{person.role}</p></div><button className="text-button">Wish</button></article>)}
            </section>

            <HomeworkChart />
            <CommunicationPreview />

            <section className="panel feed-panel" id="feed">
              <header className="panel-header"><div><h2>School feed</h2><p>Latest notices and updates</p></div><button className="text-button">View all</button></header>
              {feedItems.map(({ icon: Icon, title, meta, tag }) => <article className="feed-row" key={title}><span><Icon size={18} /></span><div><strong>{title}</strong><p>{meta}</p></div><small>{tag}</small></article>)}
            </section>

            <section className="panel events-panel" id="events">
              <header className="panel-header"><div><h2>Upcoming events</h2><p>Next seven days</p></div><button className="icon-button" aria-label="Open calendar"><CalendarDays size={18} /></button></header>
              {events.map((event) => <article className="event-row" key={event.title}><time><b>{event.day}</b><span>{event.month}</span></time><div><strong>{event.title}</strong><p>{event.time} · {event.place}</p></div></article>)}
            </section>

          </div>
        </div>
      </main>
      {dialog && <ApprovalDialog {...dialog} onClose={() => setDialog(null)} onConfirm={completeApproval} />}
      {toast && <div className="home-toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}
