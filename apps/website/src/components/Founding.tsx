import { Link } from 'react-router-dom';
import './Founding.css';

const COMMITMENTS = [
  'Adesivo com QR na loja',
  'Post no Instagram da casa',
  'Indicação ao cliente na hora da venda',
  'Ajuda a alimentar e crescer o app',
];

const PERKS = [
  'Acesso antecipado',
  'Badge de fundador',
  'Suporte prioritário',
];

export function Founding() {
  return (
    <section className="section founding" id="fundadores">
      <span id="parceiros" className="founding__anchor" aria-hidden="true" />
      <div className="container">
        <div className="founding__panel">
          <p className="eyebrow eyebrow--line">Programa fundador</p>
          <h2 className="section-title">
            As primeiras 30 a 50 charutarias entram com preço travado.
          </h2>
          <p className="section-lead">
            Em torno de R$&nbsp;39,90/mês — bem abaixo do plano Parceiro padrão
            (R$&nbsp;99,90/mês) — por um período definido em contrato. Sem período de
            teste: o fundador entra comprometido, e o valor fica travado enquanto o
            contrato estiver vigente. Depois dessas vagas, novos parceiros entram no
            valor padrão.
          </p>

          <div className="founding__grid">
            <div className="founding__block">
              <p className="founding__label">A contrapartida não é só dinheiro — é divulgação</p>
              <ul className="founding__list">
                {COMMITMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="founding__block">
              <p className="founding__label">Extras do fundador</p>
              <ul className="founding__list founding__list--compact">
                {PERKS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="founding__actions">
            <Link className="btn btn-primary" to="/fundador">
              Quero ser fundador
            </Link>
            <Link className="btn btn-ghost" to="/contato">
              Falar com a equipe
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
