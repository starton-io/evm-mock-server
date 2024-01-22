import { evmMockServer, FakeGeneration, BlockConfig } from './src/index';
import { 
  arbitrum,
  arbitrumGoerli,
  polygon,
  polygonMumbai,
  polygonZkEvm,
  polygonZkEvmTestnet,
  avalanche,
  avalancheFuji,
  astar,
  fantom,
  fantomTestnet,
  bsc,
  bscTestnet,
  mainnet,
  goerli,
} from 'viem/chains';

const blockNumber = '43539309';

const blockSeriesLength = 100;
const initialBlock: Record<string, BlockConfig> = {};
let blockNumberBI = BigInt(blockNumber);
for (let i = 0; i < blockSeriesLength; i++) {
  initialBlock[blockNumberBI.toString()] = {
    txLength: 15,
    txConfig: {},
  }
  blockNumberBI = blockNumberBI + 1n;
}

const listEVM = [
  arbitrum,
  arbitrumGoerli,
  polygon,
  polygonMumbai,
  polygonZkEvm,
  polygonZkEvmTestnet,
  avalanche,
  avalancheFuji,
  astar,
  fantom,
  fantomTestnet,
  bsc,
  bscTestnet,
  mainnet,
  goerli,
];

const port = 55001;
//http://localhost:55001/unique
const main = async () => {
  const rpcBase = `http://localhost:${port}`

  await evmMockServer(port);
  listEVM.map(async (evm) => {
    const url = `${rpcBase}/${evm.name.toLowerCase().replace(/ /g, '-')}`;
    const testBody: FakeGeneration = {
      initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength,
        block: initialBlock,
        blockInitParentHash: '0x4931cfdd7a421e7440d794fbad6a51623da3642f65a914ad74cbea5cb5445759',
      },
      increaseIndex: 1,
      chainId: evm.id,
    }
    await fetch(url, {
      method: "PUT",
      body: JSON.stringify(testBody),
    });
    console.log(url.replace('localhost', 'host.docker.internal'));
  })

}
main();
