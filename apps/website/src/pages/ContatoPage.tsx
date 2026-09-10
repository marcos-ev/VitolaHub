import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContact } from '../lib/contactApi';
import './ContatoPage.css';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function ContatoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await submitContact({
        type: 'contact',
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setStatus('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Não foi possível enviar. Tente de novo.');
    }
  }

  return (
    <main className="page-form">
      <div className="page-form__glow" aria-hidden />
      <div className="container page-form__inner">
        <Link to="/" className="page-form__back">
          ← Voltar ao início
        </Link>

        <header className="page-form__header reveal">
          <p className="eyebrow eyebrow--line">Contato</p>
          <h1 className="section-title">Fale com a equipe</h1>
          <p className="section-lead">
            Dúvidas sobre o app, parcerias ou suporte — mande uma mensagem. Respondemos pelo e-mail
            que você informar.
          </p>
        </header>

        {status === 'success' ? (
          <div className="page-form__banner page-form__banner--ok reveal" role="status">
            <strong>Mensagem enviada.</strong>
            <p>Obrigado — recebemos seu contato e retornamos em breve.</p>
            <button type="button" className="btn btn-ghost" onClick={() => setStatus('idle')}>
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form className="page-form__card reveal reveal-delay-1" onSubmit={onSubmit} noValidate>
            <div className="page-form__row">
              <label className="field">
                <span>Nome *</span>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label className="field">
                <span>E-mail *</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </label>
            </div>

            <label className="field">
              <span>Assunto</span>
              <input
                name="subject"
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Opcional"
              />
            </label>

            <label className="field">
              <span>Mensagem *</span>
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={5000}
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Como podemos ajudar?"
              />
            </label>

            {status === 'error' && (
              <p className="page-form__banner page-form__banner--err" role="alert">
                {error}
              </p>
            )}

            <div className="page-form__actions">
              <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Enviando…' : 'Enviar mensagem'}
              </button>
              <Link className="btn btn-ghost" to="/fundador">
                Quero ser fundador
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
