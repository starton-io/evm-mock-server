import { Block } from '@ethereumjs/block';
import { TransactionFactory } from '@ethereumjs/tx';
import { Common } from '@ethereumjs/common';
import { privateToPublic, publicToAddress, Address, Account, bytesToHex } from '@ethereumjs/util';
import { intToHex, randomHash } from './utils';
import { BaseConfig, BlockConfig, BlockGeneration, BlockModel, FakeData, ItemType, LogsModel, ReceiptModel, TransactionModel } from './type';
import singleBlock from "./models/singleBlock.json";
import singleTransaction from "./models/singleTransaction.json";
import singleReceipt from "./models/singleReceipt.json";
import { randomBytes } from 'crypto';
import { Trie } from '@ethereumjs/trie';
//import singleLog from "./models/singleLog.json";

const ItemModels: Record<string, any> = {
  'default:block': singleBlock,
  'default:transaction': singleTransaction,
  'default:receipt': singleReceipt,
  'error:notFound': null,
  'error:hash': {
    "code": -32602,
    "message": "invalid 1st argument: transaction_hash value was too short"
  }
}

const getBlockModel = (blockModel?: string): BlockModel => {
  if (blockModel) {
    return (ItemModels[blockModel]) ? {...ItemModels[blockModel]} : null;
  }
  return {...ItemModels['default:block']};
}

const getTransactionModel = (transactionModel?: string): TransactionModel | any => {
  if (transactionModel) {
    return (ItemModels[transactionModel]) ? {...ItemModels[transactionModel]} : null;
  }
  return {...ItemModels['default:transaction']};
}

const getReceiptModel = (receiptModel?: string): ReceiptModel | any => {
  if (receiptModel) {
    return (ItemModels[receiptModel]) ? {...ItemModels[receiptModel]} : null;
  }
  return {...ItemModels['default:receipt']};
}

/**
 * This allow you to set some body for the model you will create in the data generator.
 * A few set of basic models exist but if you want to customise them or send different data you can just
 * call this function and add a new model.
 * Currently used by the interface BaseConfig that is part of the FakeGeneration interface
 * @param key keys used by the models for block, transaction...
 * @param data 
 */
export const evmCreateOrUpdateModel = (key: string, data: any) => {
  ItemModels[key] = data;
}

/**
 * Return the item model from the key passed
 * @param key 
 * @returns 
 */
export const evmGetModel = (key: string) => {
  return ItemModels[key];
}

interface TestAccount {
  privateKey: Buffer;
  publicKey: Uint8Array;
  address: Address;
  details: Account;
}

const accounts: Record<string, TestAccount> = {};
const createAccount = () => {
  const privateKey = randomBytes(32);
  const publicKey = privateToPublic(privateKey);
  const pubAddr = publicToAddress(publicKey);
  const address = new Address(pubAddr);
  const details = new Account(BigInt(0), BigInt(100000000));
  return { privateKey, publicKey, address, details }
}

const createTx = (tx: TransactionModel, common: Common) => {
  if (!accounts[tx.from]) {
    accounts[tx.from] = createAccount();
  }
  const txData = {
    "accessList": [],
    from: accounts[tx.from].address.toString(),
    "gasLimit": tx.gas,
    "gasPrice": "0x5804253a",
    "input": "0x",
    "maxFeePerGas": "0x5804253a",
    "maxPriorityFeePerGas": "0x5804252a",
    "nonce": accounts[tx.from].details.nonce++,
    to: tx.to,
    "transactionIndex": tx.transactionIndex,
    "type": tx.type,
    "value": tx.value
  };
  const txFactory = TransactionFactory.fromTxData(txData, { common });
  const signedTx = txFactory.sign(accounts[tx.from].privateKey);
  const serialised = signedTx.toJSON();
  return {
    txRawData: {
      ...tx,
      v: serialised.v,
      r: serialised.r, 
      s: serialised.s, 
      from: accounts[tx.from].address.toString(),
      //hash: bytesToHex(signedTx.hash()),
      nonce: intToHex(signedTx.nonce)  
    },
    txSigned: signedTx,
  }
}

/**
 * Generate the fake data that will be used by the server. This can be serialised in a json file and changed by hand later
 * to better suit some specific scenarios.
 * TODO: once all test are valid and use case are made refactor this function as most of the code is often the same
 * @param fakeData fake data that is created in the calling function
 * @param generate configuration element to create a block serie
 * @param isPrimary allow us to know if its the initial blockchain so we dont add fork element yet
 * @returns Recor<string, string> - Object with hexBlockNumber and hash so we can replace them after fork happens
 */
