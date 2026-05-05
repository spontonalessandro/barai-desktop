export default function PlaceholderPage({ title, subtitle, bullets }) {
  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Modulo previsto</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="cards-grid three">
        {bullets.map((b) => (
          <div className="card soft" key={b.title}>
            <h3>{b.title}</h3>
            <p>{b.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
