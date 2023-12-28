![Starton Banner](https://github.com/starton-io/.github/blob/master/github-banner.jpg?raw=true)

# EvmMockServer

EvmMockServer is a tool designed to simulate real-world blockchain environments. It's currently a work in progress, crafted to replicate challenging scenarios such as high transaction traffic, slow node responses, and, most importantly, forks in the blockchain.

You can seamlessly integrate EvmMockServer with projects like etherjs, viem, or other libraries from different programming languages.

## Requirements

You will need :
- [NodeJS](https://nodejs.org/en) (we recommend the use of [nvm](https://github.com/nvm-sh/nvm))

## Installation

To install the project, first clone the repository and go inside project directory, then :

- With [yarn](https://yarnpkg.com/) :
    ```bash
    $ yarn install
    ```

- With [NPM](https://www.npmjs.com/) :
    ```bash
    $ npm install
    ```

## Run Locally

Your project is now ready to be modified by you, for that you just have to launch the server via the command below:

- With [yarn](https://yarnpkg.com/) :
    ```bash
    $ yarn dev
    ```

- With [NPM](https://www.npmjs.com/) :
    ```bash
    $ npm run dev
    ```

## Usage

EvmMockServer is built to help you create simple blockchain scenarios, ensuring that the web3 systems you develop are stable and robust against errors that may occur in real-world situations.

To provide maximum flexibility, we've divided our mock system into two essential components:

### 1. Data Generator

Create simple blockchain scenarios that you can store in JSON format and modify independently. This allows you to generate pre-made fixtures for your tests, ensuring that you have fixed test data to validate every aspect of your application.

In this part we will see how to create two very basic scenario with a block that is valid, then a scenario where the block on the first read has an invalid receipt and get replaced by one with a valid receipt. The exemples are based on this structure
```Typescript
interface BlockGeneration {
  blockStartNumber: string; // The block number that will be converted to bigint and hexa later
  blockSeriesLength: number; // The number of blocks to generate
  blockInitParentHash?: string; // Initial parent hash for your first block
  block?: Record<string, BlockConfig>; // Specific configuration for each block, key is block number
}

interface FakeGeneration {
  initialSerie: BlockGeneration; // Generate a list of blocks based on configuration
  forkSerie?: BlockGeneration; // Generate blocks that will be swapped later as the main block

  forkType?: ReplaceType; // Option to determine how to base the swapped block when a fork occurs
  delayIndexMs?: number; // When calling the next block, allow the block index to change based on time
  increaseIndex?: number; // When calling the next block, set the next block number to be retrieved
}
```

You will also have the option to create models to represent your block, transaction, receipt or log. This is useful to simulate errors that the server could send. You can use those function to create a new structure for example
```Typescript
import rpcServer, { evmCreateOrUpdateModel, evmGetModel } from '@starton/evm-mock-server';
const block = evmGetModel('default:block');
console.log(block); // display the basic block structure with data inside. model based on plygon block
const newModel = '{ "number": "0x0000" }';
evmCreateOrUpdateModel("custom:test", newModel); // this will create a new model that you can use
// an exemple of already existing model used can be found in the second exemple below
```


  1. Exemple of a simple block with fixture file created

```Typescript
import rpcServer from '@starton/evm-mock-server';
import { writeFile } from 'node:fs';
const rpcUrl = 'http://localhost:55001/unique';
const blockNumber = '43439028';
// no need to create a new data for this, we use basic model so all is known in advance
const response = await fetch(rpcUrl, {
  method: "PUT",
  body: JSON.stringify({
    initialSerie: {
        blockStartNumber: blockNumber,
        blockSeriesLength: 1
    }
  })
})
writeFile('./fixture-simple.json', JSON.stringify((await response.json()), null, 2), (error) => {
  if (error) {
    console.log('An error has occurred ', error);
    return;
  }
  console.log('Data written successfully to disk');
});
```

  2. Example with a fork occuring after the first block is called and read

```Typescript
import rpcServer, { evmMockUtils } from '@starton/evm-mock-server';
const rpcUrl = 'http://localhost:55001/unique';
const blockNumber = '43439028';
// this generate hash with default length found in blocks and transactions
const forkedHash = evmMockUtils.randomHash();
const validHash = evmMockUtils.randomHash();
const testBody: FakeGeneration = {
  initialSerie: {
    blockStartNumber: blockNumber,
    blockSeriesLength: 1,
    block: {
      // here we put the number of the block we want to customize and information related to it
      [blockNumber]: {
        hash: forkedHash,
        txLength: 6,
        txConfig: {
          // this index represent the transactionIndex in the block
          1: {
            // models can be customized, you can see the documentation further down about it
            rcptModel: 'error:notFound',
            TxType: ItemType.VALID_ITEM,
            RcptType: ItemType.ERROR_ITEM,
            LogType: ItemType.VALID_ITEM,
          }
        },
      }
    }
  },
  forkSerie: {
    blockStartNumber: blockNumber,
    blockSeriesLength: 1,
    block: {
      [blockNumber]: {
      hash: validHash,
      txLength: 6,
      txConfig: {}, // will create only valid item
      }
    }
  },
}
await fetch(rpcUrl, {
  method: "PUT",
  body: JSON.stringify(testBody),
})
```

### 2. HTTP Server

The core of the service, the HTTP server reads the data previously generated and sends it back according to basic configurations you provide during creation. We've kept the structure as simple as possible, opting to split the fake data you create by URL. This approach enables multiple scenarios based on the URL you call, facilitating concurrent testing.

In order to start your server you will need to call the default exported function as shown in the exemple below, we also added a hook exemple if you want to create delays or other things, but it is not mandatory!
```Typescript
import rpcServer, { evmMockUtils } from '@starton/evm-mock-server';
// start a simple server
serverRpc = await rpcServer(55001);

// start a server and whenever a client call the endpoint /unique, delay the answer for 1000ms
// It might help you debug the data you send to the server as well
serverRpc = await rpcServer(55001, {
  PreResponse: async (request: IncomingMessage, body: JSONRPC | JSONRPC[], data?: FakeData) => {
    if (request.url === '/unique') {
      console.log('in unique call ', body)
      await evmMockUtils.waitFor(1000);
    }
  }
})
```

The http server simulate RPC method with the POST method, once a method is called on a url. It also handle multicall if you pass all your calls as array
The heart of this part is the function `getResponse` found in `server-response.ts`

This part rely on a few variables present in the fakeData interface.
```Typescript
interface FakeData {
  blocks: Record<string, any>,// Contains information about blocks <blockHash, blockData>
  transactions: Record<string, any>; // Stores details of transactions <txHash, txkData>
  receipts: Record<string, any>; // Holds receipt data <txHash, rcptData>
  blockByNumber: Record<string, string>; // Maps block numbers to their corresponding hashes
  replaceBlock?: Record<string, string>; // Used for simulating forks by replacing block hashes
  replaceType?: ReplaceType; // Indicates the type of replacement (e.g., after first read, after some time)
  blockNavigation: BlockNavigation; // Stores an array of block numbers and their index for simulating block retrieval
}
```
For the server part those are important to keep in mind
- `fakeData.listBlock.list` this is an array containing the list of block by number, its used when we try to get the last block number or we try to recover the latest block. We use this with the `fakeData.listBlock.index` in order to simulate the block creating new blocks.
- `fakeData.blockByNumber` the key is the block number and the value is the hash that will be displayed. The server use this to get the current block where it is suppose to be at. When we simulate a fork we just switch the hash with the one we added in `fakeData.replaceBlock`. This allow use to have the server call a different block by hash so it simulate a different "path" thanks to the parentHash and the hash itself being changed

In both part we wont create extensive error check because we are creating test data which can be manually tweaked if necessary and might complexify the code. The purpose of this server being only to test we don't need strict data control. This server should also never be in any production environement but just in case we still want to keep the dependencies as small as possible to avoid any unnecessary vulnerabilities with packages becoming obsolete

## Blockchain Help and Information

If you are interested in how Starton can assist you in building your web3 universe, head to our [documentation](https://docs.starton.com/).

## Contributing

Feel free to explore, contribute, and shape the future of EvmMockServer with us! Your feedback and collaboration are invaluable as we continue to refine and enhance this tool.

To get started, see [CONTRIBUTING.md](./CONTRIBUTING.md).

Please adhere to Starton's [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

EvmMockServer is licensed under the [Apache License 2.0](./LICENSE.md).


## Authors

- Starton: [support@starton.com](mailto:support@starton.com)
- Hassan Allybocus