export const generateFakeData = async (fakeData: FakeData, dataConfig: BlockGeneration, isPrimary: boolean): Promise<Record<string, string>> => {
  // check fakeId
  const common = Common.custom({
    chainId: BigInt(fakeData.chainId),
    networkId: BigInt(fakeData.chainId),
  });
  common.setEIPs([1559])
  const blockList: Record<string, string> = {};
  let blockNumber = BigInt(dataConfig.blockStartNumber);
  let i = 0;
  let blockParentHash = dataConfig.blockInitParentHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000';
  if (isPrimary === false && blockParentHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    // should get the parentHash of the valid block?
    const previousBlockNumber = blockNumber - 1n;
    const lastBlockHash = fakeData.blockByNumber[intToHex(previousBlockNumber)];
    if (lastBlockHash) {
      blockParentHash = fakeData.blocks[lastBlockHash].hash;
    }
  }
  while (i < dataConfig.blockSeriesLength) {
    const number = blockNumber.toString()
    const blockHexNumber = intToHex(blockNumber);
    const blockConfig: BlockConfig | undefined = dataConfig.block && dataConfig.block[number];
    const blockItem = getBlockModel(blockConfig?.blockModel);
    blockItem.number = blockHexNumber;
    blockItem.hash = blockConfig?.hash ?? randomHash();
    blockList[blockHexNumber] = blockItem.hash;
    blockItem.parentHash = blockParentHash;
    const trieTransaction = [];
    if (blockConfig) {
      blockItem.transactions = [];
      for (let txIdx = 0; txIdx < blockConfig.txLength; txIdx++) {
        const config: BaseConfig | undefined = blockConfig.txConfig[txIdx];
        if (config) {
          // we have a configuration for the transaction
          let txItem = getTransactionModel(config.txModel);
          if (config.TxType === ItemType.VALID_ITEM) {
            txItem.hash = config.txHash ?? randomHash();
            txItem.blockHash = blockItem.hash;
            txItem.blockNumber = blockHexNumber;
            txItem.transactionIndex = intToHex(txIdx);
            const { txRawData, txSigned } = createTx(txItem, common);
            txItem = txRawData;
            const rcptItem = getReceiptModel(config.rcptModel);
            trieTransaction.push(txSigned);
            if (config.RcptType === ItemType.VALID_ITEM) {
              rcptItem.blockNumber = blockHexNumber;
              rcptItem.blockHash = blockItem.hash;
              rcptItem.transactionHash = txItem.hash;
              rcptItem.transactionIndex = txItem.transactionIndex;
              // check for new error items
              rcptItem.logs = rcptItem.logs.map((rcpt: LogsModel) => {
                rcpt.blockNumber = blockHexNumber;
                rcpt.blockHash = blockItem.hash;
                rcpt.transactionHash = txItem.hash;
                rcpt.transactionIndex = txItem.transactionIndex;
                return rcpt;
              });
            }
            fakeData.receipts[txItem.hash] = rcptItem;
          } else if (config.TxType === ItemType.ERROR_GENERATE_HASH) {
            txItem.hash = config.txHash ?? randomHash();
          }
          blockItem.transactions.push(txItem);
          fakeData.transactions[txItem.hash] = txItem;
        } else {
          // we use a basic transaction model
          const txModel = {...singleTransaction};
          txModel.hash = randomHash();
          txModel.blockHash = blockItem.hash;
          txModel.blockNumber = blockHexNumber;
          txModel.transactionIndex = intToHex(txIdx);
          const { txRawData, txSigned } = createTx(txModel, common);
          const rcptItem = getReceiptModel();
          rcptItem.blockNumber = blockHexNumber;
          rcptItem.blockHash = blockItem.hash;
          rcptItem.transactionHash = txRawData.hash;
          rcptItem.transactionIndex = txRawData.transactionIndex;
          rcptItem.logs = rcptItem.logs.map((rcpt: ReceiptModel) => {
            rcpt.blockNumber = blockHexNumber;
            rcpt.blockHash = blockItem.hash;
            rcpt.transactionHash = txRawData.hash;
            rcpt.transactionIndex = txRawData.transactionIndex;
            return rcpt;
          });
          blockItem.transactions.push(txRawData);
          trieTransaction.push(txSigned);
          fakeData.transactions[txRawData.hash] = txRawData;
          fakeData.receipts[txRawData.hash] = rcptItem;
        }
      }
    } else {
      const rcptItem = getReceiptModel();
      blockItem.transactions = blockItem.transactions.map((transaction) => {
        transaction.hash = randomHash();
        transaction.blockHash = blockItem.hash;
        transaction.blockNumber = blockHexNumber;
        fakeData.transactions[transaction.hash] = transaction; // this is not used at the moment
        const { txRawData, txSigned } = createTx(transaction, common);
        trieTransaction.push(txSigned);
        const receipt = {
          ...rcptItem,
          blockNumber: blockHexNumber,
          blockHash: blockItem.hash,
          transactionHash: txRawData.hash,
          transactionIndex: txRawData.transactionIndex,
        };
        receipt.logs = receipt.logs.map((rcpt: ReceiptModel) => {
          rcpt.blockNumber = blockHexNumber;
          rcpt.blockHash = blockItem.hash;
          rcpt.transactionHash = txRawData.hash;
          rcpt.transactionIndex = txRawData.transactionIndex;
          return rcpt;
        })
        fakeData.receipts[txRawData.hash] = receipt;
        return txRawData;
      });

    }
    // calculate trie
    const trie = await Block.genTransactionsTrieRoot(trieTransaction, new Trie());
    blockItem.transactionsRoot = bytesToHex(trie);
    fakeData.blocks[blockItem.hash] = blockItem;
    blockParentHash = blockItem.hash;
    if (isPrimary) { // the primary range should have the most blocks and be the one listed
      fakeData.blockNavigation.list.push(blockHexNumber);// allow the server to increment the search by number
      fakeData.blockByNumber[blockHexNumber] = blockItem.hash; // used to target the correct "branch" of blocks
    }
    blockNumber = blockNumber + 1n;
    i++;
  }
  return (blockList);
}

