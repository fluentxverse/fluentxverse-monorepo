import { useEffect, useState } from 'react';

interface TimingDetail {
  method: string;
  url: string;
  sentAt?: string;
  receivedAt: string;
  durationMs: number;
  error?: boolean;
}

export default function ApiTiming() {
  const [last, setLast] = useState<TimingDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as TimingDetail;
      setLast(detail);
    };
    window.addEventListener('api-timing', handler as EventListener);
    return () => window.removeEventListener('api-timing', handler as EventListener);
  }, []);

  if (!last) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 12,
      zIndex: 1000,
      maxWidth: 360
    }}>
      <div style={{ marginBottom: 4, opacity: 0.9 }}>
        {last.method} {last.url}
      </div>
      <div>Time sent: {last.sentAt || '-'}</div>
      <div>Reply received: {last.receivedAt}</div>
      <div>
        Total time taken: {last.durationMs} ms {last.error ? '(error)' : ''}
      </div>
    </div>
  );
}
