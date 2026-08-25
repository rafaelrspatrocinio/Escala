import { useEffect, useState } from 'react';
import api from '../api/client';

const statusLabel = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', DECLINED: 'Recusado' };
const statusClass = { PENDING: 'pending', CONFIRMED: 'confirmed', DECLINED: 'declined' };

export default function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');

  function load() {
    api.get('/events').then((res) => setEvents(res.data));
    api.get('/schedule').then((res) => setSlots(res.data));
    api.get('/users').then((res) => setUsers(res.data));
  }

  useEffect(load, []);

  async function generateForEvent(eventId) {
    setMessage('Gerando escala...');
    try {
      const res = await api.post(`/schedule/generate/${eventId}`);
      setMessage(`${res.data.created} escala(s) gerada(s) e voluntários notificados.`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao gerar escala');
    }
  }

  async function generateUpcoming() {
    setMessage('Gerando escalas dos próximos 30 dias...');
    const res = await api.post('/schedule/generate-upcoming', { daysAhead: 30 });
    const total = res.data.results.reduce((sum, r) => sum + r.created, 0);
    setMessage(`Escalas geradas para ${res.data.results.length} evento(s), ${total} atribuições novas.`);
    load();
  }

  async function updateStatus(slotId, status) {
    await api.put(`/schedule/${slotId}`, { status });
    load();
  }

  async function reassign(slotId, userId) {
    await api.put(`/schedule/${slotId}`, { userId });
    load();
  }

  async function removeSlot(slotId) {
    if (!confirm('Remover esta atribuição?')) return;
    await api.delete(`/schedule/${slotId}`);
    load();
  }

  async function resendNotification(slotId) {
    setMessage('Reenviando notificação...');
    try {
      const res = await api.post(`/schedule/${slotId}/notify`);
      setMessage(res.data.notified ? 'Voluntário notificado com sucesso.' : `Não foi possível notificar: ${res.data.notificationError || 'erro desconhecido'}`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao reenviar notificação');
    }
  }

  return (
    <div>
      <h1>Escala</h1>
      <div className="card">
        <div className="row">
          <button className="btn" onClick={generateUpcoming}>
            Gerar escala automática (próximos 30 dias)
          </button>
        </div>
        {message && <p style={{ marginTop: 10 }}>{message}</p>}
      </div>

      {events.map((ev) => {
        const eventSlots = slots.filter((s) => s.eventId === ev.id);
        return (
          <div className="card" key={ev.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{ev.name}</h3>
                <p>{new Date(ev.date).toLocaleString('pt-BR')}</p>
              </div>
              <button className="btn secondary" onClick={() => generateForEvent(ev.id)}>
                Gerar/completar escala deste evento
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ministério</th>
                  <th>Voluntário</th>
                  <th>Status</th>
                  <th>Notificado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {eventSlots.length === 0 && (
                  <tr>
                    <td colSpan={5}>Nenhuma escala gerada ainda.</td>
                  </tr>
                )}
                {eventSlots.map((slot) => {
                  const eligible = users.filter((u) =>
                    u.ministries.some((m) => m.id === slot.ministryId)
                  );
                  return (
                    <tr key={slot.id}>
                      <td>{slot.ministry.name}</td>
                      <td>
                        <select value={slot.userId} onChange={(e) => reassign(slot.id, Number(e.target.value))}>
                          {eligible.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${statusClass[slot.status]}`}>{statusLabel[slot.status]}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${slot.notified ? 'confirmed' : 'declined'}`}
                          title={
                            slot.notified
                              ? `Notificado em ${new Date(slot.notifiedAt).toLocaleString('pt-BR')}`
                              : slot.notificationError || 'Ainda não notificado'
                          }
                        >
                          {slot.notified ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td>
                        <button className="btn secondary" onClick={() => updateStatus(slot.id, 'CONFIRMED')}>
                          Confirmar
                        </button>{' '}
                        <button className="btn secondary" onClick={() => updateStatus(slot.id, 'DECLINED')}>
                          Recusar
                        </button>{' '}
                        <button className="btn secondary" onClick={() => resendNotification(slot.id)}>
                          Reenviar notificação
                        </button>{' '}
                        <button className="btn danger" onClick={() => removeSlot(slot.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
