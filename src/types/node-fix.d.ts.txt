// node-fix.d.ts
// Fixes Elgato Stream Deck's broken @types/node that changes 'data' →
// Uint8Array

import 'net';

declare module 'net' {
    interface Socket {
        // Force 'data' event to emit Buffer (correct Node.js behavior)
        on(event: 'data', listener: (chunk: Buffer) => void): this;
        once(event: 'data', listener: (chunk: Buffer) => void): this;
        addListener(event: 'data', listener: (chunk: Buffer) => void): this;
        removeListener(event: 'data', listener: (chunk: Buffer) => void): this;
        prependListener(event: 'data', listener: (chunk: Buffer) => void):
            this;
        prependOnceListener(event: 'data', listener: (chunk: Buffer) =>
            void): this;

        // Also fix write() to accept Buffer (Stream Deck sometimes breaks this too)
        write(data: string | Uint8Array | Buffer, callback?: (err?: Error) => void): boolean;
        write(data: string | Uint8Array | Buffer, encoding: BufferEncoding, callback?: (err?: Error) => void): boolean;
    }
    // types/buffer-fix.d.ts
    declare module 'buffer' {
        export class Buffer extends Uint8Array {
            // This makes the polyfilled Buffer fully compatible
        }
    }

    // Tell TypeScript to chill about SharedArrayBuffer in browser-like env
    interface ArrayBufferLike {
        [Symbol.toStringTag]?: string;
    }
}