import { useEffect, useState } from 'react';
import api from '../api/client';

const statusLabel = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', DECLINED: 'Recusado' };
const statusClass = { PENDING: 'pending', CONFIRMED: 'confirmed', DECLINED: 'declined' };

export default function VolunteerHome() {
  const [slots, setSlots] = useState([]);

  function load() {
    api.get('/schedule').then((res) => setSlots(res.data));
  }

  useEffect(load, []);

  async function respond(slotId, action) {
    await api.post(`/schedule/${slotId}/${action}`);
    load();
  }

  return (
    <div>
      <h1>Minha Escala</h1>
      <div className="card">
        {slots.length === 0 && <p>Você ainda não foi escalado para nenhum evento futuro.</p>}
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Data</th>
              <th>Ministério</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td>{slot.event.name}</td>
                <td>{new Date(slot.event.date).toLocaleString('pt-BR')}</td>
                <td>{slot.ministry.name}</td>
                <td>
                  <span className={`badge ${statusClass[slot.status]}`}>{statusLabel[slot.status]}</span>
                </td>
                <td>
                  {slot.status === 'PENDING' && (
                    <>
                      <button className="btn" onClick={() => respond(slot.id, 'confirm')}>
                        Confirmar
                      </button>{' '}
                      <button className="btn secondary" onClick={() => respond(slot.id, 'decline')}>
                        Não posso
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
