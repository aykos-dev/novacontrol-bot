import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID?.trim();
const BOT_SECRET = process.env.BOT_API_SECRET?.trim();
const API_BASE =
  process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000/api';
const PANEL_URL =
  process.env.ADMIN_PANEL_URL?.replace(/\/$/, '') || 'http://localhost:5173';

const MAX_MSG = 4000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchReport(date?: string): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(`${API_BASE}/internal/bot/report`, {
    params: date && DATE_RE.test(date) ? { date } : {},
    headers: { Authorization: `Bearer ${BOT_SECRET}` },
    timeout: 120_000,
  });
  return data.text;
}

async function fetchBalance(date?: string): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/balance`,
    {
      params: date && DATE_RE.test(date) ? { date } : {},
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 120_000,
    },
  );
  return data.text;
}

async function fetchViruchka(date?: string): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/viruchka`,
    {
      params: date && DATE_RE.test(date) ? { date } : {},
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 120_000,
    },
  );
  return data.text;
}

async function fetchExpenseDay(date?: string): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/expense`,
    {
      params: date && DATE_RE.test(date) ? { date } : {},
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 60_000,
    },
  );
  return data.text;
}

async function fetchUserExpenseNet(tokens: string[]): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/userinfo`,
    {
      params:
        tokens.length > 0 ? { users: tokens.join(',') } : {},
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 120_000,
    },
  );
  return data.text;
}

async function fetchClientExpenseNet(tokens: string[]): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/clientinfo`,
    {
      params:
        tokens.length > 0 ? { clients: tokens.join(',') } : {},
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 120_000,
    },
  );
  return data.text;
}

function truncate(text: string): string {
  if (text.length <= MAX_MSG) return text;
  return `${text.slice(0, MAX_MSG - 20)}\n… (обрезано)`;
}

function isStatsChat(chatId: number | undefined, chatType: string | undefined): boolean {
  if (!GROUP_ID) return true;
  if (chatType === 'private') return false;
  return String(chatId) === GROUP_ID;
}

async function main() {
  if (!TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is required');
    process.exit(1);
  }

  const bot = new Telegraf(TOKEN);

  bot.start(async (ctx) => {
    const url = PANEL_URL;
    await ctx.reply('WB Analytics — откройте панель в Telegram.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🖥️ Открыть панель', web_app: { url } }],
        ],
      },
    });
  });

  bot.command('report', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const dateArg = parts[0]?.trim();
    try {
      const text = truncate(
        await fetchReport(dateArg && DATE_RE.test(dateArg) ? dateArg : undefined),
      );
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  bot.command('balance', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const dateArg = parts[0]?.trim();
    try {
      const text = truncate(
        await fetchBalance(
          dateArg && DATE_RE.test(dateArg) ? dateArg : undefined,
        ),
      );
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  bot.command('viruchka', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const dateArg = parts[0]?.trim();
    try {
      const text = truncate(
        await fetchViruchka(
          dateArg && DATE_RE.test(dateArg) ? dateArg : undefined,
        ),
      );
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  /** Net extra expenses (KGS) for one day. Optional: /expense YYYY-MM-DD */
  bot.command('expense', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const dateArg = parts[0]?.trim();
    try {
      const text = truncate(
        await fetchExpenseDay(
          dateArg && DATE_RE.test(dateArg) ? dateArg : undefined,
        ),
      );
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  /** Net extra expenses saved by users (all dates). /userinfo alice bob — omit args for all */
  bot.command('userinfo', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    try {
      const text = truncate(await fetchUserExpenseNet(parts));
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  /** Net extra expenses by clients (all dates). /clientinfo Name1 Name2 — omit args for all */
  bot.command('clientinfo', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    try {
      const text = truncate(await fetchClientExpenseNet(parts));
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  bot.catch((err, ctx) => {
    console.error('Bot error', err);
    void ctx.reply('Внутренняя ошибка бота.');
  });

  await bot.launch();
  console.log('Telegram bot is running');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
