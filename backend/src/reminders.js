const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendMessage } = require('./whatsapp');

const prisma = new PrismaClient();

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateTime(date) {
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr };
}

async function send24hReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      reminder24hSentAt: null,
      status: { in: ['PENDING', 'CONFIRMED'] },
      event: { date: { gt: now, lte: in24h } },
    },
    include: { event: true, ministry: true, user: true },
  });

  for (const slot of slots) {
    const { dateStr, timeStr } = formatDateTime(new Date(slot.event.date));
    const text = `Olá ${slot.user.name}! Lembrete: faltam 24 horas para *${slot.ministry.name}* no evento *${slot.event.name}* em ${dateStr} às ${timeStr}. Contamos com você!`;
    const result = await sendMessage(slot.user.phone, text);
    await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: { reminder24hSentAt: result.sent ? new Date() : null },
    });
  }
}

async function sendDayOfReminders() {
  const now = new Date();

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      reminderDaySentAt: null,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: { event: true, ministry: true, user: true },
  });

  const todaySlots = slots.filter((slot) => sameDay(new Date(slot.event.date), now));

  for (const slot of todaySlots) {
    const { timeStr } = formatDateTime(new Date(slot.event.date));
    const text = `Bom dia, ${slot.user.name}! Hoje é dia de servir em *${slot.ministry.name}* no evento *${slot.event.name}*, às ${timeStr}. Te esperamos!`;
    const result = await sendMessage(slot.user.phone, text);
    await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: { reminderDaySentAt: result.sent ? new Date() : null },
    });
  }
}

function startReminderJobs() {
  cron.schedule('*/15 * * * *', () => {
    send24hReminders().catch((err) => console.error('[Reminders] Erro no lembrete de 24h:', err));
  });

  cron.schedule('0 9 * * *', () => {
    sendDayOfReminders().catch((err) => console.error('[Reminders] Erro no lembrete do dia do evento:', err));
  });

  console.log('[Reminders] Jobs de lembrete agendados (24h antes do evento e no dia do evento às 9h).');
}

module.exports = { startReminderJobs, send24hReminders, sendDayOfReminders };
