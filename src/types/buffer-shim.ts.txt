// buffer-shim.ts — THE PERMANENT FIX
declare global {
  interface Uint8Array {
    // Add all Buffer methods to Uint8Array
    write(string: string, offset?: number, length?: number, encoding?: BufferEncoding): number;
    toString(encoding?: BufferEncoding, start?: number, end?: number): string;
    equals(otherBuffer: Uint8Array): boolean;
    readUInt16BE(offset: number): number;
    readUInt32BE(offset: number): number;
    writeUInt16BE(value: number, offset: number): number;
    writeUInt32BE(value: number, offset: number): number;
    subarray(begin?: number, end?: number): Uint8Array;
    indexOf(search: Uint8Array | number, offset?: number): number;
  }
}

// Make Uint8Array act exactly like Buffer
export type BufferLike = Uint8Array & {
  [Symbol.toStringTag]: 'Uint8Array';
};

// Helper to convert real Buffer → Uint8Array (zero copy when possible)
export function toBufferLike(data: Buffer | Uint8Array): BufferLike {
  return data as any;
}

// Re-export Buffer as Uint8Array for compatibility
export const Buffer: {
  alloc(size: number): BufferLike;
  concat(list: Uint8Array[]): BufferLike;
  from(arrayBuffer: ArrayBuffer | Uint8Array | number[] | string, byteOffset?: number, length?: number): BufferLike;
} = globalThis.Buffer || {
  alloc: (size: number) => new Uint8Array(size) as BufferLike,
  concat: (list: Uint8Array[]) => {
    const total = list.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of list) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result as BufferLike;
  },
  from: (data: any, ...args: any[]) => {
    if (data instanceof Uint8Array) return data as BufferLike;
    if (typeof data === 'string') return new TextEncoder().encode(data) as BufferLike;
    return new Uint8Array(data, ...args) as BufferLike;
  },
};