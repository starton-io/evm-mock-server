import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { evmMockServer } from '../src/index'
import assert from 'node:assert';

const port = 55003
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
describe('Testing the test server', () => {
  beforeAll(async () => {
    serverRpc = await evmMockServer(port);
  });

  afterAll(async () => {
    serverRpc?.close();
  });

  test('Server properly started', async () => {
    assert(serverRpc?.listening, 'server is listening');
  });

  test('Create a block on /unique and verify it', async () => {
    const rpcUrl = `http://localhost:${port}/unique`;
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
    await response.json();
    // end with no errors
  });
});
