import { Info } from 'lucide-react';

export default function InfoLabel({ label, tip }) {
  return (
    <span className="info-label">
      {label}
      <span className="info-icon" aria-label={tip} title={tip}><Info size={13} /></span>
    </span>
  );
}
