const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let client = null;
let ready = false;
let lastQr = null;
let initializing = false;

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

function findExecutablePath() {
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
  return candidatePaths.find((p) => fs.existsSync(p)) || null;
}

async function initWhatsApp() {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WhatsApp] Integração desativada (WHATSAPP_ENABLED != true).');
    return;
  }
  if (initializing) return;

  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcodeTerminal = require('qrcode-terminal');

  const executablePath = findExecutablePath();

  if (!executablePath) {
    console.warn(
      '[WhatsApp] Nenhum navegador Chrome/Edge encontrado. Defina CHROME_PATH no .env ou rode "npx puppeteer browsers install chrome" no backend. Integração desativada por ora.'
    );
    return;
  }

  initializing = true;
  ready = false;
  lastQr = null;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    lastQr = qr;
    console.log('[WhatsApp] Escaneie o QR code abaixo com o WhatsApp do número da igreja (ou acesse Admin > WhatsApp no sistema):');
    qrcodeTerminal.generate(qr, { small: true });
  });

  client.on('ready', () => {
    ready = true;
    initializing = false;
    lastQr = null;
    console.log('[WhatsApp] Conectado e pronto para enviar mensagens.');
  });

  client.on('auth_failure', (msg) => {
    ready = false;
    initializing = false;
    console.log('[WhatsApp] Falha de autenticação:', msg);
  });

  client.on('disconnected', () => {
    ready = false;
    initializing = false;
    console.log('[WhatsApp] Desconectado.');
  });

  client.on('message', handleIncomingMessage);

  try {
    await client.initialize();
  } catch (err) {
    initializing = false;
    throw err;
  }
}

async function reconnectWhatsApp({ resetSession } = {}) {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    return { ok: false, reason: 'Integração desativada (WHATSAPP_ENABLED != true)' };
  }

  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      console.error('[WhatsApp] Erro ao destruir client anterior:', err);
    }
    client = null;
  }
  ready = false;
  lastQr = null;
  initializing = false;

  if (resetSession) {
    const fs = require('fs');
    try {
      fs.rmSync('./.wwebjs_auth', { recursive: true, force: true });
    } catch (err) {
      console.error('[WhatsApp] Erro ao limpar sessão salva:', err);
    }
  }

  initWhatsApp().catch((err) => console.error('[WhatsApp] Falha ao reconectar:', err));
  return { ok: true };
}

function getStatus() {
  return {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    executableFound: !!findExecutablePath(),
    ready,
    initializing,
    hasQr: !!lastQr,
  };
}

async function getQrDataUrl() {
  if (!lastQr) return null;
  const QRCode = require('qrcode');
  return QRCode.toDataURL(lastQr);
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

module.exports = { initWhatsApp, sendMessage, reconnectWhatsApp, getStatus, getQrDataUrl };
