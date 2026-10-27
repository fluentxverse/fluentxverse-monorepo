import { createResource, createSignal, For, Show } from 'solid-js';
import { ExternalLink, ShieldCheck, RefreshCw } from 'lucide-solid';
import { client } from '../../api/utils';
import './ScreeningCredential.css';

interface Credential { commitment: string; status: string; shared: boolean; revoked: boolean; expiresAt: string; verificationUrl: string | null }
const labels: Record<string, string> = { issued: 'Credential issued', proof_ready: 'Proof ready', awaiting_horizen_validation: 'Awaiting receipt verification', revoked: 'Revoked', expired: 'Expired', verified: 'Certification verified', verification_unavailable: 'Verification temporarily unavailable' };
export default function ScreeningCredential() {
  const [data, { refetch }] = createResource(async () => {
    try { return (await client.get('/screening/me')).data.data as { enabled: boolean; credentials: Credential[] }; }
    catch { return null; }
  });
  const [pending, setPending] = createSignal('');
  const [error, setError] = createSignal('');
  const share = async (credential: Credential, shared: boolean) => {
    setPending(credential.commitment); setError('');
    try { await client.post(`/screening/${credential.commitment}/share`, { shared }); await refetch(); }
    catch { setError('Sharing could not be updated. Please try again.'); }
    finally { setPending(''); }
  };
  return <Show when={data()?.enabled}>
    <section class="screening-credential" aria-label="Private screening certification">
      <div class="screening-credential-heading"><h3><ShieldCheck size={20} /> Screening Credential</h3>
        <button type="button" title="Refresh certification status" aria-label="Refresh certification status" disabled={data.loading || !!pending()} onClick={() => void refetch()}><RefreshCw size={16} /></button>
      </div>
      <Show when={data()?.credentials.length} fallback={<p>No screening credential issued yet.</p>}>
        <For each={data()?.credentials}>{credential => <div class="screening-credential-row">
          <div><strong>{labels[credential.status] || credential.status}</strong><p>Expires {new Date(Number(credential.expiresAt) * 1000).toLocaleDateString()}</p></div>
          <label><input type="checkbox" checked={credential.shared} disabled={credential.revoked || pending() === credential.commitment}
            onChange={event => void share(credential, event.currentTarget.checked)} /> Share certification</label>
          <Show when={credential.verificationUrl}><a href={credential.verificationUrl!} target="_blank" rel="noopener noreferrer">Verify <ExternalLink size={15} /></a></Show>
        </div>}</For>
      </Show>
      <p>Sharing publishes your tutor identifier and certification proof, not scores or screening records. Blockchain records cannot be removed.</p>
      <Show when={error()}><p role="alert">{error()}</p></Show>
    </section>
  </Show>;
}
