import { IncomingMessage } from 'node:http';

export const basicBody = (request: IncomingMessage): Promise<string> => new Promise((res, rej) => {
  let data = '';
  request.on('data', chunk => {
    data += chunk.toString();
  });
  request.on('end', () => res(data));
  request.on('error', (err) => rej(err));
});
