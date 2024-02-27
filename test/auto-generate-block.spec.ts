import { IncomingMessage, Server, ServerResponse } from 'node:http';
import assert from 'node:assert';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { evmMockServer, evmMockUtils, FakeGeneration, BlockConfig, ItemType } from '../src/index';

const port = 55006
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
describe('Testing the test server', () => {
  beforeAll(async () => {
    serverRpc = await evmMockServer(port);
  });

  afterAll(async () => {
    serverRpc?.close();
  });

  test('Create new block after reaching the generated number', async () => {
    const rpcUrl = `http://localhost:${port}/auto-gen`;
    const blockNumber = '43439129';
    const blockSeriesLength = 2;
    const testBody: FakeGeneration = {
      initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength,
      },
      increaseIndex: 1,
      chainId: 80001,
    }
    const response = await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify(testBody),
    })
    const json = await response.json();
    assert(json.blockNavigation.list.length === blockSeriesLength, 'The number of block to navigate is different that the generated series')
    //const generatedBlock = await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    // the fork should happen after the block reach the blockNumberForked

    // simulate the lastBlock call until we reach the block `blockNumberForked`
    let navBlock = BigInt(blockNumber);
    let parentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < 4; i++) {
      const latestBlock = await viem.getBlockNumber({
        cacheTime: 0,
      });
      assert(latestBlock === navBlock, `Block number expected to be ${navBlock} but found ${latestBlock}`)
      const block = await viem.getBlock({
        blockNumber: latestBlock,
        includeTransactions: true,
      });
      assert(block.hash === block.transactions[0].blockHash, 'transaction block hash and block hash does not match');
      assert(block.number === block.transactions[0].blockNumber, 'transaction block number and block number does not match');
      assert(block.parentHash === parentHash, 'parent hash does not match previous block');
      const transactionReceipt = await viem.getTransactionReceipt({
        hash: block.transactions[0].hash,
      })
      assert(block.hash === transactionReceipt.blockHash, 'transactionReceipt block hash and block hash does not match');
      assert(block.number === transactionReceipt.blockNumber, 'transactionReceipt block number and block number does not match');
      parentHash = block.hash;
      navBlock = navBlock + 1n;
    }
  });

  test('Create new block after reaching the generated number by number', async () => {
    const rpcUrl = `http://localhost:${port}/auto-gen-num`;
    const blockNumber = '43439129';
    const blockSeriesLength = 2;
    const testBody: FakeGeneration = {
      initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength,
      },
      increaseIndex: 1,
      chainId: 80001,
    }
    const response = await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify(testBody),
    })
    const json = await response.json();
    assert(json.blockNavigation.list.length === blockSeriesLength, 'The number of block to navigate is different that the generated series')
    //const generatedBlock = await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    // the fork should happen after the block reach the blockNumberForked

    // simulate the lastBlock call until we reach the block `blockNumberForked`
    let navBlock = BigInt(blockNumber);
    let parentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < 4; i++) {
      const block = await viem.getBlock({
        blockNumber: navBlock,
        includeTransactions: true,
      });
      assert(block.hash === block.transactions[0].blockHash, 'transaction block hash and block hash does not match');
      assert(block.number === block.transactions[0].blockNumber, 'transaction block number and block number does not match');
      assert(block.parentHash === parentHash, 'parent hash does not match previous block');
      const transactionReceipt = await viem.getTransactionReceipt({
        hash: block.transactions[0].hash,
      })
      assert(block.hash === transactionReceipt.blockHash, 'transactionReceipt block hash and block hash does not match');
      assert(block.number === transactionReceipt.blockNumber, 'transactionReceipt block number and block number does not match');
      parentHash = block.hash;
      navBlock = navBlock + 1n;
    }
  });

});
