import './Hero.css';

const STATS = [
  { value: '1.400', label: 'charutos no catálogo' },
  { value: '38', label: 'parceiros verificados' },
  { value: '18+', label: 'acesso restrito' },
];

export function Hero() {
  return (
    <section className="hero" id="topo">
      <div className="hero__glow hero__glow--a" aria-hidden />
      <div className="hero__glow hero__glow--b" aria-hidden />
      <div className="hero__grain" aria-hidden />

      <div className="container hero__layout">
        <div className="hero__copy">
          <p className="eyebrow reveal">Compartilhe · Deguste · Descubra</p>
          <h1 className="hero__headline reveal reveal-delay-1">Seu lounge particular, no bolso.</h1>
          <p className="hero__sub reveal reveal-delay-2">
            Organize o umidor, registre o paladar e conecte-se com aficionados e charutarias perto de
            você — o lounge particular no bolso.
          </p>
          <div className="hero__actions reveal reveal-delay-3">
            <a className="btn btn-primary" href="#baixar">
              Baixar o app
            </a>
            <a className="btn btn-ghost" href="#parceiros">
              Sou lojista
            </a>
          </div>
        </div>

        <div className="hero__stage reveal reveal-delay-2" aria-hidden>
          <div className="phone">
            <div className="phone__notch" />
            <div className="phone__screen">
              <header className="phone__top">
                <span className="phone__brand">Vitola Hub</span>
                <span className="phone__pill">Feed</span>
              </header>

              <article className="phone-card">
                <div className="phone-card__meta">
                  <span className="phone-card__avatar">MC</span>
                  <div>
                    <strong>@marcos.costa</strong>
                    <small>há 2h · São Paulo</small>
                  </div>
                </div>
                <p className="phone-card__title">Partagás Serie D No. 4</p>
                <div className="phone-card__stars">★★★★☆</div>
                <div className="phone-card__chips">
                  <span>Madeira</span>
                  <span>Cacau</span>
                  <span>Café</span>
                </div>
              </article>

              <article className="phone-card phone-card--alt">
                <div className="phone-card__meta">
                  <span className="phone-card__avatar phone-card__avatar--b">LR</span>
                  <div>
                    <strong>@lounge.rio</strong>
                    <small>há 5h · Rio de Janeiro</small>
                  </div>
                </div>
                <p className="phone-card__title">Hoyo de Monterrey Epicure No. 2</p>
                <div className="phone-card__stars">★★★★★</div>
                <div className="phone-card__chips">
                  <span>Cedro</span>
                  <span>Noz</span>
                  <span>Mel</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      <div className="container hero__stats reveal reveal-delay-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="hero__stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
