export default function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
