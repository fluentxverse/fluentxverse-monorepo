import { labelText } from './OperationsShared';
import './TutorIdentityCredentials.css';

export function TutorIdentityCredentials({ credentials = [] }: { credentials?: any[] }) {
  return <section className="tutor-id-credentials" aria-labelledby="tutor-id-credentials-title">
    <header><div><h2 id="tutor-id-credentials-title">ID credential NFT</h2><p>Identity credential status and public blockchain metadata.</p></div></header>
    {!credentials.length && <p>No identity credential has been requested for this tutor.</p>}
    {credentials.map(credential => <article key={credential.submissionId}>
      <div className="tutor-id-heading"><strong>{credential.current ? 'Current credential' : 'Previous credential'}</strong>
        <span className={`tutor-id-status ${credential.revoked || credential.issuerStatus === 'invalidated' ? 'invalidated' : ''}`}>{labelText(credential.issuerStatus || credential.status).replace(/^credential /, '')}</span></div>
      <dl>
        {credential.chainId && <div><dt>Network</dt><dd>{credential.chainId === 42161 ? 'Arbitrum One' : `Chain ${credential.chainId}`}</dd></div>}
        {credential.wallet && <div><dt>Tutor wallet</dt><dd>{credential.wallet}</dd></div>}
        {credential.collection && <div><dt>Collection</dt><dd>{credential.collection}</dd></div>}
        {credential.tokenId && <div><dt>Token ID</dt><dd>{credential.tokenId}</dd></div>}
      </dl>
      <div className="tutor-id-links">
        {credential.metadataUrl && <a href={credential.metadataUrl} target="_blank" rel="noopener noreferrer">View NFT metadata <i aria-hidden="true" className="ri-external-link-line" /></a>}
        {credential.chainId === 42161 && /^0x[\da-f]{64}$/i.test(credential.mintTransactionHash || '') && <a href={`https://arbiscan.io/tx/${credential.mintTransactionHash}`} target="_blank" rel="noopener noreferrer">Mint transaction</a>}
        {/^0x[\da-f]{64}$/i.test(credential.proofTransactionHash || '') && credential.chainId === 42161 && <a href={`https://zkverify.subscan.io/extrinsic/${credential.proofTransactionHash}`} target="_blank" rel="noopener noreferrer">zkVerify proof</a>}
      </div>
      {!credential.metadataUrl && <p className="tutor-id-note">{credential.revoked ? 'No public NFT metadata is available for this invalidated request.' : 'Metadata becomes available after finalized NFT issuance.'}</p>}
      {credential.issuerStatus === 'invalidated' && <p className="tutor-id-note">This NFT remains on-chain, but its approval is no longer valid.</p>}
    </article>)}
  </section>;
}
