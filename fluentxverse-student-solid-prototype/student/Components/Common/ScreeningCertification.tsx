import { createResource, Show } from 'solid-js';
import { ShieldCheck } from 'lucide-solid';
import { API_BASE_URL } from '../../config/api';
import './ScreeningCertification.css';

interface Summary { commitment: string; status: string; certified: boolean; claim: string; expiresAt: string; limitations: string[] }
export default function ScreeningCertification(props: { tutorId: string }) {
  const [summary] = createResource(() => props.tutorId, async tutorId => {
    try {
      const response = await fetch(`${API_BASE_URL}/screening/tutor/${encodeURIComponent(tutorId)}`, { cache: 'no-store' });
      return response.ok ? (await response.json()).data as Summary : null;
    } catch { return null; }
  });
  return <Show when={summary()?.certified && summary()?.status === 'verified'}>
    <details class="screening-certification">
      <summary><ShieldCheck size={16} /> Privately verified screening</summary>
      <p>Written assessment 90 or above, speaking assessment 85 or above, profile approved, and interview passed under the approved screening policy.</p>
      <p>Exact scores and screening records remain private. This verifies the issuer's results, not AI accuracy or model execution.</p>
      <p>Valid until {new Date(Number(summary()!.expiresAt) * 1000).toLocaleDateString()}.</p>
      <a href={`${API_BASE_URL}/screening/public/${summary()!.commitment}`} target="_blank" rel="noopener noreferrer">View verification evidence</a>
    </details>
  </Show>;
}
