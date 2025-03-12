import { Telegraf } from 'telegraf';
import createDebug from 'debug';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { nanoid } from 'nanoid';
import { getInlineCompletion, getMessageCompletion } from './openai/api';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

const debug = createDebug('bot:inline_query');

bot.on('inline_query', async (ctx) => {
  debug('Triggered inline query');

  let query = ctx.inlineQuery.query;

  if (!query.endsWith('?')) {
    return;
  }

  query = query.slice(0, -1);

  let chatGptAnswer: string;
  try {
    chatGptAnswer = await getInlineCompletion(query);
  } catch {
    return;
  }

  try {
    return await ctx.answerInlineQuery([
      {
        type: 'article',
        id: nanoid(),
        title: 'Conversation',
        description: `${ctx.inlineQuery.query}\n\n${chatGptAnswer}`,
        input_message_content: {
          message_text: `<b>❓ ${ctx.inlineQuery.query}</b>\n\n🤖 ${chatGptAnswer}`,
          parse_mode: 'HTML',
        },
      },
      {
        type: 'article',
        id: nanoid(),
        title: 'Answer',
        description: chatGptAnswer,
        input_message_content: {
          message_text: chatGptAnswer,
          parse_mode: 'HTML',
        },
      },
    ]);
  } catch {
    return;
  }
});

const botNames = [
  'бот',
  'бит',
  'бiт',
  'біт',
  'bot',
  'bit',
  'битингс',
  'bitings',
];

bot.on('message', async (ctx) => {
  debug(JSON.stringify(ctx.message, null, 2));
  const messageText = 'text' in ctx.message ? ctx.message.text : '';
  const replyText =
    'reply_to_message' in ctx.message && ctx.message.reply_to_message
      ? 'text' in ctx.message.reply_to_message
        ? ctx.message.reply_to_message.text
        : 'caption' in ctx.message.reply_to_message
        ? ctx.message.reply_to_message.caption
        : ''
      : '';

  // Check if the message starts with a bot name followed by a comma
  const startsWithBotName = botNames.some((name) =>
    messageText.toLowerCase().startsWith(`${name.toLowerCase()},`)
  );

  // Check if the message is just the bot name and is replying to another message
  const isBotName = botNames.some(
    (name) => messageText.toLowerCase() === name.toLowerCase()
  );

  const isReplyToBot =
    'reply_to_message' in ctx.message &&
    ctx.message.reply_to_message?.from?.username === ctx.botInfo.username;

  let query = '';
  let quotedMessage = '';

  if (isReplyToBot) {
    query = messageText;
    quotedMessage = replyText || '';
  } else if (startsWithBotName) {
    // Extract the query after the bot name and comma
    query = messageText.split(',')[1]?.trim();
    quotedMessage = replyText || '';
  } else if (isBotName) {
    quotedMessage = replyText || '';
  }

  if (query || quotedMessage) {
    let chatGptAnswer: string;
    try {
      chatGptAnswer = await getMessageCompletion({
        query,
        quotedMessage,
        isReplyToBot,
      });
    } catch (err) {
      console.error('Error getting completion from OpenAI:', err);
      return;
    }

    try {
      // Reply with the generated answer
      return await ctx.reply(chatGptAnswer, {
        parse_mode: 'Markdown',
        reply_to_message_id: query
          ? ctx.message.message_id
          : 'reply_to_message' in ctx.message
          ? ctx.message.reply_to_message?.message_id
          : undefined,
      });
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  }
});

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//dev mode
ENVIRONMENT !== 'production' && development(bot);
