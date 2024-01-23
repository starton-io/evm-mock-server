import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { basicBody } from './parse-body';
import { FakeData, FakeGeneration, IncreaseType, ItemType, ReplaceType, JSONRPC, ServerHook, BlockConfig, RPCResponse } from './type';
import * as evmMockUtils from './utils';
import { getResponse } from './server-response';
import { generateFakeData, evmCreateOrUpdateModel, evmGetModel } from './generate-data';
//import { writeFile } from 'node:fs';
const fakeData: Record<string, FakeData> = {}
const evmMockSetData = (url: string, data: FakeData) => {
  fakeData[url] = data;
}

/**
 * This is called on the PUT method to generate fake data for the server
 * @param rawData body that should parse to FakeGeneration
 * @returns 
 */
async function extractBody(rawData: string): Promise<FakeData> {
  const fakeData: FakeData = {
    blocks: {},
    transactions: {},
    receipts: {},
    blockByNumber: {},
    blockNavigation: {
      index: 0,
      list: [],
      idxType: IncreaseType.NONE,
    },
    chainId: '0x1',
  }
  const generation: FakeGeneration = JSON.parse(rawData);
  if (generation.chainId) {
    fakeData.chainId = evmMockUtils.intToHex(generation.chainId);
  }
  await generateFakeData(fakeData, generation.initialSerie, true);
  if (generation.forkSerie) {
    const forkList = await generateFakeData(fakeData, generation.forkSerie, false);
    fakeData.replaceBlock = forkList;
    fakeData.replaceType = generation.forkType ?? ReplaceType.AFTER_FIRST_READ;
  }
  if (generation.increaseIndex) {
    fakeData.blockNavigation.idxType = IncreaseType.SERIAL;
  }
  if (generation.delayIndexMs) {
    fakeData.blockNavigation.idxType = IncreaseType.TIME_BASED;
    fakeData.blockNavigation.indexDelay = generation.delayIndexMs;
  }
  /*if (generation.chainId === 80001) {
    writeFile('./fixture-simple.json', JSON.stringify((fakeData), null, 2), (error) => {
      if (error) {
        console.log('An error has occurred ', error);
        return;
      }
      console.log('Data written successfully to disk');
    });
  }*/
  
  return fakeData;
}

/*const chunkSize = 16 * 1024;
const sendChunkedResponse = (response: ServerResponse, rawData: FakeData) => {
  // Set appropriate headers
  response.setHeader('Content-Type', 'application/json');
  let data = JSON.stringify(rawData);
  // Function to send chunks
  const sendChunk = () => {
    const chunk = data.substring(0, chunkSize);
    data = data.substring(chunkSize);

    if (chunk.length > 0) {
      response.write(chunk);
      // Uncomment the line below if you want to simulate delays between chunks
      setImmediate(sendChunk); // Adjust delay as needed
    } else {
      response.end();
    }
  };

  // Start sending chunks
  sendChunk();
};*/

const evmMockServer = async (serverPort: number = 55001, serverHook?: ServerHook) => {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (!request.url) {
      request.url = '/';
    }
    if (request.method === 'PUT') {
      const rawData: string = await basicBody(request);
      fakeData[request.url] = await extractBody(rawData);
      //return sendChunkedResponse(response, fakeData[request.url]);
      // Change with option to stream or maybe stream dump file
      if (Object.keys(fakeData[request.url].transactions).length > 50000) {
        return response.end(JSON.stringify({ 'warning': 'data is too large to stringify' }));
      }
      return response.end(JSON.stringify(fakeData[request.url]));
    } else if (request.method === 'POST') {
      const rawData: string = await basicBody(request);
      //console.log(`body received: ${rawData}`);
      const body: JSONRPC | Array<JSONRPC> = JSON.parse(rawData);
      // Add delay here for the server if set
      const data = fakeData[request.url];
      if (serverHook && serverHook.PreResponse) {
        await serverHook.PreResponse(request, body, data);
      }
      response.setHeader('Content-Type', 'application/json');
      if (Array.isArray(body)) {
        const answers: Array<Object> = [];
        for (let i = 0; i < body.length; i++) {
          const ret = await getResponse(body[i], fakeData, request.url);
          answers.push(ret);
        }
        //console.log(answers)
        return response.end(JSON.stringify(answers));
      } else {
        const answer = await getResponse(body, fakeData, request.url);
        //console.log(answer)
        return response.end(JSON.stringify(answer));
      }
    }
    response.statusCode = 404;
    return response.end('not found');
  });
  
  server.listen(serverPort, async () => {
    // console.log(`evmMockServer listening on port ${serverPort}`)
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

export {
  evmMockServer,
  evmMockUtils,
  evmMockSetData,
  evmCreateOrUpdateModel,
  evmGetModel,
  ItemType,
  IncreaseType,
  ReplaceType,
}
export type { FakeData, FakeGeneration, JSONRPC, BlockConfig };
