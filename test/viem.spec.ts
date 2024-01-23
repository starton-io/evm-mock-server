import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import assert from 'node:assert';
import { BlockConfig, FakeGeneration, evmMockServer } from '../src/index';

const port = 55002;
let serverRpc: Server<typeof IncomingMessage, typeof ServerResponse> | null;
jest.setTimeout(100000)
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
    const parentHash = '0x4931cfdd7a421e7440d794fbad6a51623da3642f65a914ad74cbea5cb5445759'
    const response = await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify({
        initialSerie: {
            blockStartNumber: blockNumber,
            blockSeriesLength: 1,
            blockInitParentHash: parentHash,
        }
      })
    });
    await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    const lastBock = await viem.getBlockNumber();
    const block = await viem.getBlock({
      blockNumber: lastBock,
    })
    assert(BigInt(blockNumber) === lastBock, `Block number is incorrect, should be ${blockNumber} but is ${lastBock.toString()}`);
    assert(block.parentHash === parentHash, `Block number is incorrect, should be ${parentHash} but is ${block.parentHash}`);
  });

  test('Basic multicall', async () => {
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
    const blockGenerated = await response.json();
    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
      batch: {
        multicall: true
      },
    });
    const transactions = Object.keys(blockGenerated.transactions);
    const getReceipt = transactions.map((hash) => viem.getTransactionReceipt({
      hash: hash as `0x${string}`
    }))
    const rcpt = await Promise.all(getReceipt);
    assert(rcpt.length === transactions.length, `Receipt and transaction number do not match`);
  });
  
  test('Create more 100k tx and check first two blocks', async () => {
    const rpcUrl = `http://localhost:${port}/unique`;
    const blockNumber = '43439020';
    const blockSeriesLength = 100;
    const initialBlock: Record<string, BlockConfig> = {};
    let blockNumberBI = BigInt(blockNumber);
    for (let i = 0; i < blockSeriesLength; i++) {
      initialBlock[blockNumberBI.toString()] = {
        txLength: 1000,
        txConfig: {},
      }
      blockNumberBI = blockNumberBI + 1n;
    }
    const testBody: FakeGeneration = {
      initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength,
        block: initialBlock,
      },
      increaseIndex: 1,
      chainId: mainnet.id,
    }
    const response = await fetch(rpcUrl, {
      method: "PUT",
      body: JSON.stringify(testBody),
    });
    const blockGenerated = await response.json();
    assert(blockGenerated.warning === 'data is too large to stringify', 'should put a warning');

    const viem = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    const block = await viem.getBlock({
      blockTag: 'latest',
    });
    assert(block.number === BigInt(blockNumber), `First number should be ${blockNumber}`);
    assert(block.parentHash === '0x0000000000000000000000000000000000000000000000000000000000000000', `First parent hash should be hexa null`);
    const blockSecond = await viem.getBlock({
      blockTag: 'latest',
    });
    assert(blockSecond.number === BigInt(blockNumber) + 1n, `First number should be ${blockNumber + 1n}`);
    assert(blockSecond.parentHash === block.hash, `First parent hash should be ${block.hash}`);
  });
});
