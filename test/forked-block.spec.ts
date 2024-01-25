import { IncomingMessage, Server, ServerResponse } from 'node:http';
import assert from 'node:assert';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { evmMockServer, evmMockUtils, FakeGeneration, BlockConfig, ItemType } from '../src/index';

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

  test('Fork because of receipt error (trigger after initial read)', async () => {
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
          txLength: 7,
          txConfig: {}, // will create only valid item
        }
      } else {
        forkedBlock[blockForkNumberBI.toString()] = {
          txLength: 4,
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
    let navBlock = BigInt(blockNumber);
    const checkForkNumber = BigInt(blockNumberForked);
    let lastHeader = '';
    const blockHashList: Array<string> = [];
    for (let i = 0; i < 15; i++) {
      const latestBlock = await viem.getBlockNumber({
        cacheTime: 0,
      });
      assert(latestBlock === navBlock, `Should have ${navBlock.toString()} but received ${latestBlock.toString()}`);
      const block = await viem.getBlock({
        blockNumber: navBlock,
        includeTransactions: true,
      });
      blockHashList.push(block.hash);
      if (checkForkNumber === latestBlock) {
        // get the receipt that fails
        let tx = block.transactions.filter((tx) => tx.transactionIndex === 2);
        //TransactionReceiptNotFoundError
        assert.rejects(() => viem.getTransactionReceipt({
          hash: tx[0].hash,
        }),
        {
          name: 'TransactionReceiptNotFoundError',
        }, 'The error type should be TransactionReceiptNotFoundError');       
        const newBlock = await viem.getBlock({
          blockNumber: navBlock,
          includeTransactions: true,
        });
        // parentHeader should be different than previous header
        assert(newBlock.parentHash !== block.hash, `header should be different than the previous header as it is a fork`);
        tx = newBlock.transactions.filter((tx) => tx.transactionIndex === 2);
        await viem.getTransactionReceipt({
          hash: tx[0].hash,
        })
        assert(newBlock.transactions.length === 7, 'New block should have 7 transactions');
        assert(newBlock.parentHash !== blockHashList[i - 1], 'Last block hash is not different than the current parentHash');
        // parentHash should be different than the current holded one
        const prevBlock = await viem.getBlock({
          blockNumber: navBlock - 1n,
        });
        assert(newBlock.parentHash === prevBlock.hash, 'Previous block hash does not match the current parentHash!');
        assert(prevBlock.parentHash === blockHashList[i - 2], 'Previous block parent hash does not match the hash where the forked happen!');
        // get previous block and check if its the correct parentHash of the newBlock taken
        // check if that previous block parentHash is really the parentHash of the -2n block
        break;
      }
      lastHeader = block.hash; // we only check when the fork happen
      navBlock = navBlock + 1n;
    }
  });
});
