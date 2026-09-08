const express = require('express');
const { authRequired, adminOnly } = require('../middleware/auth');
const { reconnectWhatsApp, getStatus, getQrDataUrl } = require('../whatsapp');

const router = express.Router();

router.get('/status', authRequired, adminOnly, (req, res) => {
  res.json(getStatus());
});

router.get('/qr', authRequired, adminOnly, async (req, res) => {
  const qr = await getQrDataUrl();
  res.json({ qr });
});

router.post('/reconnect', authRequired, adminOnly, async (req, res) => {
  const result = await reconnectWhatsApp({ resetSession: !!req.body?.resetSession });
  if (!result.ok) return res.status(400).json({ error: result.reason });
  res.json({ ok: true });
});

module.exports = router;
