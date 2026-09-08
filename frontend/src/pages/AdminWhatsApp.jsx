import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

export default function AdminWhatsApp() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  async function loadStatus() {
    try {
      const res = await api.get('/whatsapp/status');
      setStatus(res.data);
      if (res.data.hasQr) {
        const qrRes = await api.get('/whatsapp/qr');
        setQr(qrRes.data.qr);
      } else {
        setQr(null);
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao consultar status do WhatsApp');
    }
  }

  useEffect(() => {
    loadStatus();
    timerRef.current = setInterval(loadStatus, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  async function handleReconnect(resetSession) {
    setBusy(true);
    setError('');
    try {
      await api.post('/whatsapp/reconnect', { resetSession });
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao reconectar WhatsApp');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>WhatsApp</h1>
      <div className="card">
        {!status && <p>Carregando status...</p>}
        {status && !status.enabled && (
          <p>Integração desativada. Defina <code>WHATSAPP_ENABLED=true</code> no <code>.env</code> do backend.</p>
        )}
        {status && status.enabled && !status.executableFound && (
          <p>Nenhum navegador Chrome/Edge encontrado nesta máquina. Instale o Chrome ou defina <code>CHROME_PATH</code> no <code>.env</code>.</p>
        )}
        {status && status.enabled && status.executableFound && status.ready && (
          <p>✅ WhatsApp conectado e pronto para enviar mensagens.</p>
        )}
        {status && status.enabled && status.executableFound && !status.ready && !qr && (
          <p>{status.initializing ? 'Conectando...' : 'WhatsApp desconectado.'}</p>
        )}
        {qr && (
          <div>
            <p>Escaneie este QR code com o WhatsApp do número da igreja (Aparelhos conectados → Conectar um aparelho):</p>
            <img
              src={qr}
              alt="QR Code do WhatsApp"
              style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block' }}
            />
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} onClick={() => handleReconnect(false)}>
            Reconectar
          </button>
          <button className="btn secondary" disabled={busy} onClick={() => handleReconnect(true)}>
            Gerar novo QR code (limpar sessão)
          </button>
        </div>
      </div>
    </div>
  );
}
