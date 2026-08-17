import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, GraduationCap, Home, Search, UserRound } from 'lucide-react';
import './academic-profile.css';

const results = [
  { subject: 'Mathematics', color: '#2563eb', unit1: 84, mid: 87, unit2: 91, final: 94, classAverage: 82 },
  { subject: 'Science', color: '#0f9488', unit1: 83, mid: 86, unit2: 90, final: 93, classAverage: 81 },
  { subject: 'English', color: '#7c3aed', unit1: 86, mid: 89, unit2: 93, final: 96, classAverage: 86 },
  { subject: 'Social Studies', color: '#d97706', unit1: 68, mid: 71, unit2: 75, final: 78, classAverage: 76 },
  { subject: 'Hindi', color: '#db2777', unit1: 77, mid: 80, unit2: 84, final: 87, classAverage: 79 },
  { subject: 'Computer Science', color: '#0891b2', unit1: 89, mid: 92, unit2: 96, final: 99, classAverage: 88 },
];

const yearResults = [
  { year: '2024-25', className: 'VIII - A', score: 78.4, classAverage: 75.8 },
  { year: '2025-26', className: 'IX - A', score: 83.7, classAverage: 78.2 },
  { year: '2026-27', className: 'X - A', score: 86.2, classAverage: 80.4 },
];

const exams = [
  { key: 'unit1', label: 'Unit Test 1' },
  { key: 'mid', label: 'Mid Term' },
  { key: 'unit2', label: 'Unit Test 2' },
  { key: 'final', label: 'Final Exam' },
];

const average = (row) => Math.round(exams.reduce((sum, exam) => sum + row[exam.key], 0) / exams.length);
const grade = (value) => value >= 90 ? 'A+' : value >= 80 ? 'A' : value >= 70 ? 'B' : 'C';
const heatColor = (value) => value >= 90 ? '#dff3e8' : value >= 80 ? '#fff0cc' : '#fde3e1';

function SelectField({ label, value, onChange, children }) {
  return <label className="academic-filter"><span>{label}</span><div><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><ChevronDown size={14} /></div></label>;
}

function TrendChart() {
  const points = yearResults.map((item, index) => `${48 + index * 190},${170 - (item.score - 70) * 6}`).join(' ');
  const classPoints = yearResults.map((item, index) => `${48 + index * 190},${170 - (item.classAverage - 70) * 6}`).join(' ');
  return <div className="trend-chart" aria-label="Academic performance trend chart"><svg viewBox="0 0 480 200" role="img">
    {[50,90,130,170].map((y) => <line key={y} x1="38" x2="450" y1={y} y2={y} className="grid-line" />)}
    <polyline points={classPoints} className="class-line" /><polyline points={points} className="student-line" />
    {yearResults.map((item, index) => <g key={item.year}><circle cx={48 + index * 190} cy={170 - (item.score - 70) * 6} r="5" className="student-dot" /><text x={48 + index * 190} y="194" textAnchor="middle">{item.year}</text><text x={48 + index * 190} y={158 - (item.score - 70) * 6} textAnchor="middle" className="score-label">{item.score}%</text></g>)}
  </svg><div className="chart-legend"><span><i className="student-key" />Student</span><span><i className="class-key" />Class average</span></div></div>;
}

export default function AcademicProfile() {
  const [subject, setSubject] = useState('All Subjects');
  const [exam, setExam] = useState('All Exams');
  const visibleSubjects = useMemo(() => subject === 'All Subjects' ? results : results.filter((row) => row.subject === subject), [subject]);
  const visibleExams = useMemo(() => exam === 'All Exams' ? exams : exams.filter((item) => item.label === exam), [exam]);
  const overall = Math.round(results.reduce((sum, row) => sum + average(row), 0) / results.length);

  return <div className="academic-app">
    <aside className="academic-sidebar"><div className="academic-brand"><GraduationCap size={25} /><div><strong>DELHI PUBLIC SCHOOL</strong><small>Knowledge · Character · Excellence</small></div></div><nav><a href="/"><Home size={17} />Dashboard</a><a className="active" href="/student-profile"><UserRound size={17} />Student Profile</a><a href="/approval-configuration"><GraduationCap size={17} />Approval Setup</a></nav></aside>
    <main className="academic-main">
      <header className="academic-topbar"><a href="/" aria-label="Back to dashboard"><ArrowLeft size={18} /></a><label><Search size={15} /><input placeholder="Search menu..." /></label><span>Academic year: <strong>2026-27</strong></span><div className="academic-user">KS</div></header>
      <div className="academic-content">
        <section className="student-banner"><div className="student-avatar">SR</div><div><h1>Maligireddy Shriyansh Reddy</h1><p>Student ID 1261136 · Class II · Section A · Roll No. 18</p></div><span>ACTIVE</span></section>
        <nav className="profile-tabs"><a href="#overview">Overview</a><a href="#guardian">Parent / Guardian</a><a href="#attendance">Attendance</a><a href="#ledger">Student Ledger</a><a href="#report">Report Card</a><a className="active" href="#academic">Academic History & Comparison</a></nav>
        <div className="academic-heading"><div><p>Examination / Academic Performance</p><h2>Consolidated Academic Performance</h2><span>Review results, progression and class-level comparisons</span></div></div>
        <section className="academic-filters"><SelectField label="Academic Year" value="2026-27" onChange={() => {}}><option>2026-27</option></SelectField><SelectField label="Class" value="X - A" onChange={() => {}}><option>X - A</option></SelectField><SelectField label="Subject" value={subject} onChange={setSubject}><option>All Subjects</option>{results.map((row) => <option key={row.subject}>{row.subject}</option>)}</SelectField><SelectField label="Exam" value={exam} onChange={setExam}><option>All Exams</option>{exams.map((item) => <option key={item.key}>{item.label}</option>)}</SelectField></section>
        <section className="academic-kpis"><article><span>Overall percentage</span><strong>{overall}%</strong><small>2026-27 aggregate</small></article><article><span>Overall grade</span><strong>{grade(overall)}</strong><small>Consistent performance</small></article><article><span>Class rank</span><strong>6 / 42</strong><small>Top 15% of class</small></article><article><span>Improvement</span><strong className="positive">+2.5%</strong><small>From previous year</small></article></section>
        <div className="academic-grid">
          <section className="academic-card"><header><div><h3>Overall academic performance</h3><p>Year-on-year aggregate against class average</p></div></header><TrendChart /></section>
          <section className="academic-card"><header><div><h3>Academic year comparison</h3><p>Progression across classes</p></div></header><div className="year-list">{yearResults.map((item) => <article key={item.year}><div><strong>{item.year}</strong><small>{item.className}</small></div><div className="year-track"><i style={{width:`${item.score}%`}} /></div><b>{item.score}%</b></article>)}</div></section>
          <section className="academic-card wide"><header><div><h3>Exam × Subject Performance</h3><p>Hover a cell for marks, maximum and grade</p></div><div className="heat-legend"><span>Low</span><i className="low" /><i className="mid" /><i className="high" /><span>High</span></div></header><div className="academic-table-wrap"><table className="heat-table"><thead><tr><th>Subject</th>{visibleExams.map((item) => <th key={item.key}>{item.label}</th>)}<th>Average</th></tr></thead><tbody>{visibleSubjects.map((row) => <tr key={row.subject}><th><i style={{background:row.color}} />{row.subject}</th>{visibleExams.map((item) => <td key={item.key} style={{background:heatColor(row[item.key])}} title={`${row.subject}: ${row[item.key]}/100, Grade ${grade(row[item.key])}`}><strong>{row[item.key]}%</strong></td>)}<td><b>{average(row)}%</b></td></tr>)}</tbody></table></div></section>
          <section className="academic-card wide"><header><div><h3>Student vs class average</h3><p>Current academic year subject comparison</p></div></header><div className="comparison-list">{visibleSubjects.map((row) => <article key={row.subject}><strong>{row.subject}</strong><div><span className="student-bar" style={{width:`${average(row)}%`}} /><span className="class-marker" style={{left:`${row.classAverage}%`}} /></div><b>{average(row)}%</b><small>Class {row.classAverage}%</small></article>)}</div></section>
        </div>
      </div>
    </main>
  </div>;
}
