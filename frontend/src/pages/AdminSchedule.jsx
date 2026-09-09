import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import api from '../api/client';

const statusLabel = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', DECLINED: 'Recusado' };
const statusClass = { PENDING: 'pending', CONFIRMED: 'confirmed', DECLINED: 'declined' };

export default function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const exportRefs = useRef({});

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

  async function exportImage(ev) {
    const node = exportRefs.current[ev.id];
    if (!node) return;
    setExportingId(ev.id);
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const dataUrl = canvas.toDataURL('image/png');
      const dateStr = new Date(ev.date).toLocaleDateString('pt-BR').replace(/\//g, '-');
      const safeName = ev.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `escala-${safeName}-${dateStr}.png`;
      link.click();
    } catch (err) {
      setMessage('Erro ao gerar imagem da escala.');
    } finally {
      setExportingId(null);
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
              <div className="row">
                <button className="btn secondary" onClick={() => generateForEvent(ev.id)}>
                  Gerar/completar escala deste evento
                </button>
                <button
                  className="btn secondary"
                  disabled={eventSlots.length === 0 || exportingId === ev.id}
                  onClick={() => exportImage(ev)}
                >
                  {exportingId === ev.id ? 'Gerando imagem...' : 'Exportar imagem'}
                </button>
              </div>
            </div>
            <div className="table-wrap">
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

            <div
              ref={(node) => {
                exportRefs.current[ev.id] = node;
              }}
              style={{
                position: 'fixed',
                top: 0,
                left: '-9999px',
                width: 480,
                background: '#ffffff',
                padding: 24,
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                color: '#1f2933',
              }}
            >
              <div style={{ background: '#1a1a1a', color: '#ffffff', padding: '14px 18px', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{ev.name}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{new Date(ev.date).toLocaleString('pt-BR')}</div>
              </div>
              {eventSlots.map((slot) => (
                <div
                  key={slot.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #e4e7eb',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{slot.ministry.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{slot.user?.name || '—'}</div>
                  </div>
                  <span
                    style={{
                      padding: '3px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        slot.status === 'CONFIRMED' ? '#d1fae5' : slot.status === 'DECLINED' ? '#fee2e2' : '#fef3c7',
                      color:
                        slot.status === 'CONFIRMED' ? '#065f46' : slot.status === 'DECLINED' ? '#991b1b' : '#92400e',
                    }}
                  >
                    {statusLabel[slot.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
