import './Pricing.css';

type Tier = {
  name: string;
  price: string;
  period?: string;
  altPrice?: string;
  blurb: string;
  featured?: boolean;
  badge?: string;
  cta: string;
  href: string;
  features: string[];
};

const TIERS: Tier[] = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    blurb: 'Entre e sinta o clima do lounge.',
    cta: 'Começar grátis',
    href: '#baixar',
    features: [
      'Umidor básico',
      'Feed e comunidade',
      'Avaliações de charutos',
      'Charutarias no mapa',
    ],
  },
  {
    name: 'Premium',
    price: 'R$ 9,90',
    period: '/mês',
    altPrice: 'Anual: R$ 79/ano (equiv. ~R$ 6,58/mês)',
    blurb: 'Para quem leva a coleção a sério.',
    featured: true,
    badge: '7 dias grátis',
    cta: 'Assinar Premium',
    href: '#baixar',
    features: [
      'Umidor completo',
      'Estatísticas de paladar',
      'Comparar charutos',
      'Harmonizações',
      'Recursos avançados da coleção',
    ],
  },
  {
    name: 'Parceiro',
    price: 'R$ 99,90',
    period: '/mês',
    blurb: 'Para charutarias que querem presença no app.',
    cta: 'Falar com a equipe',
    href: 'mailto:vitolahub@gmail.com?subject=Vitola%20Hub%20Parceiro',
    features: [
      'Perfil verificado da casa',
      'Chat com aficionados',
      'Avaliações da loja',
      'Presença no mapa',
    ],
  },
];

function CheckIcon() {
  return (
    <span className="plan__check" aria-hidden>
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M6 10.2l2.4 2.3L14 7.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Pricing() {
  return (
    <section className="section pricing" id="planos">
      <div className="container">
        <p className="eyebrow eyebrow--line">Planos</p>
        <h2 className="section-title">Comece grátis. Assine se fizer sentido.</h2>
        <p className="section-lead">
          Valores iguais aos do app. A cobrança acontece nas lojas (App Store / Google Play) ou via
          billing do Vitola Hub.
        </p>

        <div className="pricing__grid">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`plan ${tier.featured ? 'plan--featured' : ''}`}
              id={tier.name === 'Parceiro' ? 'parceiros-plano' : undefined}
            >
              {tier.badge ? <span className="plan__badge">{tier.badge}</span> : null}
              <h3>{tier.name}</h3>
              <p className="plan__price">
                {tier.price}
                {tier.period ? <span>{tier.period}</span> : null}
              </p>
              {tier.altPrice ? <p className="plan__alt">{tier.altPrice}</p> : null}
              <p className="plan__blurb">{tier.blurb}</p>
              {tier.name === 'Parceiro' ? (
                <p className="plan__alt">
                  Primeiras casas: taxa fundadora em torno de R$&nbsp;39,90/mês —{' '}
                  <a href="#fundadores">ver programa</a>.
                </p>
              ) : null}
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                className={`btn ${tier.featured ? 'btn-primary' : 'btn-ghost'}`}
                href={tier.href}
              >
                {tier.cta}
              </a>
            </article>
          ))}
        </div>
        <p className="pricing__note">
          * Valores alinhados ao app. Charutarias fundadoras (vagas limitadas) têm taxa travada
          abaixo do plano padrão — veja o{' '}
          <a href="#fundadores">Programa fundador</a>.
        </p>
      </div>
    </section>
  );
}
