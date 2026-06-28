import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { buildMatchLink, buildWebAppUrl, getAdminIds } from "./config.js";
import { syncTelegramMenu } from "./telegram-setup.js";
import { createMatch } from "./match-service.js";
import { formatLabel, type MatchFormat } from "../shared/types.js";
import { appendAuthToUrl } from "./auth-token.js";

function webAppUrlForUser(userId: number, matchId?: string): string {
  return appendAuthToUrl(buildWebAppUrl(matchId), userId, matchId);
}

let bot: Bot;

export function startBot(): void {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  bot = new Bot(token);
  const webappUrl = buildWebAppUrl();
  const adminIds = getAdminIds();

  function isAdmin(userId: number): boolean {
    return adminIds.length === 0 || adminIds.includes(userId);
  }

  bot.command("start", async (ctx) => {
    const payload = ctx.match;
    const text = [
      "🎮 <b>PicksMaps</b> — вето карт CS2",
      "",
      "Админ создаёт матч, капитаны открывают ссылку и проходят пики/баны.",
    ].join("\n");

    if (typeof payload === "string" && payload.startsWith("match_")) {
      const matchId = payload.replace("match_", "");
      const userId = ctx.from!.id;
      const matchUrl = webAppUrlForUser(userId, matchId);

      const inline = new InlineKeyboard().webApp(
        "🎯 Открыть матч",
        matchUrl
      );

      const keyboard = new Keyboard()
        .webApp("🎯 Войти в матч — выбрать команду", matchUrl)
        .resized();

      await ctx.reply(
        [
          "🎮 <b>PicksMaps</b> — вето карт CS2",
          "",
          "⚡ <b>Нажмите кнопку внизу экрана</b>",
          "«🎯 Войти в матч — выбрать команду»",
          "",
          "Там вы выберете свою команду и пройдёте пики/баны.",
          "",
          `Матч: <code>${matchId}</code>`,
        ].join("\n"),
        { parse_mode: "HTML", reply_markup: keyboard }
      );

      await ctx.reply("Или нажмите кнопку здесь:", {
        reply_markup: inline,
      });
      return;
    }

    const keyboard = new Keyboard();

    if (ctx.from && isAdmin(ctx.from.id)) {
      keyboard.webApp("➕ Создать матч", webAppUrlForUser(ctx.from.id)).row();
    }

    keyboard.text("ℹ️ Помощь");

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard.resized(),
    });
  });

  bot.command("app", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Только для админа.");
      return;
    }
    const url = webAppUrlForUser(ctx.from.id);
    const kb = new Keyboard().webApp("➕ Создать матч", url).resized();
    await ctx.reply(
      "Нажмите кнопку внизу — откроется Mini App с авторизацией:",
      { reply_markup: kb }
    );
  });

  bot.command("url", async (ctx) => {
    const url = buildWebAppUrl();
    await ctx.reply(
      [
        "<b>Текущий URL Mini App:</b>",
        `<code>${url}</code>`,
        "",
        "<b>Как открыть приложение:</b>",
        "• Капитанам — ссылка на матч → кнопка внизу экрана",
        "• Админу — команда /app",
        "",
        "<b>/setdomain</b> — это для Login Widget, не для Mini App.",
        "Для Mini App используйте кнопки бота.",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  bot.command("create", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("Только админ может создавать матчи.");
      return;
    }

    const text = ctx.match?.toString().trim() || "";
    // /create bo3 Team Alpha vs Team Beta
    const m = text.match(/^(bo1|bo2|bo3|bo5)\s+(.+?)\s+vs\s+(.+)$/i);
    if (!m) {
      await ctx.reply(
        [
          "<b>Создание матча через чат:</b>",
          "<code>/create bo3 Team1 vs Team2</code>",
          "",
          "Форматы: bo1, bo2, bo3, bo5",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
      return;
    }

    const format = m[1].toLowerCase() as MatchFormat;
    const teamAName = m[2].trim();
    const teamBName = m[3].trim();

    try {
      const match = createMatch({
        format,
        teamAName,
        teamBName,
        adminId: ctx.from.id,
      });
      const link = buildMatchLink(match.id);
      const matchUrl = webAppUrlForUser(ctx.from.id, match.id);

      const keyboard = new InlineKeyboard()
        .webApp("🎯 Открыть матч", matchUrl)
        .row()
        .url("📋 Ссылка для капитанов", link);

      const replyKb = new Keyboard()
        .webApp("🎯 Войти в матч", matchUrl)
        .resized();

      await ctx.reply(
        [
          `✅ Матч <b>${formatLabel(format)}</b> создан!`,
          `${teamAName} vs ${teamBName}`,
          "",
          `<b>Отправьте капитанам эту ссылку:</b>`,
          `<code>${link}</code>`,
          "",
          "Капитаны откроют ссылку → нажмут кнопку внизу экрана",
        ].join("\n"),
        { parse_mode: "HTML", reply_markup: replyKb }
      );

      await ctx.reply("Кнопка для капитанов (inline):", {
        reply_markup: keyboard,
      });
    } catch (e) {
      await ctx.reply(e instanceof Error ? e.message : "Ошибка создания");
    }
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "<b>Как пользоваться:</b>",
        "",
        "1. Админ создаёт матч в Mini App или через /create",
        "2. Выбирает формат (BO1/BO2/BO3/BO5) и названия команд",
        "3. Отправляет ссылку обоим капитанам",
        "4. Капитаны выбирают свою команду",
        "5. Проходит вето: баны → пики → выбор стороны",
        "",
        "<b>Форматы:</b>",
        "• BO1 — 6 банов, 1 карта",
        "• BO3 — ban, ban, pick, pick, ban, ban, decider",
        "• BO5 — 2 бана, 4 пика + decider",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text === "ℹ️ Помощь") {
      await ctx.api.sendMessage(ctx.chat.id, "/help");
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  bot.start({
    onStart: async (info) => {
      console.log(`Bot @${info.username} started`);
      await syncTelegramMenu();
    },
  });
}

export function getBot(): Bot | undefined {
  return bot;
}
