import { useEffect, useState } from 'react';
import api from '../api/client';

function emptyNeed() {
  return { ministryId: '', slotsCount: 1 };
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [needs, setNeeds] = useState([emptyNeed()]);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [error, setError] = useState('');

  function load() {
    api.get('/events').then((res) => setEvents(res.data));
    api.get('/ministries').then((res) => setMinistries(res.data));
  }

  useEffect(load, []);

  function updateNeed(index, field, value) {
    setNeeds((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
  }

  function addNeedRow() {
    setNeeds((prev) => [...prev, emptyNeed()]);
  }

  function removeNeedRow(index) {
    setNeeds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const validNeeds = needs.filter((n) => n.ministryId);
    try {
      await api.post('/events', {
        name,
        date,
        needs: validNeeds.map((n) => ({ ministryId: n.ministryId, slotsCount: n.slotsCount })),
        repeatWeeks: repeatWeekly ? Number(repeatWeeks) : 1,
      });
      setName('');
      setDate('');
      setNeeds([emptyNeed()]);
      setRepeatWeekly(false);
      setRepeatWeeks(4);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar evento');
    }
  }

  async function removeEvent(id) {
    if (!confirm('Remover este evento e sua escala?')) return;
    await api.delete(`/events/${id}`);
    load();
  }

  async function duplicateEvent(ev) {
    setError('');
    try {
      await api.post(`/events/${ev.id}/duplicate`, { daysOffset: 7 });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao duplicar evento');
    }
  }

  return (
    <div>
      <h1>Eventos / Cultos</h1>
      <div className="card">
        <form onSubmit={handleCreate}>
          <div className="grid-2">
            <div>
              <label>Nome do evento</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Culto de Domingo" required />
            </div>
            <div>
              <label>Data e hora</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <label>Necessidades por ministério</label>
          {needs.map((n, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <select value={n.ministryId} onChange={(e) => updateNeed(i, 'ministryId', e.target.value)}>
                <option value="">Selecione o ministério</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                style={{ width: 80 }}
                value={n.slotsCount}
                onChange={(e) => updateNeed(i, 'slotsCount', e.target.value)}
              />
              <button type="button" className="btn secondary" onClick={() => removeNeedRow(i)}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={addNeedRow}>
            + Adicionar ministério
          </button>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={repeatWeekly}
                onChange={(e) => setRepeatWeekly(e.target.checked)}
              />
              Repetir semanalmente (mesmo dia/horário, toda semana)
            </label>
            {repeatWeekly && (
              <div style={{ marginTop: 8, maxWidth: 220 }}>
                <label>Quantidade de semanas</label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={repeatWeeks}
                  onChange={(e) => setRepeatWeeks(e.target.value)}
                />
              </div>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          <div>
            <button className="btn" style={{ marginTop: 16 }} type="submit">
              Criar evento
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Data</th>
              <th>Necessidades</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.name}</td>
                <td>{new Date(ev.date).toLocaleString('pt-BR')}</td>
                <td>
                  {ev.needs.map((n) => (
                    <span className="chip" key={n.id}>
                      {n.ministry.name} x{n.slotsCount}
                    </span>
                  ))}
                </td>
                <td>
                  <button className="btn secondary" onClick={() => duplicateEvent(ev)}>
                    Duplicar (+7 dias)
                  </button>{' '}
                  <button className="btn danger" onClick={() => removeEvent(ev.id)}>
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
