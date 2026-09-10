import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../state/auth-store';

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/conversas', label: 'Conversas' },
  { to: '/avaliacoes', label: 'Avaliações' },
  { to: '/perfil', label: 'Perfil da loja' },
  { to: '/assinatura', label: 'Assinatura' },
];

// Casca do painel: barra lateral fixa + área de conteúdo. Layout de
// desktop/tablet — não precisa se adaptar a telas de celular como o app
// mobile precisa.
export function Layout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);

  function handleLogout() {
    clear();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-divider)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ padding: '0 8px', marginBottom: 32 }}>
          <h1 style={{ fontSize: 20 }}>Vitola Hub</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 12, marginTop: 4 }}>
            Painel da charutaria
          </p>
        </div>

        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'block',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              color: isActive ? 'var(--color-background)' : 'var(--color-text-secondary)',
              background: isActive ? 'var(--color-gold)' : 'transparent',
            })}
          >
            {item.label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <button className="btn btn-secondary" onClick={handleLogout}>
          Sair
        </button>
      </aside>

      <main style={{ flex: 1, padding: 32, maxWidth: 1200 }}>
        <Outlet />
      </main>
    </div>
  );
}
