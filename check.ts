import { Block } from '@ethereumjs/block'
import { TransactionFactory } from '@ethereumjs/tx'
import { Blockchain } from '@ethereumjs/blockchain'
import { Common, CustomChain } from '@ethereumjs/common'
import { Trie } from '@ethereumjs/trie'
import { VM } from '@ethereumjs/vm'
import { privateToPublic, publicToAddress, Address, Account, bytesToHex, intToHex } from '@ethereumjs/util'
import { randomBytes } from 'crypto'
import { time } from 'console'

(BigInt.prototype as any).toJSON = function() {
  return this.toString()
}

const accounts = {};
const createAccount = () => {
  const privateKey = randomBytes(32);
  const publicKey = privateToPublic(privateKey)
  const pubAddr = publicToAddress(publicKey)
  const address = new Address(pubAddr)
  const details = new Account(BigInt(0), BigInt(530100001330000000000000))
  return { privateKey, publicKey, address, details }
}

async function createBlocks() {
  //const timeStart = 1681338455 - 17200;
  //console.log(new Date(1681338455 * 1000).toISOString())
  let timestamp = Math.floor((Date.now() -25303914000) / 1000);
  console.log(timestamp);
  const numTx = 10;
  
  const common = Common.custom({
    chainId: 1,
    networkId: 1,
    genesis: {
      gasLimit: 21000 * numTx,//'0x5208',
      difficulty: '0x0',
      timestamp: intToHex(timestamp),
      extraData: '0x',
      nonce: '0x0000000000000042',
    }
  })
  /*console.log(common.hardforkTimestamp())
  timestamp = Number(common.hardforkTimestamp());

  console.log(timestamp)*/
  //return
  common.setEIPs([1559,4895]);
  const blockchain = await Blockchain.create({ common })
  const vm = await VM.create({ common, blockchain })
  await vm.stateManager.checkpoint()
  const account = createAccount();
  vm.stateManager.putAccount(account.address, account.details)
  await vm.stateManager.commit()
  

  //let timestamp = Math.floor(Date.now() / 1000)
  let lastBlock = common.genesis()
  let lastHash = blockchain.genesisBlock.hash();
  for (let i = 1; i < numTx; i++) {
    const transactions: any = [];
    //if (i !== 0) {
      for (let j = 0; j < 6; j++, account.details.nonce++) {
        const txData = {
          "accessList": [],
          from: account.address.toString(),
          "gasLimit": 21000,
          "gasPrice": "0x5804253a",
          "input": "0x",
          "maxFeePerGas": "0x5804253a",
          "maxPriorityFeePerGas": "0x5804252a",
          "nonce": account.details.nonce,
          "to": "0x38a50480fdd3d612c5f5f86dd0a81d4b73555391",
          "transactionIndex": j,
          "type": "0x2",
          "value": "0x1402462f6000"
        }
        const tx = TransactionFactory.fromTxData(txData, { common })
        const signedTx = tx.sign(account.privateKey);
        transactions.push(signedTx)
        console.log(bytesToHex(signedTx.hash()));
        console.log(signedTx.toJSON());
      }  
    //}
    const trie = await Block.genTransactionsTrieRoot(transactions, new Trie());
    timestamp += 5;
    const blockData = {
      header: {
        number: i,
        timestamp: intToHex(timestamp),
        gasLimit: 21000 * numTx,
        parentHash: lastHash,
        baseFeePerGas: lastBlock.baseFeePerGas,
        transactionsTrie: trie,
      },
      transactions,
    }
    
    const block = Block.fromBlockData(blockData, { common })
    console.log(JSON.stringify(block.toJSON(), null, 2));
    //const trie = await Block.genTransactionsTrieRoot(transactions, new Trie());
    console.log(bytesToHex(trie))
    const bl = block.toJSON()
    if (bl.header?.transactionsTrie) {
      console.log(bl.header?.transactionsTrie)
    }
    console.log('test '+ i);
    await blockchain.putBlock(block)
    lastHash = block.hash();
    const result = await vm.runBlock({ block, generate: true })
    // Display the block, transactions, and receipts in JSON format
    console.log(JSON.stringify(block.toJSON(), null, 2))
    transactions.forEach((tx: any) => console.log(JSON.stringify(tx.toJSON(), null, 2)))
    result.receipts.forEach((receipt: any) => console.log(JSON.stringify(receipt, null, 2)))
  }
}

createBlocks().catch(console.error)