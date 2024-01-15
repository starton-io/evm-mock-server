import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import assert from 'node:assert';
import { evmMockServer } from '../src/index';

const port = 55002;
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
describe('Testing call with ethers', () => {
  beforeAll(async () => {
    serverRpc = await evmMockServer(port);
  });

  afterAll(async () => {
    serverRpc?.close();
  });

  test('Basic get last block', async () => {
    const rpcUrl = `http://localhost:${port}/unique`;
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
    await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    const lastBock = await viem.getBlockNumber();
    assert(BigInt(blockNumber) === lastBock, `Block number is incorrect, should be ${blockNumber} but is ${lastBock.toString()}`);
  });
});
