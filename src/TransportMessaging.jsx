import { useMemo, useState } from 'react';
import {
  Bell, BusFront, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, Download, LayoutDashboard, Menu, MessageCircle, Search,
  Send, Settings, Smartphone, Users, X,
} from 'lucide-react';
import './transport-messaging.css';

const routes = [
  { id: 4, route: 'Route No 4', bus: 'Not assigned', capacity: '7 / 0', driver: 'MAHAMMAD SALMAN KHAN', attender: 'JALLI MAHESWARI', phone: 'Not available', pickup: '7:55 AM / 8:20 AM', drop: '3:30 PM / 4:00 PM' },
  { id: 3, route: 'Route No 3', bus: 'TG08W2127', capacity: '13 / 32', driver: 'PAYYALA SATHYANARAYANA', attender: 'TALARI LAVANYA', phone: '+91 98480 21643', pickup: '7:05 AM / 8:25 AM', drop: '3:30 PM / 4:45 PM' },
  { id: 2, route: 'Route No 2', bus: 'TG08W2132', capacity: '31 / 48', driver: 'BUBBANABOINA NARENDHAR', attender: 'PAYYALA RENUKA', phone: '+91 99892 10482', pickup: '7:05 AM / 8:25 AM', drop: '3:30 PM / 4:50 PM' },
  { id: 1, route: 'Route No 1', bus: 'TG08W2138', capacity: '27 / 34', driver: 'MANGALI JAIYANTH', attender: 'KONDAM JYOTHI', phone: '+91 97011 63824', pickup: '7:00 AM / 8:25 AM', drop: '3:30 PM / 4:45 PM' },
];

const navItems = ['Dashboards', 'Academics', 'Uploads', 'User Management', 'Directory', 'Fee', 'Admissions', 'Student Attendance'];

