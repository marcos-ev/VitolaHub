import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContact } from '../lib/contactApi';
import './ContatoPage.css';
import './FundadorPage.css';

const STEPS = [
  { n: '1', label: 'Envie a candidatura da loja' },
  { n: '2', label: 'A equipe analisa o perfil' },
  { n: '3', label: 'Contrato e preço travado' },
];

const BENEFITS = [
  {
    title: 'Preço fundador travado',
    body: 'Em torno de R$ 39,90/mês — bem abaixo do Parceiro padrão (R$ 99,90) — enquanto o contrato estiver vigente.',
  },
  {
    title: 'Sem período de teste',
    body: 'O fundador entra comprometido: vaga limitada, contrato claro, valor travado desde o dia 1.',
  },
  {
    title: 'Badge e acesso antecipado',
    body: 'Selo de fundador no perfil da loja, prioridade em novidades e suporte mais próximo.',
  },
  {
    title: 'Contrapartida = divulgação',
    body: 'QR na loja, post no Instagram da casa e indicação ao cliente na hora da venda.',
  },
];

const COMMITMENTS = [
  'Adesivo com QR na loja',
  'Post no Instagram da casa',
  'Indicação ao cliente na hora da venda',
];

type Status = 'idle' | 'loading' | 'success' | 'error';

export function FundadorPage() {
  const [tradeName, setTradeName] = useState('');
  const [city, setCity] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agree) {
      setStatus('error');
      setError('Confirme que leu os termos do programa fundador.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      await submitContact({
        type: 'founding',
        name: name.trim(),
        email: email.trim(),
        tradeName: tradeName.trim(),
        city: city.trim(),
        whatsapp: whatsapp.trim() || undefined,
        instagram: instagram.trim() || undefined,
        message: message.trim(),
        subject: `Fundador — ${tradeName.trim()}`,
      });
      setStatus('success');
      setTradeName('');
      setCity('');
      setName('');
      setEmail('');
      setWhatsapp('');
      setInstagram('');
      setMessage('');
      setAgree(false);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Não foi possível enviar. Tente de novo.');
    }
  }

  return (
    <main className="fundador">
      <div className="fundador__glow fundador__glow--a" aria-hidden />
      <div className="fundador__glow fundador__glow--b" aria-hidden />

      <div className="container">
        <Link to="/" className="page-form__back">
          ← Voltar ao início
        </Link>

        <section className="fundador__hero reveal">
          <p className="eyebrow eyebrow--line">Programa fundador</p>
          <h1 className="fundador__title">Entre nas primeiras 30 a 50 charutarias.</h1>
          <p className="fundador__lead">
            Preço travado em torno de R$&nbsp;39,90/mês por contrato — sem trial. A troca não é só
            dinheiro: é divulgação real na loja e nas redes.
          </p>
          <div className="fundador__meter" aria-label="Vagas limitadas">
            <span>Vagas limitadas · primeiras 30–50 lojas</span>
            <div className="fundador__bar" role="presentation">
              <i style={{ width: '18%' }} />
            </div>
          </div>
        </section>

        <ol className="fundador__steps reveal reveal-delay-1">
          {STEPS.map((step, i) => (
            <li key={step.n}>
              <span className="fundador__step-n">{step.n}</span>
              <span>{step.label}</span>
              {i < STEPS.length - 1 && <span className="fundador__step-arrow" aria-hidden>→</span>}
            </li>
          ))}
        </ol>

        <div className="fundador__grid">
          <aside className="fundador__aside reveal reveal-delay-1">
            <p className="fundador__aside-label">O que você leva</p>
            <ul className="fundador__benefits">
              {BENEFITS.map((b) => (
                <li key={b.title}>
                  <strong>{b.title}</strong>
                  <p>{b.body}</p>
                </li>
              ))}
            </ul>

            <p className="fundador__aside-label">Compromissos de divulgação</p>
            <ul className="fundador__commits">
              {COMMITMENTS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </aside>

          <div className="fundador__form-wrap reveal reveal-delay-2">
            {status === 'success' ? (
              <div className="page-form__banner page-form__banner--ok" role="status">
                <strong>Candidatura enviada.</strong>
                <p>
                  Recebemos os dados da loja. Em breve a equipe entra em contato no e-mail
                  informado.
                </p>
                <div className="page-form__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStatus('idle')}>
                    Enviar outra candidatura
                  </button>
                  <Link className="btn btn-primary" to="/">
                    Voltar ao site
                  </Link>
                </div>
              </div>
            ) : (
              <form className="page-form__card fundador__card" onSubmit={onSubmit} noValidate>
                <header className="fundador__form-head">
                  <h2>Candidatar minha loja</h2>
                  <p>Preencha os dados — analisamos cada perfil antes de fechar contrato.</p>
                </header>

                <fieldset className="fundador__fieldset">
                  <legend>01 — A loja</legend>
                  <div className="page-form__row">
                    <label className="field">
                      <span>Nome fantasia *</span>
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        placeholder="Ex.: Casa do Charuto"
                      />
                    </label>
                    <label className="field">
                      <span>Cidade *</span>
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Cidade / UF"
                      />
                    </label>
                  </div>
                  <div className="page-form__row">
                    <label className="field">
                      <span>WhatsApp</span>
                      <input
                        maxLength={40}
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="(11) 90000-0000"
                      />
                    </label>
                    <label className="field">
                      <span>Instagram</span>
                      <input
                        maxLength={80}
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="@sualoja"
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="fundador__fieldset">
                  <legend>02 — Responsável</legend>
                  <div className="page-form__row">
                    <label className="field">
                      <span>Nome *</span>
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Quem responde pela loja"
                        autoComplete="name"
                      />
                    </label>
                    <label className="field">
                      <span>E-mail *</span>
                      <input
                        type="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contato@loja.com"
                        autoComplete="email"
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="fundador__fieldset">
                  <legend>03 — Motivação</legend>
                  <label className="field">
                    <span>Por que quer ser fundador? *</span>
                    <textarea
                      required
                      minLength={20}
                      maxLength={5000}
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Conte um pouco da loja e do interesse no programa (mín. 20 caracteres)."
                    />
                  </label>
                </fieldset>

                <label className="fundador__check">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    Li e aceito o preço fundador (~R$&nbsp;39,90/mês travado em contrato), sem trial,
                    e a contrapartida de divulgação (QR, Instagram e indicação na venda). Concordo
                    com os{' '}
                    <a href="/legal/termos.html" target="_blank" rel="noreferrer">
                      Termos
                    </a>{' '}
                    e a{' '}
                    <a href="/legal/privacidade.html" target="_blank" rel="noreferrer">
                      Privacidade
                    </a>
                    .
                  </span>
                </label>

                {status === 'error' && (
                  <p className="page-form__banner page-form__banner--err" role="alert">
                    {error}
                  </p>
                )}

                <div className="page-form__actions">
                  <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Enviando…' : 'Enviar candidatura'}
                  </button>
                  <Link className="btn btn-ghost" to="/contato">
                    Falar com a equipe
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
