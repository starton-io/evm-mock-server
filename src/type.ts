export interface JSONRPC {
  jsonrpc: string,
  id: number,
  method: string,
  params: Array<string | boolean>
}

export interface ErrorExample {
  code: string;
  message: string;
}

export interface RPCResponse {
  jsonrpc: string;
  id: number;
  result?: any; // replace with T and list answers
  error?: ErrorExample;
}

export enum ReplaceType {
  AFTER_FIRST_READ = 0,
  TIME_BASED,
}
export enum IncreaseType {
  NONE = 0,
  SERIAL, // we just increment by one
  TIME_BASED, // we increment in ms found in the cfg
}

export enum ItemType {
  VALID_ITEM = 0,
  ERROR_GENERATE_HASH,
  ERROR_ITEM,
}

export interface BlockModel {
  number: string;
  hash: string;
  parentHash: string;
  transactions: TransactionModel[];
  [key: string]: any;
}

export interface TransactionModel {
  blockNumber: string;
  blockHash: string;
  hash: string;
  transactionIndex: string;
  [key: string]: any;
}

export interface LogsModel {
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  [key: string]: any;
}

export interface ReceiptModel {
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logs: LogsModel[];
  [key: string]: any;
}

export interface BaseConfig {
  txModel?: string;
  rcptModel?: string;
  logModel?: string;
  txHash?: string;
  TxType: ItemType;
  RcptType: ItemType;
  LogType: ItemType;
}

export interface BlockConfig {
  blockModel?: string;
  hash?: string;
  txLength: number; // number of transaction in the block
  txConfig: Record<number, BaseConfig>; // hash value
}

export interface BlockGeneration {
  blockStartNumber: string;
  blockSeriesLength: number;
  blockStartHash?: string;
  block?: Record<string, BlockConfig>;
}

// replace function
// replace with number of the block and the new value
export interface SingleBlockData {
  block: Record<string, any>,
  transactions: Record<string, any>,
  receipts: Record<string, any>,
}

export interface GenerateConfig {
  ms: number,
  generateIndex?: () => {};
}

export interface ListBlock {
  index: number;
  list: Array<string>;
  idxType: IncreaseType;
  config?: GenerateConfig;
}

/**
 * Called by the PUT method in order to create block series
 */
export interface FakeGeneration {
  initialSerie: BlockGeneration;
  forkSerie?: BlockGeneration;

  forkType?: ReplaceType;
  delayIndexMs?: number;
  increaseIndex?: number;
  blokcIndexCfg?: GenerateConfig;
}

/**
 * Data used by the server to reply to the web3 clients
 */
export interface FakeData {
  block: Record<string, any>,// Contains information about blocks <blockHash, blockData>
  transactions: Record<string, any>; // Stores details of transactions <txHash, txkData>
  receipts: Record<string, any>; // Holds receipt data <txHash, rcptData>
  blockByNumber: Record<string, string>; // Maps block numbers to their corresponding hashes
  replaceBlock?: Record<string, string>; // Used for simulating forks by replacing block hashes
  replaceType?: ReplaceType; // Indicates the type of replacement (e.g., after first read, after some time)
  listBlock: ListBlock; // Stores an array of block numbers and their index for simulating block creation
}
