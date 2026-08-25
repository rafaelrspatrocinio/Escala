import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      navigate(user.role === 'ADMIN' ? '/admin/escala' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao entrar');
    }
  }

  return (
    <div className="login-box card">
      <h1>Escala de Voluntários</h1>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button className="btn" style={{ marginTop: 16, width: '100%' }} type="submit">
          Entrar
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Ainda não tem conta? <Link to="/registrar">Cadastre-se como voluntário</Link>
      </p>
    </div>
  );
}
