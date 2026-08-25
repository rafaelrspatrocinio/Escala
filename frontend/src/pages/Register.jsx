import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [ministries, setMinistries] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [selectedMinistries, setSelectedMinistries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/ministries').then((res) => setMinistries(res.data));
  }, []);

  function toggleMinistry(id) {
    setSelectedMinistries((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', { ...form, ministryIds: selectedMinistries });
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar');
    }
  }

  return (
    <div className="login-box card">
      <h1>Cadastro de Voluntário</h1>
      <form onSubmit={handleSubmit}>
        <label>Nome completo</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <label>Telefone (WhatsApp, com DDD e país, ex: 5511999999999)</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <label>Senha</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <label>Ministérios que deseja servir</label>
        <div>
          {ministries.map((m) => (
            <label key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12, fontWeight: 400 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selectedMinistries.includes(m.id)}
                onChange={() => toggleMinistry(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn" style={{ marginTop: 16, width: '100%' }} type="submit">
          Cadastrar
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
