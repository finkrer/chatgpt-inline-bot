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

// Define bot names and their corresponding languages
const botNames = {
  ru: ['бот', 'бит', 'битингс'],
  uk: ['бiт', 'біт'],
  en: ['bot', 'bit', 'bitings'],
};

// Define image questions in different languages
const imageQuestions = {
  ru: 'Что изображено на этой картинке?',
  uk: 'Що зображено на цій картинці?',
  en: 'What is in this image?',
};

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
          message_text: `*❓ ${ctx.inlineQuery.query}*\n\n🤖 ${chatGptAnswer}`,
          parse_mode: 'Markdown',
        },
      },
      {
        type: 'article',
        id: nanoid(),
        title: 'Answer',
        description: chatGptAnswer,
        input_message_content: {
          message_text: chatGptAnswer,
          parse_mode: 'Markdown',
        },
      },
    ]);
  } catch {
    return;
  }
});

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
  const startsWithBotName = Object.values(botNames)
    .flat()
    .some((name) =>
      messageText.toLowerCase().startsWith(`${name.toLowerCase()},`)
    );

  // Check if the message is just the bot name and is replying to another message
  const isBotName = Object.values(botNames)
    .flat()
    .some((name) => messageText.toLowerCase() === name.toLowerCase());

  // Determine the language of the bot name
  const botNameLanguage =
    Object.entries(botNames).find(([_, names]) =>
      names.some((name) =>
        messageText.toLowerCase().includes(name.toLowerCase())
      )
    )?.[0] || 'en';

  const isReplyToBot =
    'reply_to_message' in ctx.message &&
    ctx.message.reply_to_message?.from?.username === ctx.botInfo.username;

  let query = '';
  let quotedMessage = '';
  let imageUrl = '';

  // Check if the replied-to message contains a photo
  if ('reply_to_message' in ctx.message && ctx.message.reply_to_message) {
    const repliedMessage = ctx.message.reply_to_message;
    if ('photo' in repliedMessage && repliedMessage.photo.length > 0) {
      // Get the largest photo size
      const largestPhoto =
        repliedMessage.photo[repliedMessage.photo.length - 1];
      const file = await ctx.telegram.getFile(largestPhoto.file_id);
      imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    }
  }

  if (isReplyToBot) {
    query = messageText;
    quotedMessage = replyText || '';
  } else if (startsWithBotName) {
    // Extract the query after the bot name and comma
    query = messageText.split(',')[1]?.trim();
    quotedMessage = replyText || '';
  } else if (isBotName) {
    // When user just replies with bot name, we should process the image if present
    if (imageUrl) {
      query = imageQuestions[botNameLanguage as keyof typeof imageQuestions];
    }
    quotedMessage = replyText || '';
  }

  if (query || quotedMessage || imageUrl) {
    let chatGptAnswer: string;
    try {
      chatGptAnswer = await getMessageCompletion({
        query,
        quotedMessage,
        isReplyToBot,
        imageUrl,
      });
    } catch (err) {
      console.error('Error getting completion from OpenAI:', err);
      return;
    }

    try {
      // Reply with the generated answer
      return await ctx.reply(chatGptAnswer, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
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
