import { createClient } from 'redis';

const clientPromise = createClient({ url: process.env.REDIS_URL })
  .connect()
  .catch((err) => {
    console.error('Redis connection error:', err);
    return null;
  });

const key = (chatId: number, messageId: number) =>
  `chain:${chatId}:${messageId}`;

const TTL = 60 * 60 * 24 * 1;

export const getResponseId = async (chatId: number, messageId: number) => {
  const client = await clientPromise;
  if (!client) return null;
  return client.get(key(chatId, messageId));
};

export const setResponseId = async (
  chatId: number,
  messageId: number,
  responseId: string
) => {
  const client = await clientPromise;
  if (!client) return;
  await client.set(key(chatId, messageId), responseId, { EX: TTL });
};
