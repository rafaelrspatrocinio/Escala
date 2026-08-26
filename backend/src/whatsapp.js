const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let client = null;
let ready = false;

const MIN_DELAY_MS = Number(process.env.WHATSAPP_MIN_DELAY_MS) || 2000;
const MAX_DELAY_MS = Number(process.env.WHATSAPP_MAX_DELAY_MS) || 4000;

let sendQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  const span = Math.max(0, MAX_DELAY_MS - MIN_DELAY_MS);
  return MIN_DELAY_MS + Math.floor(Math.random() * (span + 1));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function initWhatsApp() {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WhatsApp] Integração desativada (WHATSAPP_ENABLED != true).');
    return;
  }

  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');
  const fs = require('fs');

  const candidatePaths = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const executablePath = candidatePaths.find((p) => fs.existsSync(p));

  if (!executablePath) {
    console.warn(
      '[WhatsApp] Nenhum navegador Chrome/Edge encontrado. Defina CHROME_PATH no .env ou rode "npx puppeteer browsers install chrome" no backend. Integração desativada por ora.'
    );
    return;
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    console.log('[WhatsApp] Escaneie o QR code abaixo com o WhatsApp do número da igreja:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    ready = true;
    console.log('[WhatsApp] Conectado e pronto para enviar mensagens.');
  });

  client.on('disconnected', () => {
    ready = false;
    console.log('[WhatsApp] Desconectado.');
  });

  client.on('message', handleIncomingMessage);

  await client.initialize();
}

async function handleIncomingMessage(message) {
  try {
    if (message.fromMe) return;
    const body = stripAccents(message.body || '').trim().toLowerCase();
    const isConfirm = ['sim', 'confirmo', 'confirmar', 'ok', 's'].includes(body);
    const isDecline = ['nao', 'não', 'n', 'cancelar', 'recuso'].includes(body);
    if (!isConfirm && !isDecline) return;

    const rawFrom = message.from.split('@')[0];
    const phoneDigits = normalizePhone(rawFrom);

    const user = await prisma.user.findFirst({
      where: { phone: { endsWith: phoneDigits.slice(-8) } },
    });
    if (!user) return;

    const slot = await prisma.scheduleSlot.findFirst({
      where: { userId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { event: true, ministry: true },
    });
    if (!slot) return;

    const newStatus = isConfirm ? 'CONFIRMED' : 'DECLINED';
    await prisma.scheduleSlot.update({ where: { id: slot.id }, data: { status: newStatus } });

    const reply = isConfirm
      ? `Presença confirmada para ${slot.ministry.name} em ${slot.event.name} (${slot.event.date.toLocaleDateString('pt-BR')}). Obrigado!`
      : `Ok, marcamos que você não poderá servir em ${slot.ministry.name} em ${slot.event.name}. Vamos buscar outro voluntário.`;
    await message.reply(reply);
  } catch (err) {
    console.error('[WhatsApp] Erro ao processar mensagem recebida:', err);
  }
}

async function sendMessageNow(phone, text) {
  const digits = normalizePhone(phone);
  if (!digits) return { sent: false, reason: 'Telefone inválido' };
  if (process.env.WHATSAPP_ENABLED !== 'true' || !client || !ready) {
    console.log(`[WhatsApp] (simulado) Para ${digits}: ${text}`);
    return { sent: false, reason: 'WhatsApp não conectado, mensagem apenas logada' };
  }
  try {
    const chatId = `${digits}@c.us`;
    await client.sendMessage(chatId, text);
    return { sent: true };
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', err);
    return { sent: false, reason: err.message };
  }
}

function sendMessage(phone, text) {
  const task = sendQueue.then(async () => {
    const result = await sendMessageNow(phone, text);
    if (result.sent) await sleep(randomDelay());
    return result;
  });
  sendQueue = task.catch(() => {});
  return task;
}

module.exports = { initWhatsApp, sendMessage };
