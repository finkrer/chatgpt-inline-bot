import { OpenAI } from 'openai';
import createDebug from 'debug';
import { ChatCompletionMessageParam } from 'openai/resources';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const debug = createDebug('bot:inline_query');

const searchRedirectExplanation = `You can redirect the question to a model with search capabilities if you can't answer the question with the information available to you. To do so, answer with only the letter "s".`;

const searchPrompt = `Avoid long lists of points from search results. Try to summarize the results in a concise answer.`;

const systemPrompt = `You are a question answering bot for the Telegram messenger.
People call you with a message and you answer the question right in the chat.
The answer must be concise and to the point, can under no circumstances be longer than 350 characters, and must contain only the facts requested without expanding on them.
Don't address the user, don't ask further questions, don't repeat the user's question in the beginning of the answer.
It's ok to just list the requested facts with no additional introduction.
Use Telegram Markdown formatting.`;

export const getInlineCompletion = async (prompt: string) => {
  debug(`triggered inline completion with prompt: ${prompt}`);
  return await openai.chat.completions
    .create({
      model: 'gpt-4o-mini-search-preview-2025-03-11',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
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
      content: systemPrompt + '\n' + searchRedirectExplanation,
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

  const resultWithoutSearch = await openai.chat.completions
    .create({
      model: 'gpt-4o-mini',
      messages,
    })
    .then((data) => data.choices[0].message?.content as string);

  if (resultWithoutSearch.startsWith('s')) {
    messages[0].content = systemPrompt + '\n' + searchPrompt;
    const resultWithSearch = await openai.chat.completions
      .create({
        model: 'gpt-4o-mini-search-preview-2025-03-11',
        messages,
      })
      .then((data) => data.choices[0].message?.content as string);
    return resultWithSearch;
  }

  return resultWithoutSearch;
};
