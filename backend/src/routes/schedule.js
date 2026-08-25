const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');
const { generateScheduleForEvent, generateScheduleForUpcoming } = require('../scheduler');
const { sendMessage } = require('../whatsapp');

const router = express.Router();
const prisma = new PrismaClient();

async function notifySlot(slot) {
  const dateStr = new Date(slot.event.date).toLocaleDateString('pt-BR');
  const text = `Olá ${slot.user.name}! Você foi escalado(a) para *${slot.ministry.name}* no evento *${slot.event.name}* em ${dateStr}. Responda SIM para confirmar ou NAO para recusar.`;
  const result = await sendMessage(slot.user.phone, text);
  return prisma.scheduleSlot.update({
    where: { id: slot.id },
    data: {
      notified: !!result.sent,
      notifiedAt: result.sent ? new Date() : null,
      notificationError: result.sent ? null : result.reason || 'Falha ao enviar notificação',
    },
    include: { event: true, ministry: true, user: true },
  });
}

router.get('/', authRequired, async (req, res) => {
  const where = {};
  if (req.query.eventId) where.eventId = Number(req.query.eventId);
  if (req.user.role !== 'ADMIN') {
    where.userId = req.user.id;
  } else if (req.query.userId) {
    where.userId = Number(req.query.userId);
  }
  const slots = await prisma.scheduleSlot.findMany({
    where,
    include: { event: true, ministry: true, user: true },
    orderBy: { event: { date: 'asc' } },
  });
  res.json(slots);
});

router.post('/generate/:eventId', authRequired, adminOnly, async (req, res) => {
  try {
    const slots = await generateScheduleForEvent(Number(req.params.eventId));
    await Promise.all(slots.map(notifySlot));
    res.status(201).json({ created: slots.length, slots });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/generate-upcoming', authRequired, adminOnly, async (req, res) => {
  const daysAhead = Number(req.body?.daysAhead) || 30;
  const results = await generateScheduleForUpcoming(new Date(), daysAhead);
  res.json({ results });
});

router.post('/:id/notify', authRequired, adminOnly, async (req, res) => {
  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: Number(req.params.id) },
    include: { event: true, ministry: true, user: true },
  });
  if (!slot) return res.status(404).json({ error: 'Escala não encontrada' });
  const updated = await notifySlot(slot);
  res.json(updated);
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const { userId, status } = req.body;
  const data = {};
  if (userId) data.userId = Number(userId);
  if (status) data.status = status;
  const slot = await prisma.scheduleSlot.update({
    where: { id: Number(req.params.id) },
    data,
    include: { event: true, ministry: true, user: true },
  });
  res.json(slot);
});

router.post('/:id/confirm', authRequired, async (req, res) => {
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: Number(req.params.id) } });
  if (!slot) return res.status(404).json({ error: 'Escala não encontrada' });
  if (slot.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  const updated = await prisma.scheduleSlot.update({
    where: { id: slot.id },
    data: { status: 'CONFIRMED' },
  });
  res.json(updated);
});

router.post('/:id/decline', authRequired, async (req, res) => {
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: Number(req.params.id) } });
  if (!slot) return res.status(404).json({ error: 'Escala não encontrada' });
  if (slot.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  const updated = await prisma.scheduleSlot.update({
    where: { id: slot.id },
    data: { status: 'DECLINED' },
  });
  res.json(updated);
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.scheduleSlot.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