export default function TransportMessaging() {
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [delay, setDelay] = useState('');
  const [channels, setChannels] = useState({ whatsapp: true, app: true });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => routes.filter((item) => `${item.route} ${item.bus} ${item.driver} ${item.attender}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const selectedRoutes = routes.filter((item) => selected.includes(item.id));
  const allSelected = filtered.length > 0 && filtered.every((item) => selected.includes(item.id));

  function toggleAll() {
    if (allSelected) setSelected((current) => current.filter((id) => !filtered.some((item) => item.id === id)));
    else setSelected((current) => [...new Set([...current, ...filtered.map((item) => item.id)])]);
  }

  function openComposer() {
    if (!selected.length) { setToast('Select at least one route to send a message.'); setTimeout(() => setToast(''), 2600); return; }
    setDelay(''); setError(''); setComposeOpen(true);
  }

  function sendMessage() {
    if (!delay || Number(delay) < 1 || Number(delay) > 999) { setError('Enter a delay between 1 and 999 minutes.'); return; }
    if (!channels.whatsapp && !channels.app) { setError('Select at least one delivery channel.'); return; }
    setComposeOpen(false);
    const channelText = channels.whatsapp && channels.app ? 'WhatsApp and mobile app' : channels.whatsapp ? 'WhatsApp' : 'mobile app';
    setToast(`Message queued for ${selected.length} route${selected.length > 1 ? 's' : ''} via ${channelText}.`);
    setTimeout(() => setToast(''), 3600);
  }

  const example = selectedRoutes[0] || routes[0];
  const preview = `Dear Parent, ${example.route} (${example.bus}) is delayed by ${delay || '—'} minutes. For assistance, contact the bus attender at ${example.phone}.`;

  return <div className="transport-app">
    <aside className="transport-sidebar">
      <div className="transport-brand"><span><BusFront size={22} /></span><div><strong>PALLAVI GROUP OF SCHOOLS</strong><small>Knowledge is Power</small></div></div>
      <button className="school-select">Pallavi Schools - II <ChevronDown size={16} /></button>
      <nav>{navItems.map((label, index) => <a key={label}><span>{index === 0 ? <LayoutDashboard /> : <Users />}</span>{label}<ChevronRight /></a>)}
        <a className="transport-active"><span><BusFront /></span>Transportation<ChevronDown /></a>
        <div className="subnav"><a>Dashboard</a><a>Settings</a><a className="active">Transport Management</a><a>Transport Concession</a><a>Transportation Records</a><a>Temporary Employee Management</a><a>Transport Registration</a></div>
      </nav>
    </aside>

    <main className="transport-main">
      <header className="transport-topbar"><Menu size={22} /><label><Search size={17} /><input placeholder="Search menu..." /></label><div className="top-spacer" /><span>Campus:</span><button>18. GD - GOV <ChevronDown size={14} /></button><span className="date"><CalendarDays size={16} />August 18th, 2026</span><CircleUserRound size={35} /><div className="user"><strong>K.SRIKANTH</strong><small>Branch_Admin</small></div></header>
      <div className="breadcrumbs"><span>Transportation</span><ChevronRight size={16} /><span>Transportation Management</span></div>
      <section className="transport-content">
        <div className="page-card">
          <header className="card-title"><div><h1>Transport Management</h1><p>Select routes and notify parents about transport delays.</p></div><button className="export"><Download size={16} />Export</button></header>
          <div className="filters"><label className="route-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search route, vehicle or staff" /></label><label className="year-field"><span>Academic Year</span><select><option>2026-2027</option></select></label><div className="selection-summary"><strong>{selected.length}</strong><span>route{selected.length === 1 ? '' : 's'} selected</span></div><button className="send-selected" onClick={openComposer}><Send size={16} />Send message</button></div>
          <div className="route-table" role="table">
            <div className="table-row table-head" role="row"><span className="check-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible routes" /></span><span>Route Name</span><span>Vehicle Number</span><span>Capacity</span><span>Driver Name</span><span>Attender Name / Number</span><span>Trip 1<br/><small>Pickup Start / End Time<br/>Drop Start / End Time</small></span></div>
            {filtered.map((item) => <div className={`table-row ${selected.includes(item.id) ? 'selected' : ''}`} role="row" key={item.id} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}><span className="check-cell"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => {}} aria-label={`Select ${item.route}`} /></span><span><strong>{item.route}</strong></span><span>{item.bus}</span><span><a>{item.capacity}</a></span><span>{item.driver}</span><span><strong>{item.attender}</strong><small>{item.phone}</small></span><span>{item.pickup}<small>{item.drop}</small></span></div>)}
            {!filtered.length && <div className="empty-routes"><Search size={24} /><strong>No routes found</strong><span>Try a different search term.</span></div>}
          </div>
          <footer className="table-footer"><span>Showing 1 to {filtered.length} of {filtered.length} records</span><div>Rows per page: <button>10 <ChevronDown size={14} /></button><button disabled>Previous</button><button className="page-one">1</button><button disabled>Next</button></div></footer>
        </div>
      </section>
    </main>

    {composeOpen && <div className="compose-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setComposeOpen(false)}><section className="compose-dialog" role="dialog" aria-modal="true"><header><div><span><MessageCircle size={20} /></span><div><h2>Send transport delay update</h2><p>{selected.length} route{selected.length > 1 ? 's' : ''} selected</p></div></div><button onClick={() => setComposeOpen(false)} aria-label="Close"><X size={19} /></button></header>
      <div className="compose-body"><div className="compose-form"><label className="delay-field"><span>Delay duration <b>*</b></span><div><input type="number" min="1" max="999" value={delay} onChange={(e) => { setDelay(e.target.value); setError(''); }} autoFocus placeholder="e.g. 15"/><span>minutes</span></div><small>This is the only value you need to enter.</small></label>
        <fieldset><legend>Send through</legend><label><input type="checkbox" checked={channels.whatsapp} onChange={(e) => setChannels({...channels, whatsapp: e.target.checked})}/><MessageCircle size={18}/><span><strong>WhatsApp</strong><small>Send approved template message</small></span></label><label><input type="checkbox" checked={channels.app} onChange={(e) => setChannels({...channels, app: e.target.checked})}/><Smartphone size={18}/><span><strong>Mobile app notification</strong><small>Push notification to registered devices</small></span></label></fieldset>
        <div className="selected-list"><div><strong>Selected routes</strong><button onClick={() => {setComposeOpen(false);}}>Edit selection</button></div>{selectedRoutes.map((item) => <span key={item.id}><Check size={13}/>{item.route}<small>{item.bus}</small></span>)}</div>{error && <p className="form-error">{error}</p>}</div>
        <aside className="message-preview"><div className="preview-title"><span>Message preview</span><small>4 variables</small></div><div className="template-variables"><span><b>1</b>Delay: <strong>{delay || '—'} min</strong></span><span><b>2</b>Route: <strong>{example.route}</strong></span><span><b>3</b>Bus: <strong>{example.bus}</strong></span><span><b>4</b>Attender: <strong>{example.phone}</strong></span></div><div className="phone-preview"><div className="phone-head"><MessageCircle size={16}/>Pallavi Schools</div><div className="message-bubble">{preview}<small>10:32 AM ✓✓</small></div></div><p>Preview uses {example.route}. Each selected route receives its own backend-filled details.</p></aside></div>
      <footer><button className="cancel" onClick={() => setComposeOpen(false)}>Cancel</button><button className="confirm-send" onClick={sendMessage}><Send size={16}/>Send to {selected.length} route{selected.length > 1 ? 's' : ''}</button></footer>
    </section></div>}
    {toast && <div className="transport-toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}
