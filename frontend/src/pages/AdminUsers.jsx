import { useEffect, useState } from 'react';
import api from '../api/client';

function emptyForm() {
  return { name: '', email: '', phone: '', password: '', ministryIds: [] };
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  function load() {
    api.get('/users').then((res) => setUsers(res.data));
    api.get('/ministries').then((res) => setMinistries(res.data));
  }

  useEffect(load, []);

  function toggleFormMinistry(id) {
    setForm((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((m) => m !== id)
        : [...prev.ministryIds, id],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar voluntário');
    }
  }

  function startEdit(user) {
    setEditing({ id: user.id, ministryIds: user.ministries.map((m) => m.id), active: user.active });
  }

  function toggleMinistry(id) {
    setEditing((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((m) => m !== id)
        : [...prev.ministryIds, id],
    }));
  }

  async function saveEdit() {
    await api.put(`/users/${editing.id}`, { ministryIds: editing.ministryIds, active: editing.active });
    setEditing(null);
    load();
  }

  async function toggleActive(user) {
    await api.put(`/users/${user.id}`, { active: !user.active });
    load();
  }

  async function removeUser(user) {
    if (!confirm(`Remover ${user.name}?`)) return;
    await api.delete(`/users/${user.id}`);
    load();
  }

  return (
    <div>
      <h1>Voluntários</h1>
      <div className="card">
        <form onSubmit={handleCreate}>
          <div className="grid-2">
            <div>
              <label>Nome completo</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label>Telefone (WhatsApp, com DDD e país, ex: 5511999999999)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <label>Senha provisória</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>
          <label>Ministérios</label>
          <div>
            {ministries.map((m) => (
              <label
                key={m.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12, fontWeight: 400 }}
              >
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={form.ministryIds.includes(m.id)}
                  onChange={() => toggleFormMinistry(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          <div>
            <button className="btn" style={{ marginTop: 16 }} type="submit">
              Cadastrar voluntário
            </button>
          </div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Função</th>
              <th>Ministérios</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>
                  {u.email}
                  <br />
                  {u.phone}
                </td>
                <td>{u.role === 'ADMIN' ? 'Admin' : 'Voluntário'}</td>
                <td>
                  {editing?.id === u.id ? (
                    <div>
                      {ministries.map((m) => (
                        <label key={m.id} style={{ display: 'block', fontWeight: 400 }}>
                          <input
                            type="checkbox"
                            style={{ width: 'auto', marginRight: 6 }}
                            checked={editing.ministryIds.includes(m.id)}
                            onChange={() => toggleMinistry(m.id)}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    u.ministries.map((m) => <span className="chip" key={m.id}>{m.name}</span>)
                  )}
                </td>
                <td>{u.active ? 'Ativo' : 'Inativo'}</td>
                <td>
                  {editing?.id === u.id ? (
                    <>
                      <button className="btn" onClick={saveEdit}>
                        Salvar
                      </button>{' '}
                      <button className="btn secondary" onClick={() => setEditing(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn secondary" onClick={() => startEdit(u)}>
                        Editar ministérios
                      </button>{' '}
                      <button className="btn secondary" onClick={() => toggleActive(u)}>
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>{' '}
                      <button className="btn danger" onClick={() => removeUser(u)}>
                        Remover
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
