import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links =
    user.role === 'ADMIN' ? (
      <>
        <NavLink to="/admin/escala" onClick={() => setOpen(false)}>Escala</NavLink>
        <NavLink to="/admin/eventos" onClick={() => setOpen(false)}>Eventos</NavLink>
        <NavLink to="/admin/voluntarios" onClick={() => setOpen(false)}>Voluntários</NavLink>
        <NavLink to="/admin/ministerios" onClick={() => setOpen(false)}>Ministérios</NavLink>
      </>
    ) : (
      <>
        <NavLink to="/" onClick={() => setOpen(false)}>Minha Escala</NavLink>
        <NavLink to="/indisponibilidade" onClick={() => setOpen(false)}>Indisponibilidade</NavLink>
      </>
    );

  return (
    <div className="navbar">
      <div className="navbar-top">
        <span className="navbar-brand">Escala</span>
        <button
          className="navbar-toggle"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="navbar-right">
          <span style={{ marginRight: 12 }}>{user.name}</span>
          <button className="btn secondary" onClick={logout}>
            Sair
          </button>
        </div>
      </div>
      <div className={`links ${open ? 'open' : ''}`}>{links}</div>
    </div>
  );
}
