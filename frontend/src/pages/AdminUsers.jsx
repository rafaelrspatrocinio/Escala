import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';
import { formatBrazilPhone } from '../utils/phone';

function emptyForm() {
  return { name: '', email: '', phone: '', password: '', ministryIds: [] };
}

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [availabilityModal, setAvailabilityModal] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [blockDates, setBlockDates] = useState([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockEndDate, setNewBlockEndDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [savingBlockDate, setSavingBlockDate] = useState(false);

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

  function openAvailability(user) {
    setAvailabilityError('');
    setNewBlockDate('');
    setNewBlockEndDate('');
    setNewBlockReason('');
    setAvailabilityModal({
      userId: user.id,
      name: user.name,
      days: user.availableWeekdays?.length ? [...user.availableWeekdays] : [0, 1, 2, 3, 4, 5, 6],
    });
    api.get('/unavailability', { params: { userId: user.id } }).then((res) => setBlockDates(res.data));
  }

  function toggleAvailabilityDay(day) {
    setAvailabilityModal((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  }

  async function saveAvailability() {
    setAvailabilityError('');
    setSavingAvailability(true);
    try {
      await api.put(`/users/${availabilityModal.userId}`, { availableWeekdays: availabilityModal.days });
      setAvailabilityModal(null);
      load();
    } catch (err) {
      setAvailabilityError(err.response?.data?.error || 'Erro ao salvar disponibilidade');
    } finally {
      setSavingAvailability(false);
    }
  }

  async function addBlockDate(e) {
    e.preventDefault();
    if (!newBlockDate) return;
    setAvailabilityError('');
    setSavingBlockDate(true);
    try {
      await api.post('/unavailability', {
        userId: availabilityModal.userId,
        date: newBlockDate,
        endDate: newBlockEndDate || undefined,
        reason: newBlockReason,
      });
      setNewBlockDate('');
      setNewBlockEndDate('');
      setNewBlockReason('');
      const res = await api.get('/unavailability', { params: { userId: availabilityModal.userId } });
      setBlockDates(res.data);
    } catch (err) {
      setAvailabilityError(err.response?.data?.error || 'Erro ao bloquear data');
    } finally {
      setSavingBlockDate(false);
    }
  }

  async function removeBlockDate(id) {
    await api.delete(`/unavailability/${id}`);
    setBlockDates((prev) => prev.filter((b) => b.id !== id));
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
              <th>Ministérios</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
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
                        <button className="btn secondary" onClick={() => openAvailability(u)}>
                          Disponibilidade
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
                {editing?.id === u.id && (
                  <tr>
                    <td colSpan={4} style={{ whiteSpace: 'normal', background: 'var(--color-bg)' }}>
                      <div className="grid-2">
                        <div>
                          <label>Email</label>
                          <input
                            type="email"
                            value={editing.email}
                            onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                          />
                        </div>
                        <div>
                          <label>Telefone</label>
                          <input
                            value={editing.phone}
                            onChange={(e) => setEditing({ ...editing, phone: e.target.value.replace(/\D/g, '') })}
                            onBlur={(e) => setEditing({ ...editing, phone: formatBrazilPhone(e.target.value) })}
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                      <div className="grid-2">
                        <div>
                          <label>Nova senha (opcional)</label>
                          <input
                            type="password"
                            value={editing.password}
                            onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                          />
                        </div>
                        <div>
                          <label>Função</label>
                          <select
                            value={editing.role}
                            onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                          >
                            <option value="VOLUNTEER">Voluntário</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {availabilityModal && (
        <div className="modal-overlay" onClick={() => setAvailabilityModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Disponibilidade de {availabilityModal.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: -4 }}>
              Marque os dias da semana em que este voluntário pode ser escalado.
            </p>
            <div>
              {WEEKDAYS.map((day) => (
                <label
                  key={day.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={availabilityModal.days.includes(day.value)}
                    onChange={() => toggleAvailabilityDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={saveAvailability} disabled={savingAvailability}>
                {savingAvailability ? 'Salvando...' : 'Salvar dias da semana'}
              </button>
            </div>
            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />
            <h3>Bloquear datas específicas</h3>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: -4 }}>
              Este voluntário não será escalado nas datas abaixo (ex.: viagem, compromisso pontual).
            </p>
            <form onSubmit={addBlockDate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label>Data inicial</label>
                <input type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} required />
              </div>
              <div>
                <label>Data final (opcional)</label>
                <input
                  type="date"
                  value={newBlockEndDate}
                  onChange={(e) => setNewBlockEndDate(e.target.value)}
                  min={newBlockDate || undefined}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label>Motivo (opcional)</label>
                <input value={newBlockReason} onChange={(e) => setNewBlockReason(e.target.value)} />
              </div>
              <button className="btn secondary" type="submit" disabled={savingBlockDate}>
                {savingBlockDate ? 'Adicionando...' : 'Adicionar'}
              </button>
            </form>
            <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none' }}>
              {blockDates.length === 0 && (
                <li style={{ fontSize: 13, color: 'var(--color-secondary)' }}>Nenhuma data bloqueada.</li>
              )}
              {blockDates.map((b) => (
                <li
                  key={b.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}
                >
                  <span>
                    {new Date(b.date).toLocaleDateString('pt-BR')}
                    {b.endDate ? ` até ${new Date(b.endDate).toLocaleDateString('pt-BR')}` : ''}
                    {b.reason ? ` — ${b.reason}` : ''}
                  </span>
                  <button className="btn danger" onClick={() => removeBlockDate(b.id)} type="button">
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            {availabilityError && <div className="error">{availabilityError}</div>}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setAvailabilityModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
