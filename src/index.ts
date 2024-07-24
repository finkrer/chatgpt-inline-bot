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

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//dev mode
ENVIRONMENT !== 'production' && development(bot);
