import { useEffect, useState } from 'react';
import api from '../api/client';

export default function VolunteerUnavailability() {
  const [items, setItems] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/unavailability').then((res) => setItems(res.data));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/unavailability', { date, reason });
      setDate('');
      setReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar');
    }
  }

  async function remove(id) {
    await api.delete(`/unavailability/${id}`);
    load();
  }

  return (
    <div>
      <h1>Minha Indisponibilidade</h1>
      <div className="card">
        <p>Marque os dias em que você não poderá servir. Você não será escalado nessas datas.</p>
        <form className="row" onSubmit={handleAdd}>
          <div>
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label>Motivo (opcional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Viagem, saúde..." />
          </div>
          <button className="btn" type="submit">
            Adicionar
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                <td>{item.reason || '-'}</td>
                <td>
                  <button className="btn danger" onClick={() => remove(item.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
