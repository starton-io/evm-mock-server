import { intToHex, randomHash } from './utils';
import { BaseConfig, BlockConfig, BlockGeneration, BlockModel, FakeData, ItemType, LogsModel, ReceiptModel, TransactionModel } from './type';
import singleBlock from "./models/singleBlock.json";
import singleTransaction from "./models/singleTransaction.json";
import singleReceipt from "./models/singleReceipt.json";
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

/**
 * Generate the fake data that will be used by the server. This can be serialised in a json file and changed by hand later
 * to better suit some specific scenarios.
 * TODO: once all test are valid and use case are made refactor this function as most of the code is often the same
 * @param fakeData fake data that is created in the calling function
 * @param generate configuration element to create a block serie
 * @param isPrimary allow us to know if its the initial blockchain so we dont add fork element yet
 * @returns Recor<string, string> - Object with hexBlockNumber and hash so we can replace them after fork happens
 */
export const generateFakeData = (fakeData: FakeData, dataConfig: BlockGeneration, isPrimary: boolean): Record<string, string> => {
  const blockList: Record<string, string> = {};
  let blockNumber = BigInt(dataConfig.blockStartNumber);
  let i = 0;
  let blockParentHash = dataConfig.blockInitParentHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000';
  while (i < dataConfig.blockSeriesLength) {
    const number = blockNumber.toString()
    const blockHexNumber = intToHex(blockNumber);
    const blockConfig: BlockConfig | undefined = dataConfig.block && dataConfig.block[number];
    const blockItem = getBlockModel(blockConfig?.blockModel);
    blockItem.number = blockHexNumber;
    blockItem.hash = blockConfig?.hash ?? randomHash();
    blockList[blockHexNumber] = blockItem.hash;
    blockItem.parentHash = blockParentHash;
    if (blockConfig) {
      blockItem.transactions = [];
      for (let txIdx = 0; txIdx < blockConfig.txLength; txIdx++) {
        const config: BaseConfig | undefined = blockConfig.txConfig[txIdx];
        if (config) {
          // we have a configuration for the transaction
          const txItem = getTransactionModel(config.txModel);
          if (config.TxType === ItemType.VALID_ITEM) {
            txItem.hash = config.txHash ?? randomHash();
            txItem.blockHash = blockItem.hash;
            txItem.blockNumber = blockHexNumber;
            txItem.transactionIndex = intToHex(txIdx);
            const rcptItem = getReceiptModel(config.rcptModel);
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
          const txItem = {...singleTransaction};
          txItem.hash = randomHash();
          txItem.blockHash = blockItem.hash;
          txItem.blockNumber = blockHexNumber;
          txItem.transactionIndex = intToHex(txIdx);
          const rcptItem = getReceiptModel();
          rcptItem.blockNumber = blockHexNumber;
          rcptItem.blockHash = blockItem.hash;
          rcptItem.transactionHash = txItem.hash;
          rcptItem.transactionIndex = txItem.transactionIndex;
          rcptItem.logs = rcptItem.logs.map((rcpt: ReceiptModel) => {
            rcpt.blockNumber = blockHexNumber;
            rcpt.blockHash = blockItem.hash;
            rcpt.transactionHash = txItem.hash;
            rcpt.transactionIndex = txItem.transactionIndex;
            return rcpt;
          });
          blockItem.transactions.push(txItem);
          fakeData.transactions[txItem.hash] = txItem;
          fakeData.receipts[txItem.hash] = rcptItem;
        }
      }
    } else {
      const rcptItem = getReceiptModel();
      blockItem.transactions = blockItem.transactions.map((transaction) => {
        transaction.hash = randomHash();
        transaction.blockHash = blockItem.hash;
        transaction.blockNumber = blockHexNumber;
        fakeData.transactions[transaction.hash] = transaction; // this is not used at the moment
        const receipt = {
          ...rcptItem,
          blockNumber: blockHexNumber,
          blockHash: blockItem.hash,
          transactionHash: transaction.hash,
          transactionIndex: transaction.transactionIndex,
        };
        receipt.logs = receipt.logs.map((rcpt: ReceiptModel) => {
          rcpt.blockNumber = blockHexNumber;
          rcpt.blockHash = blockItem.hash;
          rcpt.transactionHash = transaction.hash;
          rcpt.transactionIndex = transaction.transactionIndex;
          return rcpt;
        })
        fakeData.receipts[transaction.hash] = receipt;
        return transaction;
      });

    }
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
export const blockSeriesGenerate = (oldNumber: string, fakeData: FakeData) => {
  if (!fakeData.blockNavigation.list[fakeData.blockNavigation.index]) {
    const nextNumber = BigInt(oldNumber) + 1n;
    const blockHexNumber = intToHex(nextNumber);
    const blockItem = getBlockModel();
    blockItem.number = blockHexNumber;
    blockItem.hash = randomHash();
    fakeData.blockByNumber[blockHexNumber] = blockItem.hash;
    blockItem.parentHash = fakeData.blockByNumber[oldNumber] ?? '0x0000000000000000000000000000000000000000000000000000000000000000';
    const rcptItem = getReceiptModel();
    blockItem.transactions = blockItem.transactions.map((transaction) => {
      transaction.hash = randomHash();
      transaction.blockHash = blockItem.hash;
      transaction.blockNumber = blockHexNumber;
      fakeData.transactions[transaction.hash] = transaction; // this is not used at the moment
      const receipt = {
        ...rcptItem,
        blockNumber: blockHexNumber,
        blockHash: blockItem.hash,
        transactionHash: transaction.hash,
        transactionIndex: transaction.transactionIndex,
      };
      receipt.logs = receipt.logs.map((rcpt: ReceiptModel) => {
        rcpt.blockNumber = blockHexNumber;
        rcpt.blockHash = blockItem.hash;
        rcpt.transactionHash = transaction.hash;
        rcpt.transactionIndex = transaction.transactionIndex;
        return rcpt;
      })
      fakeData.receipts[transaction.hash] = receipt;
      return transaction;
    });
    fakeData.blocks[blockItem.hash] = blockItem;
    fakeData.blockNavigation.list.push(blockHexNumber);
  }
}
