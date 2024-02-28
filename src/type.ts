import { IncomingMessage } from "node:http";

export interface JSONRPC {
  jsonrpc: string,
  id: number,
  method: string,
  params: Array<string | boolean>
}

export interface ErrorExample {
  code: number;
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
  txModel?: string; // you can add model with evmCreateOrUpdateModel
  rcptModel?: string; // you can add model with evmCreateOrUpdateModel
  logModel?: string; // you can add model with evmCreateOrUpdateModel
  txHash?: string; // setup your own transaction hash if you want
  TxType: ItemType; // allow the server to add block information to transaction if needed
  RcptType: ItemType; // allow the server to add block information to receipt if needed
  LogType: ItemType; // allow the server to add block information to log if needed
}

export interface BlockConfig {
  blockModel?: string;
  hash?: string;
  txLength: number; // number of transaction in the block
  txConfig: Record<number, BaseConfig>; // hash value
}

export interface GenerateConfig {
  ms: number,
  generateIndex?: () => {};
}

export interface BlockNavigation {
  index: number;
  list: Array<string>;
  idxType: IncreaseType;
  indexDelay?: number;
}

export interface BlockGeneration {
  blockStartNumber: string; // The block number that will be converted to bigint and hexa later
  blockSeriesLength: number; // The number of blocks to generate
  blockInitParentHash?: string; // Initial parent hash for your first block
  block?: Record<string, BlockConfig>; // Specific configuration for each block, key is block number
}

export interface ServerHook {
  PreResponse?: (request: IncomingMessage, body: JSONRPC | Array<JSONRPC>, data?: FakeData) => Promise<void>;
}

/**
 * Called by the PUT method to create block series
 */
export interface FakeGeneration {
  initialSerie: BlockGeneration; // Generate a list of blocks based on configuration
  forkSerie?: BlockGeneration; // Generate blocks that will be swapped later as the main block

  forkType?: ReplaceType; // Option to determine how to base the swapped block when a fork occurs
  delayIndexMs?: number; // When calling the next block, allow the block index to change based on time
  increaseIndex?: number; // When calling the next block, set the next block number to be retrieved
  chainId?: number; // Specify a chainID otherwise will be 1
  debug?: boolean; // show console log to debug
}
/**
 * Data used by the server to reply to the web3 clients
 */
export interface FakeData {
  blocks: Record<string, any>,// Contains information about blocks <blockHash, blockData>
  transactions: Record<string, any>; // Stores details of transactions <txHash, txkData>
  receipts: Record<string, any>; // Holds receipt data <txHash, rcptData>
  blockByNumber: Record<string, string>; // Maps block numbers to their corresponding hashes
  replaceBlock?: Record<string, string>; // Used for simulating forks by replacing block hashes
  replaceType?: ReplaceType; // Indicates the type of replacement (e.g., after first read, after some time)
  blockNavigation: BlockNavigation; // Stores an array of block numbers and their index for simulating block retrieval
  chainId: string; // hexa value of the chainID
  debug: boolean; // activate debugging with console log
}
