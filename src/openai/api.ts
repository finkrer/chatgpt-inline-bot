import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import createDebug from 'debug';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const debug = createDebug('bot:inline_query');

export const getInlineCompletion = async (prompt: string) => {
  debug(`triggered inline completion with prompt: ${prompt}`);
  return await openai
    .createChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a question answering bot for the Telegram messenger. People call you with an inline query in their message and you answer the question right in the chat. The answer must be concise and to the point and contain only the facts requested. Don't address the user, don't ask further questions, don't repeat the words from the question. It's ok to start the answer with "because" or just list the requested facts with no additional words.`,
        },
        { role: 'user', content: prompt },
      ],
    })
    .then((data) => data.data.choices[0].message?.content as string);
};

export const getMessageCompletion = async ({
  query: prompt,
  quotedMessage: replyToMessage,
}: {
  query?: string;
  quotedMessage?: string;
}) => {
  debug(`triggered message completion with prompt: ${prompt}`);
  const messages: ChatCompletionRequestMessage[] = [
    {
      role: 'system',
      content: `You are a question answering bot for the Telegram messenger. People call you with a message and you answer the question right in the chat. The answer must be concise and to the point and contain only the facts requested. Don't address the user, don't ask further questions, don't repeat the words from the question. It's ok to start the answer with "because" or just list the requested facts with no additional words.`,
    },
  ];

  if (prompt && replyToMessage) {
    messages.push({
      role: 'system',
      content: `The user asked you a question about another message.`,
    });
    messages.push({
      role: 'user',
      content: prompt,
    });
    messages.push({
      role: 'user',
      content: replyToMessage,
    });
  } else if (prompt) {
    messages.push({
      role: 'system',
      content: `The user asked you a question.`,
    });
    messages.push({
      role: 'user',
      content: prompt,
    });
  } else if (replyToMessage) {
    messages.push({
      role: 'system',
      content: `The user wants you to comment on another message. It may contain an instruction to follow, a question to answer, a topic to explain or perhaps a claim to verify.`,
    });
    messages.push({
      role: 'user',
      content: replyToMessage,
    });
  }

  return await openai
    .createChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages,
    })
    .then((data) => data.data.choices[0].message?.content as string);
};
