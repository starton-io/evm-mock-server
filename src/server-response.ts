import { FakeData, IncreaseType, ReplaceType, JSONRPC, RPCResponse } from "./type";
import { blockSeriesGenerate } from "./generate-data";

const timerList: Record<string, NodeJS.Timeout | undefined> = {};
const timer = (ms: number, fakeData: FakeData, url: string, incr: number) => setTimeout(() => {
  const blockNumber = fakeData.listBlock.list[fakeData.listBlock.index] ?? '0';
  fakeData.listBlock.index += incr;
  blockSeriesGenerate(blockNumber, fakeData);
  timerList[url] = undefined;
}, ms);

const changeIndex = (fakeData: FakeData, url: string) => {
  if (fakeData.listBlock.idxType === IncreaseType.NONE) {
    return;
  } else if (fakeData.listBlock.idxType === IncreaseType.SERIAL) {
    const blockNumber = fakeData.listBlock.list[fakeData.listBlock.index] ?? '0';
    fakeData.listBlock.index++;
    blockSeriesGenerate(blockNumber, fakeData);
  } else if (fakeData.listBlock.idxType === IncreaseType.TIME_BASED) {
    if (!timerList[url]) {
      const time = fakeData.listBlock.config?.ms ?? 1000;
      timerList[url] = timer(time, fakeData, url, 1);
    }
  }
}

export const getResponse = async (body: JSONRPC | undefined, data: Record<string, FakeData> | undefined, url: string): Promise<Object> => {
  if (body === undefined || data === undefined) {
    // fake data is initialised at the root of the server so it cant be unitialised
    throw new Error('Body request is not valid, received undefined');
  }
  const fakeData: FakeData | undefined = data[url];
  if (fakeData === undefined) {
    throw new Error('fakeData is not valid, received undefined');
  }
  const rpcData: RPCResponse = {
    "jsonrpc": "2.0",
    "id": body.id,
  }
  //console.log(data['eth_getBlockByNumber'][currentIndex]);
  //console.log(data['eth_getTransactionReceipt'][currentIndex]);
  switch (body.method) {
    case 'eth_getBlockByNumber':
      //{"jsonrpc":"2.0","id":111,"method":"eth_getBlockByNumber","params":["0x296d3b5",true]}
      let number = body.params[0];
      if (number === 'latest') {
        number = fakeData.listBlock.list[fakeData.listBlock.index];
      }
      if (typeof number === 'string') {
        const hash = fakeData.blockByNumber[number];
        rpcData.result = fakeData.block[hash ?? ''];
        if (fakeData.replaceType === ReplaceType.AFTER_FIRST_READ && fakeData.replaceBlock) {
          const existHash = fakeData.replaceBlock[number];
          if (existHash) {
            fakeData.blockByNumber[number] = existHash;
          }
        }
        changeIndex(fakeData, url);
      } else {
        rpcData.error = { code: '0', message: 'Number not correctly set' }
      }
      return rpcData;
    case 'eth_blockNumber':
      rpcData.result = fakeData.listBlock.list[fakeData.listBlock.index];
      changeIndex(fakeData, url);
      return rpcData;
    case 'eth_getTransactionReceipt':
      //{"jsonrpc":"2.0","id":147,"method":"eth_getTransactionReceipt","params":["0xce97011d4977ad8eec16b87bedefda436357734f9e39d8c3ce2d508af99d868d"]}
      const data = fakeData.receipts[body.params[0] as string];
      if (data !== null && data.code !== undefined) {
        rpcData.error = data;
      } else {
        rpcData.result = data;
      }
      return rpcData;
  }
  return '';
}
