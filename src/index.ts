import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { basicBody } from './parse-body';
import { FakeData, FakeGeneration, IncreaseType, ItemType, ReplaceType, JSONRPC } from './type';
import * as evmMockUtils from './utils';
import { getResponse } from './server-response';
import { generateFakeData, evmCreateOrUpdateModel, evmGetModel } from './generate-data';

const fakeData: Record<string, FakeData> = {}
const evmMockSetData = (url: string, data: FakeData) => {
  fakeData[url] = data;
}

/**
 * This is called on the PUT method to generate fake data for the server
 * @param rawData body that should parse to FakeGeneration
 * @returns 
 */
function extractBody(rawData: string): FakeData | PromiseLike<FakeData> {
  const fakeData: FakeData = {
    block: {},
    transactions: {},
    receipts: {},
    blockByNumber: {},
    listBlock: {
      index: 0,
      list: [],
      idxType: IncreaseType.NONE,
    }
  }
  const generation: FakeGeneration = JSON.parse(rawData);
  generateFakeData(fakeData, generation.initialSerie, true);
  if (generation.forkSerie) {
    const forkList = generateFakeData(fakeData, generation.forkSerie, false);
    fakeData.replaceBlock = forkList;
    fakeData.replaceType = generation.forkType ?? ReplaceType.AFTER_FIRST_READ;
  }
  if (generation.increaseIndex) {
    fakeData.listBlock.idxType = IncreaseType.SERIAL;
  }
  if (generation.delayIndexMs) {
    fakeData.listBlock.idxType = IncreaseType.TIME_BASED;
    fakeData.listBlock.config = {
      ms: generation.delayIndexMs,
    }
  }
  return fakeData;
}

const evmMockServer = async (serverPort: number = 55001) => {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (!request.url) {
      request.url = '/';
    }
    if (request.method === 'PUT') {
      const rawData: string = await basicBody(request);
      fakeData[request.url] = await extractBody(rawData);
      return response.end(JSON.stringify(fakeData[request.url]));
    } else if (request.method === 'POST') {
      const rawData: string = await basicBody(request);
      //console.log(`body received: ${rawData}`);
      const body: JSONRPC | Array<JSONRPC> = JSON.parse(rawData);
      response.setHeader('Content-Type', 'application/json');
      if (Array.isArray(body)) {
        const answers: Array<Object> = [];
        for (let i = 0; i < body.length; i++) {
          const ret = await getResponse(body[i], fakeData, request.url);
          answers.push(ret);
        }
        return response.end(JSON.stringify(answers));
      } else {
        return response.end(JSON.stringify(await getResponse(body, fakeData, request.url)));
      }
    }
    response.statusCode = 404;
    return response.end('not found');
  });
  
  server.listen(serverPort, async () => {
    console.log(`listening on port ${serverPort}`)
  });
  
  process.on('SIGTERM', () => {
    try {
      // cleanup on shutodown
      server.close();
      console.warn("Server shutdown");
    } catch (err) {
      console.error(err, "Error while shutting down");
    }
  });

  return server;
}

export default evmMockServer;
export {
  evmMockUtils,
  evmMockSetData,
  evmCreateOrUpdateModel,
  evmGetModel,
  ItemType,
  IncreaseType,
  ReplaceType,
}
export type { FakeData, FakeGeneration };
