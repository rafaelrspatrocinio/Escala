import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import api from '../api/client';
import { formatEventDateTime, formatEventDate } from '../utils/datetime';

const statusLabel = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', DECLINED: 'Recusado' };
const statusClass = { PENDING: 'pending', CONFIRMED: 'confirmed', DECLINED: 'declined' };

function emptyNeed() {
  return { ministryId: '', slotsCount: 1 };
}

function toLocalDatetimeInput(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const MINISTRY_PRIORITY = ['iluminação', 'projeção'];

function ministryRank(name) {
  const normalized = (name || '').trim().toLowerCase();
  const idx = MINISTRY_PRIORITY.indexOf(normalized);
  return idx === -1 ? MINISTRY_PRIORITY.length : idx;
}

function sortByMinistry(slotList) {
  return [...slotList].sort((a, b) => {
    const rankDiff = ministryRank(a.ministry.name) - ministryRank(b.ministry.name);
    if (rankDiff !== 0) return rankDiff;
    return a.ministry.name.localeCompare(b.ministry.name, 'pt-BR');
  });
}

function dateOnlyUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isWithinUnavailability(unavailability, eventDate) {
  const start = dateOnlyUTC(new Date(unavailability.date));
  const end = unavailability.endDate ? dateOnlyUTC(new Date(unavailability.endDate)) : start;
  const day = dateOnlyUTC(new Date(eventDate));
  return day >= start && day <= end;
}

function isUserAvailableForEvent(user, eventDate) {
  const weekday = new Date(eventDate).getUTCDay();
  if (!(user.availableWeekdays ?? []).includes(weekday)) return false;
  if ((user.unavailability ?? []).some((u) => isWithinUnavailability(u, eventDate))) return false;
  return true;
}

export default function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [message, setMessage] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const exportRefs = useRef({});
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekLayout, setWeekLayout] = useState('vertical');
  const [exportingWeek, setExportingWeek] = useState(false);
  const weekExportRef = useRef(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editError, setEditError] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  function load() {
    api.get('/events').then((res) => setEvents(res.data));
    api.get('/schedule').then((res) => setSlots(res.data));
    api.get('/users').then((res) => setUsers(res.data));
    api.get('/ministries').then((res) => setMinistries(res.data));
  }

  useEffect(load, []);

  function startEditEvent(ev) {
    setEditError('');
    setEditingEvent({
      id: ev.id,
      name: ev.name,
      date: toLocalDatetimeInput(ev.date),
      needs: ev.needs?.length
        ? ev.needs.map((n) => ({ ministryId: String(n.ministryId), slotsCount: n.slotsCount }))
        : [emptyNeed()],
    });
  }

  function updateEditNeed(index, field, value) {
    setEditingEvent((prev) => ({
      ...prev,
      needs: prev.needs.map((n, i) => (i === index ? { ...n, [field]: value } : n)),
    }));
  }

  function addEditNeedRow() {
    setEditingEvent((prev) => ({ ...prev, needs: [...prev.needs, emptyNeed()] }));
  }

  function removeEditNeedRow(index) {
    setEditingEvent((prev) => ({ ...prev, needs: prev.needs.filter((_, i) => i !== index) }));
  }

  async function saveEventEdit() {
    setEditError('');
    setSavingEvent(true);
    try {
      const validNeeds = editingEvent.needs.filter((n) => n.ministryId);
      await api.put(`/events/${editingEvent.id}`, {
        name: editingEvent.name,
        date: editingEvent.date,
        needs: validNeeds.map((n) => ({ ministryId: n.ministryId, slotsCount: n.slotsCount })),
      });
      setEditingEvent(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Erro ao salvar evento');
    } finally {
      setSavingEvent(false);
    }
  }

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

  async function clearSchedule(ev) {
    if (!confirm(`Remover todos os voluntários escalados em "${ev.name}"? Esta ação não pode ser desfeita.`)) return;
    setMessage('Limpando escala...');
    try {
      const res = await api.delete(`/schedule/event/${ev.id}`);
      setMessage(`${res.data.removed} atribuição(ões) removida(s).`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao limpar escala');
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
    try {
      await api.put(`/schedule/${slotId}`, { userId });
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao reatribuir voluntário');
      load();
    }
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
      const dateStr = formatEventDate(ev.date).replace(/\//g, '-');
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

  function getWeekRange() {
    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  function getWeekEvents() {
    const { start, end } = getWeekRange();
    return events
      .filter((ev) => {
        const d = new Date(ev.date);
        return d >= start && d < end;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async function exportWeekImage() {
    const weekEvents = getWeekEvents();
    if (weekEvents.length === 0) {
      setMessage('Nenhum evento encontrado nessa semana.');
      return;
    }
    const node = weekExportRef.current;
    if (!node) return;
    setExportingWeek(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const dataUrl = canvas.toDataURL('image/png');
      const { start } = getWeekRange();
      const startStr = formatEventDate(start).replace(/\//g, '-');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `escala-semana-${startStr}.png`;
      link.click();
    } catch (err) {
      setMessage('Erro ao gerar imagem da escala semanal.');
    } finally {
      setExportingWeek(false);
    }
  }

  const weekEvents = getWeekEvents();
  const { start: weekRangeStart, end: weekRangeEndExclusive } = getWeekRange();
  const weekRangeEnd = new Date(weekRangeEndExclusive);
  weekRangeEnd.setUTCDate(weekRangeEnd.getUTCDate() - 1);
  const weekColumns = weekLayout === 'horizontal' ? Math.min(weekEvents.length, 3) || 1 : 1;
  const weekCardWidth = 280;
  const weekCardGap = 16;
  const weekExportWidth =
    weekLayout === 'horizontal'
      ? weekColumns * weekCardWidth + (weekColumns - 1) * weekCardGap + 48
      : 520;

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

      <div className="card">
        <h3>Exportar escala da semana (imagem)</h3>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <label>
            Semana a partir de:{' '}
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </label>
          <label>
            Layout:{' '}
            <select value={weekLayout} onChange={(e) => setWeekLayout(e.target.value)}>
              <option value="vertical">Um embaixo do outro</option>
              <option value="horizontal">Lado a lado</option>
            </select>
          </label>
          <button
            className="btn secondary"
            disabled={exportingWeek}
            onClick={exportWeekImage}
          >
            {exportingWeek ? 'Gerando imagem...' : 'Exportar semana'}
          </button>
        </div>
        <p style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
          {weekEvents.length} evento(s) entre {formatEventDate(weekRangeStart)} e{' '}
          {formatEventDate(weekRangeEnd)}.
        </p>
      </div>

      {events.map((ev) => {
        const eventSlots = sortByMinistry(slots.filter((s) => s.eventId === ev.id));
        return (
          <div className="card" key={ev.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{ev.name}</h3>
                <p>{formatEventDateTime(ev.date)}</p>
              </div>
              <div className="row">
                <button className="btn secondary" onClick={() => startEditEvent(ev)}>
                  Editar evento
                </button>
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
                <button
                  className="btn danger"
                  disabled={eventSlots.length === 0}
                  onClick={() => clearSchedule(ev)}
                >
                  Limpar escala
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
                  const assignedElsewhere = new Set(
                    eventSlots.filter((s) => s.id !== slot.id).map((s) => s.userId)
                  );
                  const eligible = users.filter(
                    (u) =>
                      u.ministries.some((m) => m.id === slot.ministryId) &&
                      !assignedElsewhere.has(u.id) &&
                      (u.id === slot.userId || isUserAvailableForEvent(u, ev.date))
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
                <div style={{ fontSize: 13, opacity: 0.85 }}>{formatEventDateTime(ev.date)}</div>
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

      <div
        ref={weekExportRef}
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: weekExportWidth,
          boxSizing: 'border-box',
          background: '#ffffff',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#1f2933',
        }}
      >
        <div style={{ background: '#1a1a1a', color: '#ffffff', padding: '14px 18px', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Escala da Semana</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {formatEventDate(weekRangeStart)} até {formatEventDate(weekRangeEnd)}
          </div>
        </div>
        {weekEvents.length === 0 && (
          <div style={{ fontSize: 14, color: '#6b7280' }}>Nenhum evento nessa semana.</div>
        )}
        <div
          style={
            weekLayout === 'horizontal'
              ? { display: 'flex', flexWrap: 'wrap', gap: weekCardGap }
              : undefined
          }
        >
          {weekEvents.map((ev) => {
            const eventSlots = sortByMinistry(slots.filter((s) => s.eventId === ev.id));
            return (
              <div
                key={ev.id}
                style={
                  weekLayout === 'horizontal'
                    ? { width: weekCardWidth, marginBottom: 20 }
                    : { marginBottom: 20 }
                }
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '6px 0',
                    borderBottom: '2px solid #1a1a1a',
                    marginBottom: 6,
                  }}
                >
                  {ev.name} — {formatEventDateTime(ev.date)}
                </div>
                {eventSlots.length === 0 && (
                  <div style={{ fontSize: 13, color: '#6b7280', padding: '6px 0' }}>Sem escala gerada.</div>
                )}
                {eventSlots.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
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
            );
          })}
        </div>
      </div>

      {editingEvent && (
        <div className="modal-overlay" onClick={() => setEditingEvent(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>Editar evento</h3>
            <div className="grid-2">
              <div>
                <label>Nome do evento</label>
                <input
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Data e hora</label>
                <input
                  type="datetime-local"
                  value={editingEvent.date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <label>Necessidades por ministério</label>
            {editingEvent.needs.map((n, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <select value={n.ministryId} onChange={(e) => updateEditNeed(i, 'ministryId', e.target.value)}>
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
                  onChange={(e) => updateEditNeed(i, 'slotsCount', e.target.value)}
                />
                <button type="button" className="btn secondary" onClick={() => removeEditNeedRow(i)}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="btn secondary" onClick={addEditNeedRow}>
              + Adicionar ministério
            </button>
            {editError && <div className="error" style={{ marginTop: 8 }}>{editError}</div>}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setEditingEvent(null)}>
                Cancelar
              </button>
              <button className="btn" onClick={saveEventEdit} disabled={savingEvent}>
                {savingEvent ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
