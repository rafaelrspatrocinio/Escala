import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="navbar">
      <div className="links">
        {user.role === 'ADMIN' ? (
          <>
            <NavLink to="/admin/escala">Escala</NavLink>
            <NavLink to="/admin/eventos">Eventos</NavLink>
            <NavLink to="/admin/voluntarios">Voluntários</NavLink>
            <NavLink to="/admin/ministerios">Ministérios</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/">Minha Escala</NavLink>
            <NavLink to="/indisponibilidade">Indisponibilidade</NavLink>
          </>
        )}
      </div>
      <div>
        <span style={{ marginRight: 12 }}>{user.name}</span>
        <button className="btn secondary" onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  );
}
