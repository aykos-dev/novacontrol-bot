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

function todayRange(): { from: string; to: string } {
  const d = new Date();
  const s = d.toISOString().slice(0, 10);
  return { from: s, to: s };
}

function parseReportArgs(
  parts: string[],
): { dateFrom: string; dateTo: string; client?: string } | { error: string } {
  if (parts.length < 2) {
    return {
      error:
        'Формат: /report YYYY-MM-DD YYYY-MM-DD [имя клиента]\nПример: /report 2026-04-01 2026-04-21',
    };
  }
  const dateFrom = parts[0]!;
  const dateTo = parts[1]!;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(dateFrom) || !re.test(dateTo)) {
    return { error: 'Даты должны быть в формате YYYY-MM-DD.' };
  }
  const rest = parts.slice(2).join(' ').trim();
  return { dateFrom, dateTo, client: rest || undefined };
}

async function fetchReport(
  dateFrom: string,
  dateTo: string,
  client?: string,
): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(`${API_BASE}/internal/bot/report`, {
    params: { dateFrom, dateTo, client },
    headers: { Authorization: `Bearer ${BOT_SECRET}` },
    timeout: 120_000,
  });
  return data.text;
}

async function fetchBalance(): Promise<string> {
  if (!BOT_SECRET) throw new Error('BOT_API_SECRET is not set');
  const { data } = await axios.get<{ text: string }>(
    `${API_BASE}/internal/bot/balance`,
    {
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
      timeout: 60_000,
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

  bot.command('info', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе (см. TELEGRAM_GROUP_ID).',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const client = parts.join(' ').trim() || undefined;
    const { from, to } = todayRange();
    try {
      const text = truncate(await fetchReport(from, to, client));
      await ctx.reply(text);
    } catch (e) {
      console.error(e);
      await ctx.reply(
        `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  bot.command('report', async (ctx) => {
    if (!isStatsChat(ctx.chat?.id, ctx.chat?.type)) {
      await ctx.reply(
        'Эта команда доступна только в настроенной рабочей группе.',
      );
      return;
    }
    const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
    const parsed = parseReportArgs(parts);
    if ('error' in parsed) {
      await ctx.reply(parsed.error);
      return;
    }
    try {
      const text = truncate(
        await fetchReport(parsed.dateFrom, parsed.dateTo, parsed.client),
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
    try {
      const text = truncate(await fetchBalance());
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
