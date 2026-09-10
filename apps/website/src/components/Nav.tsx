import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Nav.css';

const SECTION_LINKS = [
  { href: '/#recursos', label: 'Recursos' },
  { href: '/#planos', label: 'Planos' },
  { href: '/#parceiros', label: 'Parceiros' },
  { href: '/#duvidas', label: 'Dúvidas' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="container nav__inner">
        <Link to="/" className="nav__brand" onClick={() => setOpen(false)}>
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>Vitola Hub</span>
        </Link>

        <nav className={`nav__links ${open ? 'nav__links--open' : ''}`} aria-label="Principal">
          {SECTION_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link to="/fundador" onClick={() => setOpen(false)}>
            Fundador
          </Link>
          <Link to="/contato" onClick={() => setOpen(false)}>
            Contato
          </Link>
          <a className="btn btn-primary nav__cta" href="/#baixar" onClick={() => setOpen(false)}>
            Baixar o app
          </a>
        </nav>

        <button
          className="nav__menu"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
