export default function Card({ title, value, meta, tone = 'neutral', children }) {
  return (
    <section className={`card tone-${tone}`}>
      {title && <div className="card-title">{title}</div>}
      {value && <div className="card-value">{value}</div>}
      {meta && <div className="card-meta">{meta}</div>}
      {children}
    </section>
  );
}