/**
 * Create a new valid block with a previous block existing
 * TODO: refactor with generateFakeData after we find options we could use
 */
export const blockSeriesGenerate = async (oldNumber: string, fakeData: FakeData) => {
  if (!fakeData.blockNavigation.list[fakeData.blockNavigation.index]) {
    const common = Common.custom({
      chainId: BigInt(fakeData.chainId),
      networkId: BigInt(fakeData.chainId),
    });
    common.setEIPs([1559])
    const nextNumber = BigInt(oldNumber) + 1n;
    const blockHexNumber = intToHex(nextNumber);
    const blockItem = getBlockModel();
    blockItem.number = blockHexNumber;
    blockItem.hash = randomHash();
    fakeData.blockByNumber[blockHexNumber] = blockItem.hash;
    blockItem.parentHash = fakeData.blockByNumber[oldNumber] ?? '0x0000000000000000000000000000000000000000000000000000000000000000';
    const rcptItem = getReceiptModel();
    const trieTransaction: Array<any> = [];
    blockItem.transactions = blockItem.transactions.map((transaction) => {
      transaction.hash = randomHash();
      transaction.blockHash = blockItem.hash;
      transaction.blockNumber = blockHexNumber;
      const { txRawData, txSigned } = createTx(transaction, common);
      fakeData.transactions[transaction.hash] = txRawData; // this is not used at the moment
      trieTransaction.push(txSigned);
      const receipt = {
        ...rcptItem,
        blockNumber: blockHexNumber,
        blockHash: blockItem.hash,
        transactionHash: txRawData.hash,
        transactionIndex: txRawData.transactionIndex,
      };
      receipt.logs = receipt.logs.map((rcpt: ReceiptModel) => {
        rcpt.blockNumber = blockHexNumber;
        rcpt.blockHash = blockItem.hash;
        rcpt.transactionHash = txRawData.hash;
        rcpt.transactionIndex = txRawData.transactionIndex;
        return rcpt;
      })
      fakeData.receipts[txRawData.hash] = receipt;
      return txRawData;
    });
    const trie = await Block.genTransactionsTrieRoot(trieTransaction, new Trie());
    blockItem.transactionsRoot = bytesToHex(trie);
    fakeData.blocks[blockItem.hash] = blockItem;
    fakeData.blockNavigation.list.push(blockHexNumber);
  }
}
