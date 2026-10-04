import './TicketArtwork.css';

interface TicketArtworkProps {
  tier: 'basic' | 'premium' | 'trial';
  compact?: boolean;
}

const TicketArtwork = ({ tier, compact = false }: TicketArtworkProps) => (
  <div
    className={`ticket-artwork ticket-artwork--${tier}${compact ? ' ticket-artwork--compact' : ''}`}
    role="img"
    aria-label={`${tier} lesson ticket`}
  >
    <span className="ticket-artwork__brand">
      <img src="/assets/img/logo/icon_logo.webp" alt="" />
      FXV
    </span>
    <strong>{tier}</strong>
    <small>Lesson pass</small>
  </div>
);

export default TicketArtwork;
