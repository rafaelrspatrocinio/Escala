require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initWhatsApp } = require('./whatsapp');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ministryRoutes = require('./routes/ministries');
const eventRoutes = require('./routes/events');
const unavailabilityRoutes = require('./routes/unavailability');
const scheduleRoutes = require('./routes/schedule');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ministries', ministryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/unavailability', unavailabilityRoutes);
app.use('/api/schedule', scheduleRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Escala] Backend rodando em http://localhost:${PORT}`);
  initWhatsApp().catch((err) => console.error('[WhatsApp] Falha ao iniciar:', err));
});
