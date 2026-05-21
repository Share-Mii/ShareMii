declare module 'miijs' {
  export class Mii {
    fields: Record<string, unknown>;
    constructor(decodedMii?: unknown);
    static create(input: unknown): Promise<Mii>;
    encode(format?: unknown): Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;
    toJSON(): Record<string, unknown>;
  }

  export const ConsoleFormats: {
    WII: string;
    DS: string;
    '3DS': string;
    WIIU: string;
    SWITCH: string;
    SWITCH2: string;
  };

  export const decryptMii: (data: Uint8Array) => Uint8Array | ArrayBuffer;
  export const decodeMii: (
    data: Uint8Array | ArrayBuffer,
  ) => Promise<unknown>;
  export const encodeMii: (
    mii: unknown,
    format: unknown,
  ) => Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;
  export const detectMiiFormat: (data: Uint8Array) => string[];
  export const scanQR: (
    input: Blob | Uint8Array | ArrayBuffer,
  ) => Promise<Uint8Array | null>;
  export const MiiFormats: {
    CFSD: unknown;
    FFSD: unknown;
    CFED: unknown;
    FFED: unknown;
    TLS: unknown;
    TLE: unknown;
  };
  export const makeQR: (
    input: Uint8Array | ArrayBuffer,
    options?: Record<string, unknown>,
  ) => Promise<Uint8Array | ArrayBuffer>;
  export const makeInstructions: (
    mii: unknown,
    device?: string,
  ) => Promise<unknown>;
  export const getAs: (mii: unknown, type: string, field: string) => unknown;
  export const setAs: (
    mii: unknown,
    type: string,
    field: string,
    value: unknown,
  ) => unknown;
}
