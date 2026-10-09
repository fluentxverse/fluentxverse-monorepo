import { useEffect, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { operations, operationError } from '../api/operations.api';
import { dateText, labelText, lessonLink, Fields, History, LessonTable, Metrics, OperationsAction, IconButton } from '../components/OperationsShared';
import './LessonOperationsPage.css';
export default function OperationsAccountPage() {
  const { role, id } = useRoute().params;
  const [data, setData] = useState<any>(null), [access, setAccess] = useState<any>(null), [tab, setTab] = useState('profile');
  const [error, setError] = useState(''), [history, setHistory] = useState<any[]>([]), [action, setAction] = useState<any>(null), [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); setError(''); try { setAccess(await operations('/access')); setData(await operations(`/people/${role}/${encodeURIComponent(id || '')}`)); setHistory(await operations(`/audit?subjectId=${encodeURIComponent(id || '')}`)); } catch (e) { setError(operationError(e)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [role, id]);
  return <div className="lesson-operations"><a href={role === 'tutor' ? '/tutors' : '/students'}><i aria-hidden="true" className="ri-arrow-left-line" />{role === 'tutor' ? 'Tutors' : 'Students'}</a><header><h1>{data?.person.name || 'Account Detail'}</h1><IconButton icon="refresh" title="Refresh" disabled={loading} onClick={load} /></header>{error && <p className="operations-error" role="alert">{error}</p>}{loading && <p>Loading...</p>}
    {data && <><nav className="operations-tabs">{['profile', 'lessons', 'schedule', 'penalties', 'issues', role === 'tutor' ? 'performance' : 'progress', 'transactions', 'history'].filter(t => (role === 'tutor' || t !== 'penalties') && (t !== 'transactions' || access?.permissions.includes('finance'))).map(t => <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{labelText(t)}</button>)}</nav>
      {tab === 'profile' && <><Fields value={data.person} />{data.person.isBlocked && role === 'tutor' && access?.permissions.includes('operations') && <button onClick={() => setAction({ kind: 'unblock', id })}><i aria-hidden="true" className="ri-lock-unlock-line" />Remove booking restriction</button>}</>}
      {tab === 'lessons' && <LessonTable rows={data.lessons} />}
      {tab === 'schedule' && <LessonTable rows={data.lessons.filter((b: any) => b.status === 'confirmed' && Date.parse(b.slotDateTime) > Date.now())} />}
      {tab === 'penalties' && <>{data.penalties.map((p: any) => <article className="operations-record"><Fields value={p} />{access?.permissions.includes('operations') && !p.revokedAt && p.status !== 'voided' && p.penaltyCode !== '601' && <button onClick={() => setAction({ kind: 'revoke', id: p.penaltyId })}>Revoke penalty</button>}</article>)}{!data.penalties.length && <p>No penalties.</p>}</>}
      {tab === 'issues' && <>{data.reports.map((r: any) => <article className="operations-record"><a href={lessonLink(r.bookingId)}>{r.tutorIssueLabel || r.studentIssueLabel || r.reason}</a><p>{dateText(r.createdAt)} · {labelText(r.status)}</p><p>{r.details}</p></article>)}{!data.reports.length && <p>No reports.</p>}</>}
      {tab === 'performance' && <Metrics data={data.performance} />}
      {tab === 'progress' && <Fields value={data.progress} />}
      {tab === 'transactions' && <Fields value={data.transactions} />}
      {tab === 'history' && <History rows={history} />}
    </>}
    {action && <OperationsAction action={action} permissions={access?.permissions} onClose={() => setAction(null)} onSaved={load} />}
  </div>;
}
