const { PrismaClient } = require('@prisma/client');
const { sendMessage } = require('./whatsapp');

const prisma = new PrismaClient();

function formatEventDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

async function notifySlot(slot) {
  const dateStr = formatEventDate(new Date(slot.event.date));
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

module.exports = { notifySlot };
