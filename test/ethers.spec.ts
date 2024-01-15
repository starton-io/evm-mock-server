import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { ethers } from 'ethers';
import assert from 'node:assert';
import { evmMockServer } from '../src/index';

const port = 55004;
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
describe('Testing call with ethers', () => {
  beforeAll(async () => {
    serverRpc = await evmMockServer(port);
  });

  afterAll(async () => {
    serverRpc?.close();
  });

  test('Basic get last block', async () => {
    const rpcUrl = `http://localhost:${port}/sequence`;
    const blockNumber = '43439020';
    // Create one block in the mock server
    const response = await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify({
        initialSerie: {
            blockStartNumber: blockNumber,
            blockSeriesLength: 1
        }
      })
    });
    const blockGenerated = await response.json();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const block = await provider.getBlock('latest');
    const blockHash = Object.keys(blockGenerated.blocks)[0]; // one block so first key of block
    assert(blockHash === block?.hash, `Block hash is incorrect, should be ${blockHash} but is ${block?.hash}`);
  });
});
