import { Link } from 'react-router-dom';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <img src="/logo.png" alt="Vitola Hub" width={40} height={40} />
          <div>
            <strong>Vitola Hub</strong>
            <p>Compartilhe · Deguste · Descubra</p>
          </div>
        </div>

        <div className="footer__cols">
          <div>
            <h4>Produto</h4>
            <a href="/#recursos">Recursos</a>
            <a href="/#planos">Planos</a>
            <a href="/#parceiros">Parceiros</a>
            <Link to="/fundador">Fundador</Link>
            <a href="/#duvidas">Dúvidas</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="/legal/privacidade.html">Privacidade</a>
            <a href="/legal/termos.html">Termos</a>
          </div>
          <div>
            <h4>Contato</h4>
            <Link to="/contato">Falar com a equipe</Link>
            <a href="mailto:vitolahub@gmail.com">vitolahub@gmail.com</a>
          </div>
        </div>
      </div>
      <div className="container footer__bottom">
        <p>© {new Date().getFullYear()} Vitola Hub. Projeto independente.</p>
        <p>Conteúdo destinado a maiores de idade legal para tabaco.</p>
      </div>
    </footer>
  );
}
