import { Telegraf } from 'telegraf';
import createDebug from 'debug';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { nanoid } from 'nanoid';
import { getSingleCompletion } from './openai/api';

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
    chatGptAnswer = await getSingleCompletion(query);
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

const botNames = ['бот', 'бит', 'бiт', 'біт', 'bot', 'bit'];

bot.on('message', async (ctx) => {
  const messageText = 'text' in ctx.message ? ctx.message.text : '';
  const quotedMessage =
    'reply_to_message' in ctx.message && ctx.message.reply_to_message
      ? 'text' in ctx.message.reply_to_message
        ? ctx.message.reply_to_message.text
        : ''
      : '';

  // Check if the message starts with a bot name followed by a comma
  const startsWithBotName = botNames.some((name) =>
    messageText.toLowerCase().startsWith(`${name.toLowerCase()},`)
  );

  // Check if the message is just the bot name and is replying to another message
  const isQuotedBotName =
    botNames.some((name) => messageText.toLowerCase() === name.toLowerCase()) &&
    quotedMessage;

  let query = '';

  if (startsWithBotName) {
    // Extract the query after the bot name and comma
    query = messageText.split(',')[1]?.trim();
  } else if (isQuotedBotName) {
    // Use the quoted message as the query
    query = quotedMessage;
  }

  if (query) {
    let chatGptAnswer: string;
    try {
      chatGptAnswer = await getSingleCompletion(query);
    } catch (err) {
      console.error('Error getting completion from OpenAI:', err);
      return;
    }

    try {
      // Reply with the generated answer
      return await ctx.reply(chatGptAnswer);
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
