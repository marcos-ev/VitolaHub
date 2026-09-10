import { useState } from 'react';
import './FAQ.css';

const ITEMS = [
  {
    q: 'O que é o Vitola Hub?',
    a: 'Um app brasileiro para aficionados: umidor digital, avaliações de paladar, feed social e charutarias parceiras com chat.',
  },
  {
    q: 'O Vitola Hub vende tabaco?',
    a: 'Não. Não vendemos, distribuímos nem incentivamos a venda de produtos de tabaco. Conectamos aficionados e charutarias parceiras.',
  },
  {
    q: 'É gratuito?',
    a: 'Sim. O núcleo é gratuito (feed, umidor básico e avaliações). O Premium custa R$ 9,90/mês ou R$ 79/ano, com 7 dias grátis, e libera estatísticas, comparação e recursos avançados da coleção. Valores iguais aos do app; a cobrança acontece nas lojas.',
  },
  {
    q: 'Sou lojista — como entro?',
    a: 'O plano Parceiro (Shop) custa R$ 99,90/mês. As primeiras 30 a 50 charutarias podem entrar pelo Programa fundador, com taxa travada em torno de R$ 39,90/mês mediante contrato (sem trial), em troca de divulgação na loja. Escolha “Sou lojista” no cadastro (CNPJ) ou fale com a equipe.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="section faq" id="duvidas">
      <div className="container">
        <p className="eyebrow eyebrow--line">Dúvidas</p>
        <h2 className="section-title">Perguntas frequentes</h2>

        <div className="faq__list">
          {ITEMS.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.q} className={`faq__item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="faq__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : index)}
                >
                  <span>{item.q}</span>
                  <span className="faq__icon" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen ? <p className="faq__a">{item.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
