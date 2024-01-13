import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { evmMockServer } from '../src/index'
import assert from 'node:assert';

let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
describe('Testing the test server', () => {
  beforeAll(async () => {
    serverRpc = await evmMockServer(55001);
  });

  test('Server properly started', async () => {
    assert(serverRpc?.listening, 'server is listening');
  });

  test('Create a block on /unique and verify it', async () => {
    const rpcUrl = 'http://localhost:55001/unique';
    const blockNumber = '43439028';
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
    const body = await response.json();
    console.log(body);

  });

  afterAll(async () => {
    serverRpc?.close();
  })
})