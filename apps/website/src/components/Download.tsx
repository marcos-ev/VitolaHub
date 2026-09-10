import './Download.css';

export function Download() {
  return (
    <section className="section download" id="baixar">
      <div className="container download__inner">
        <p className="eyebrow eyebrow--line">Baixar</p>
        <h2 className="section-title">Sua próxima vitola começa aqui.</h2>
        <p className="section-lead">Baixe o Vitola Hub e comece a registrar sua coleção.</p>
        <div className="download__stores">
          <a className="store" href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            <strong>App Store</strong>
            <span>Em breve</span>
          </a>
          <a className="store" href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            <strong>Google Play</strong>
            <span>Em breve</span>
          </a>
        </div>
      </div>
    </section>
  );
}
