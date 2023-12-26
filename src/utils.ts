import crypto from "crypto";

export const randomHash = () => (`0x${crypto.randomBytes(32).toString("hex")}`);
export const stringNumberToHex = (number: string) => `0x${BigInt(number).toString(16)}`;
export const bigIntToHex = (number: bigint) => `0x${number.toString(16)}`;
export const numberToHex = (number: number) => `0x${number.toString(16)}`;
