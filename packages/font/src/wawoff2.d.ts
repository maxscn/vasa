declare module "wawoff2" {
  const wawoff2: {
    compress(buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
    decompress(buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
  };

  export default wawoff2;
  export const compress: typeof wawoff2.compress;
  export const decompress: typeof wawoff2.decompress;
}

declare module "wawoff2/decompress" {
  const decompress: (buffer: Uint8Array | ArrayBuffer) => Promise<Uint8Array>;
  export default decompress;
}

declare module "wawoff2/build/decompress_binding.js" {
  export type Wawoff2DecompressBinding = {
    calledRun?: boolean;
    onRuntimeInitialized?: () => void;
    decompress(buffer: Uint8Array | ArrayBuffer): Uint8Array | false;
  };

  const binding: Wawoff2DecompressBinding;
  export default binding;
}
