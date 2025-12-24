import { OpenAI } from 'openai';
import createDebug from 'debug';
import type { EasyInputMessage } from 'openai/resources/responses/responses';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const debug = createDebug('bot:inline_query');

const searchPrompt = `If you need current information that you don't have, use the web search tool. Avoid long lists of points from search results. Try to summarize the results in a concise answer.`;

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
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ],
      reasoning_effort: 'low',
    })
    .then((data) => data.choices[0].message?.content as string);
};

export const getMessageCompletion = async ({
  query,
  quotedMessage,
  isReplyToBot = false,
  imageUrl,
}: {
  query?: string;
  quotedMessage?: string;
  isReplyToBot?: boolean;
  imageUrl?: string;
}) => {
  debug(`triggered message completion with prompt: ${query}`);
  const systemMessages: string[] = [systemPrompt + '\n' + searchPrompt];
  const inputItems: EasyInputMessage[] = [];

  if (isReplyToBot) {
    systemMessages.push(`The user answered to your message.`);
    inputItems.push({
      type: 'message',
      role: 'assistant',
      content: quotedMessage!,
    });
    inputItems.push({
      type: 'message',
      role: 'user',
      content: query!,
    });
  } else if (query && quotedMessage) {
    systemMessages.push(`The user asked you a question about another message.`);
    inputItems.push({
      type: 'message',
      role: 'user',
      content: query,
    });
    inputItems.push({
      type: 'message',
      role: 'user',
      content: quotedMessage,
    });
  } else if (query) {
    systemMessages.push(`The user asked you a question.`);
    inputItems.push({
      type: 'message',
      role: 'user',
      content: query,
    });
  } else if (quotedMessage) {
    systemMessages.push(
      `The user wants you to comment on another message. It may contain an instruction to follow, a question to answer, a topic to explain or perhaps a claim to verify.`
    );
    inputItems.push({
      type: 'message',
      role: 'user',
      content: quotedMessage,
    });
  }

  if (imageUrl) {
    const lastUserItem = inputItems[inputItems.length - 1];
    if (lastUserItem && lastUserItem.role === 'user') {
      const textContent =
        typeof lastUserItem.content === 'string' ? lastUserItem.content : '';
      lastUserItem.content = [
        { type: 'input_text', text: textContent },
        { type: 'input_image', image_url: imageUrl, detail: 'auto' },
      ];
    }
  }

  const response = await openai.responses.create({
    model: 'gpt-5-mini',
    instructions: systemMessages.join('\n'),
    input: inputItems,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'low' },
  });

  return response.output_text;
};
