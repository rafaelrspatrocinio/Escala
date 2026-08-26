import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminMinistries() {
  const [ministries, setMinistries] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/ministries').then((res) => setMinistries(res.data));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/ministries', { name });
      setName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar ministério');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este ministério?')) return;
    await api.delete(`/ministries/${id}`);
    load();
  }

  return (
    <div>
      <h1>Ministérios</h1>
      <div className="card">
        <form className="row" onSubmit={handleAdd}>
          <div style={{ flex: 1 }}>
            <label>Novo ministério</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Louvor" required />
          </div>
          <button className="btn" type="submit">
            Adicionar
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ministries.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>
                  <button className="btn danger" onClick={() => handleDelete(m.id)}>
                    Remover
                  </button>
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
