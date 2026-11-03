/**
 * deflate-raw 압축/해제. 의존성 없이 런타임을 감지해서 고른다.
 *
 * - Node: `node:zlib` (Node 18의 CompressionStream은 'deflate-raw'를 지원하지 않는다)
 * - 브라우저: `CompressionStream('deflate-raw')` / `DecompressionStream('deflate-raw')`
 *
 * 두 경로는 서로 호환되는 raw DEFLATE 스트림을 낸다. 테스트에서 교차 검증한다.
 */

export type CompressEngine = "auto" | "zlib" | "stream";

type ZlibModule = {
  deflateRawSync: (buf: Uint8Array) => Uint8Array;
  inflateRawSync: (buf: Uint8Array) => Uint8Array;
};

function isNodeRuntime(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return typeof proc?.versions?.node === "string";
}

function hasWebStreams(): boolean {
  return (
    typeof (globalThis as { CompressionStream?: unknown }).CompressionStream === "function" &&
    typeof (globalThis as { DecompressionStream?: unknown }).DecompressionStream === "function"
  );
}

let zlibPromise: Promise<ZlibModule> | undefined;

function loadZlib(): Promise<ZlibModule> {
  if (!zlibPromise) {
    // 번들러(Vite)가 브라우저 빌드에서 node:zlib를 정적으로 따라가지 않도록 변수로 import한다.
    const specifier = "node:zlib";
    zlibPromise = import(/* @vite-ignore */ specifier) as Promise<ZlibModule>;
  }
  return zlibPromise;
}

function pickEngine(engine: CompressEngine): "zlib" | "stream" {
  if (engine !== "auto") return engine;
  if (isNodeRuntime()) return "zlib";
  if (hasWebStreams()) return "stream";
  throw new Error("llmbti: no deflate-raw implementation available in this runtime");
}

async function pipeThrough(
  bytes: Uint8Array,
  transform: ReadableWritablePair<Uint8Array, BufferSource>,
): Promise<Uint8Array> {
  // DOM lib와 @types/node의 스트림 제네릭이 달라서 BufferSource로 맞춘다.
  const source = new Blob([bytes as BlobPart]).stream() as ReadableStream<BufferSource>;
  const buf = await new Response(source.pipeThrough(transform)).arrayBuffer();
  return new Uint8Array(buf);
}

export async function deflateRaw(
  bytes: Uint8Array,
  engine: CompressEngine = "auto",
): Promise<Uint8Array> {
  if (pickEngine(engine) === "zlib") {
    const zlib = await loadZlib();
    return new Uint8Array(zlib.deflateRawSync(bytes));
  }
  return pipeThrough(bytes, new CompressionStream("deflate-raw"));
}

export async function inflateRaw(
  bytes: Uint8Array,
  engine: CompressEngine = "auto",
): Promise<Uint8Array> {
  if (pickEngine(engine) === "zlib") {
    const zlib = await loadZlib();
    return new Uint8Array(zlib.inflateRawSync(bytes));
  }
  return pipeThrough(bytes, new DecompressionStream("deflate-raw"));
}
