import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatBrazilPhone } from '../utils/phone';

function emptyForm() {
  return { name: '', email: '', phone: '', password: '', ministryIds: [] };
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

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
      await api.post('/users', { ...form, phone: formatBrazilPhone(form.phone) });
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar voluntário');
    }
  }

  function startEdit(user) {
    setError('');
    setEditing({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: '',
      role: user.role,
      active: user.active,
      ministryIds: user.ministries.map((m) => m.id),
    });
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
    setError('');
    try {
      const payload = {
        name: editing.name,
        email: editing.email,
        phone: formatBrazilPhone(editing.phone),
        role: editing.role,
        active: editing.active,
        ministryIds: editing.ministryIds,
      };
      if (editing.password) payload.password = editing.password;
      await api.put(`/users/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar usuário');
    }
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

  async function exportUsers() {
    const res = await api.get('/users/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voluntarios.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importUsers(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError('');
    setImportSummary(null);
    setImporting(true);
    try {
      const text = await file.text();
      const res = await api.post('/users/import', { csv: text });
      setImportSummary(res.data);
      load();
    } catch (err) {
      setImportError(err.response?.data?.error || 'Erro ao importar CSV');
    } finally {
      setImporting(false);
    }
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
              <label>Telefone (WhatsApp, com DDD, ex: 21968030112)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                onBlur={(e) => setForm({ ...form, phone: formatBrazilPhone(e.target.value) })}
                inputMode="numeric"
                required
              />
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
        <h3>Exportar / Importar voluntários</h3>
        <div className="row">
          <button className="btn secondary" onClick={exportUsers} type="button">
            Exportar CSV
          </button>
          <label className="btn secondary" style={{ margin: 0, cursor: 'pointer' }}>
            {importing ? 'Importando...' : 'Importar CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={importUsers}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 8 }}>
          O CSV importado usa o email para identificar cada voluntário: se já existir, atualiza os dados; se não
          existir, cria um novo com a senha provisória <strong>mudar123</strong>. Colunas esperadas: name, email,
          phone, role, active, ministries (múltiplos ministérios separados por "|").
        </p>
        {importError && <div className="error" style={{ marginTop: 8 }}>{importError}</div>}
        {importSummary && (
          <div className={importSummary.errors?.length ? 'error' : ''} style={{ marginTop: 8, fontSize: 13 }}>
            Importação concluída: {importSummary.created} criado(s), {importSummary.updated} atualizado(s).
            {importSummary.errors?.length > 0 && (
              <ul>
                {importSummary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {error && editing && <div className="error">{error}</div>}
      <div className="card">
        <div className="table-wrap">
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
                <td style={editing?.id === u.id ? { whiteSpace: 'normal', minWidth: 160 } : undefined}>
                  {editing?.id === u.id ? (
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  ) : (
                    u.name
                  )}
                </td>
                <td style={editing?.id === u.id ? { whiteSpace: 'normal', minWidth: 220 } : undefined}>
                  {editing?.id === u.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="email"
                        value={editing.email}
                        onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                      />
                      <input
                        value={editing.phone}
                        onChange={(e) => setEditing({ ...editing, phone: e.target.value.replace(/\D/g, '') })}
                        onBlur={(e) => setEditing({ ...editing, phone: formatBrazilPhone(e.target.value) })}
                        inputMode="numeric"
                      />
                      <input
                        type="password"
                        placeholder="Nova senha (opcional)"
                        value={editing.password}
                        onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                      />
                    </div>
                  ) : (
                    <>
                      {u.email}
                      <br />
                      {u.phone}
                    </>
                  )}
                </td>
                <td style={editing?.id === u.id ? { whiteSpace: 'normal', minWidth: 130 } : undefined}>
                  {editing?.id === u.id ? (
                    <select
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    >
                      <option value="VOLUNTEER">Voluntário</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : u.role === 'ADMIN' ? (
                    'Admin'
                  ) : (
                    'Voluntário'
                  )}
                </td>
                <td style={editing?.id === u.id ? { whiteSpace: 'normal', minWidth: 160 } : undefined}>
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
                <td style={editing?.id === u.id ? { whiteSpace: 'normal' } : undefined}>
                  {editing?.id === u.id ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={editing.active}
                        onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                      />
                      Ativo
                    </label>
                  ) : u.active ? (
                    'Ativo'
                  ) : (
                    'Inativo'
                  )}
                </td>
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
                        Editar
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
    </div>
  );
}
