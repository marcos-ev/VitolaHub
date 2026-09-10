import './Features.css';

const FEATURES = [
  {
    id: 'humidor',
    title: 'Sua coleção, curada',
    text: 'Umidor digital com quantidade, preço, notas e histórico. Menos caos na gaveta — mais controle na coleção.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 9.5h16M9.5 9.5V20M14.5 9.5V20" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'taste',
    title: 'Conheça seu paladar',
    text: 'Avaliações com notas de sabor, força e harmonização. Estatísticas que mostram padrões que você ainda não viu.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3.5l2.2 4.45 4.9.72-3.55 3.46.84 4.88L12 14.7l-4.39 2.31.84-4.88L4.9 8.67l4.9-.72L12 3.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'community',
    title: 'O lounge está aberto',
    text: 'Publique o momento, comente sem enrolação e descubra o que a galera está fumando — do feed às conversas.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7.5 18.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5h12A2.5 2.5 0 0 1 20.5 8v8A2.5 2.5 0 0 1 18 18.5h-4.2L9.5 21v-2.5H7.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shops',
    title: 'Charutarias perto de você',
    text: 'Encontre parceiros no mapa, avalie o atendimento e converse direto pelo app — feito para o Brasil.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s6.5-5.2 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.8 6.5 11 6.5 11z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="section features" id="recursos">
      <div className="container">
        <p className="eyebrow">Não é só mais um app de charuto —</p>
        <h2 className="section-title">Ferramentas de aficionado. Alma de clube.</h2>
        <p className="section-lead">
          Registro, coleção, avaliação e comunidade. Sem virar catálogo de loja.
        </p>

        <div className="features__grid">
          {FEATURES.map((feature, index) => (
            <article key={feature.id} className="feature">
              <span className="feature__index">0{index + 1}</span>
              <div className="feature__icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
