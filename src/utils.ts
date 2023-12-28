import crypto from "crypto";

/**
 * Generate a hash that is 32 char long by default
 * @param length length of the hash without counting the 0x
 * @returns hash in the form of 0x.....
 */
export const randomHash = (length: number = 32) => (`0x${crypto.randomBytes(length).toString("hex")}`);
/**
 * Convert a bigint in string form (usually due to JSON serialisation) to a hexadecimal string
 * @param number string to convert
 * @returns string in hexadecimal format
 */
export const stringNumberToHex = (number: string) => `0x${BigInt(number).toString(16)}`;

/**
 * Convert a bigint or number in its hexadecimal form
 * @param number bigint | number to convert
 * @returns string in hexadecimal format
 */
export const intToHex = (number: bigint | number) => `0x${number.toString(16)}`;

/**
 * Sleep for the number of ms specified
 * @param delayMs time to wait in ms
 * @returns 
 */
export const waitFor = (delayMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs))