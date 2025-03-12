import { OpenAI } from 'openai';
import createDebug from 'debug';
import { ChatCompletionMessageParam } from 'openai/resources';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const debug = createDebug('bot:inline_query');

export const getInlineCompletion = async (prompt: string) => {
  debug(`triggered inline completion with prompt: ${prompt}`);
  return await openai.chat.completions
    .create({
      model: 'gpt-4o-mini-search-preview-2025-03-11',
      messages: [
        {
          role: 'system',
          content: `You are a question answering bot for the Telegram messenger. People call you with an inline query in their message and you answer the question right in the chat. The answer must be concise and to the point and contain only the facts requested. Don't address the user, don't ask further questions, don't repeat the words from the question. It's ok to start the answer with "because" or just list the requested facts with no additional words. Use Telegram Markdown formatting.`,
        },
        { role: 'user', content: prompt },
      ],
    })
    .then((data) => data.choices[0].message?.content as string);
};

export const getMessageCompletion = async ({
  query,
  quotedMessage,
  isReplyToBot = false,
}: {
  query?: string;
  quotedMessage?: string;
  isReplyToBot?: boolean;
}) => {
  debug(`triggered message completion with prompt: ${query}`);
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a question answering bot for the Telegram messenger. People call you with a message and you answer the question right in the chat. The answer must be concise and to the point and contain only the facts requested. Don't address the user, don't ask further questions, don't repeat the words from the question. It's ok to start the answer with "because" or just list the requested facts with no additional words. Use Telegram Markdown formatting.`,
    },
  ];

  if (isReplyToBot) {
    messages.push({
      role: 'system',
      content: `The user answered to your message.`,
    });
    messages.push({
      role: 'assistant',
      content: quotedMessage,
    });
    messages.push({
      role: 'user',
      content: query!,
    });
  } else if (query && quotedMessage) {
    messages.push({
      role: 'system',
      content: `The user asked you a question about another message.`,
    });
    messages.push({
      role: 'user',
      content: query,
    });
    messages.push({
      role: 'user',
      content: quotedMessage,
    });
  } else if (query) {
    messages.push({
      role: 'system',
      content: `The user asked you a question.`,
    });
    messages.push({
      role: 'user',
      content: query,
    });
  } else if (quotedMessage) {
    messages.push({
      role: 'system',
      content: `The user wants you to comment on another message. It may contain an instruction to follow, a question to answer, a topic to explain or perhaps a claim to verify.`,
    });
    messages.push({
      role: 'user',
      content: quotedMessage,
    });
  }

  return await openai.chat.completions
    .create({
      model: 'gpt-4o-mini-search-preview-2025-03-11',
      messages,
    })
    .then((data) => data.choices[0].message?.content as string);
};
