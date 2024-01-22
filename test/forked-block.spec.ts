import { IncomingMessage, Server, ServerResponse } from 'node:http';
import assert from 'node:assert';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { evmMockServer, evmMockUtils, FakeGeneration, BlockConfig, ItemType } from '../src/index'

const port = 55005
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
jest.setTimeout(120000);
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
    const rpcUrl = `http://localhost:${port}/forkedBlocks`;
    const blockNumber = '43439129';
    const blockNumberForked = '43439140';
    const blockNumberForkStart = '43439139';
    const blockSeriesLength = 12;
    const initialBlock: Record<string, BlockConfig> = {};
    const forkedBlock: Record<string, BlockConfig> = {};
    const forkedHash = evmMockUtils.randomHash();
    const validHash = evmMockUtils.randomHash();
    let blockNumberBI = BigInt(blockNumber);
    let blockForkNumberBI = BigInt(blockNumberForkStart);
    for (let i = 0; i < blockSeriesLength; i++) {
      // should overlap with blockForkNumberBI
      if (blockNumberBI.toString() === blockNumberForked) {
        initialBlock[blockNumberBI.toString()] = {
          hash: forkedHash,
          txLength: 3,
          txConfig: {
            2: {
              rcptModel: 'error:notFound',
              TxType: ItemType.VALID_ITEM,
              RcptType: ItemType.ERROR_ITEM,
              LogType: ItemType.VALID_ITEM,
            }
          },
        }
      } else {
        initialBlock[blockNumberBI.toString()] = {
          txLength: 3,
          txConfig: {},
        }
      }
      if (blockForkNumberBI.toString() === blockNumberForked) {
        forkedBlock[blockForkNumberBI.toString()] = {
          hash: validHash,
          txLength: 1042,
          txConfig: {}, // will create only valid item
        }
      } else {
        forkedBlock[blockForkNumberBI.toString()] = {
          txLength: 1000,
          txConfig: {},
        }
      }
      blockNumberBI = blockNumberBI + 1n;
      blockForkNumberBI = blockForkNumberBI + 1n;
    }
    const testBody: FakeGeneration = {
      initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength,
        block: initialBlock,
      },
      forkSerie: {
        blockStartNumber: blockNumberForkStart,
        blockSeriesLength,
        block: forkedBlock,
      },
      increaseIndex: 1,
      chainId: 80001,
    }
    await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify(testBody),
    })
    //const generatedBlock = await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    // the fork should happen after the block reach the blockNumberForked

    // simulate the lastBlock call until we reach the block `blockNumberForked`
    let navBlock = BigInt(blockNumber)
    for (let i = 0; i < 15; i++) {
      const block = await viem.getBlock({
        blockNumber: navBlock,
      });
      
      navBlock = navBlock + 1n;
    }
  });
});












