import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { connectRemoteSession } from "../apps/desktop-control/src/realtime.js";
import { summarizeRealtimeMeasurement } from "../apps/desktop-control/src/measurement.js";

const durationMs = readSeconds("MEASURE_DURATION_SECONDS", 30, 5, 300) * 1_000;
const firstFrameTimeoutMs = readSeconds("MEASURE_FIRST_FRAME_TIMEOUT_SECONDS", 20, 5, 120) * 1_000;
const startedAt = Date.now();
let framesReceived = 0;
let bytesReceived = 0;
let firstFrameMs: number | undefined;
let firstFrameValid = false;
let closedReason: string | undefined;
let connection: Awaited<ReturnType<typeof connectRemoteSession>> | undefined;
const latencySamplesMs: number[] = [];

async function main() {
  const sessionId = required("MEASURE_SESSION_ID");
  const deviceId = required("MEASURE_DEVICE_ID");
  const accessToken = required("MEASURE_ACCESS_TOKEN");
  const realtimeUrl = required("MEASURE_REALTIME_URL");

  let firstFrameResolve: (() => void) | undefined;
  let firstFrameReject: ((error: Error) => void) | undefined;
  const firstFrame = new Promise<void>((resolve, reject) => {
    firstFrameResolve = resolve;
    firstFrameReject = reject;
  });
  const firstFrameTimeout = setTimeout(() => {
    firstFrameReject?.(new Error(`nenhum primeiro frame valido em ${firstFrameTimeoutMs / 1_000}s`));
  }, firstFrameTimeoutMs);

  let failure: Error | undefined;
  try {
    connection = await connectRemoteSession(
      { sessionId, deviceId, mode: "game", role: "client", accessToken },
      {
        url: realtimeUrl,
        onReady(peerConnected) {
          console.log(`medicao pronta peerConnected=${peerConnected}`);
        },
        onFrame(frame) {
          framesReceived += 1;
          bytesReceived += frame.byteLength;
          if (firstFrameMs !== undefined) return;
          if (!hasMp4Box(frame, "ftyp") || !hasMp4Box(frame, "moov")) {
            firstFrameReject?.(new Error("primeiro frame sem inicializacao fMP4 valida"));
            return;
          }
          firstFrameMs = Math.max(0, Date.now() - startedAt);
          firstFrameValid = true;
          firstFrameResolve?.();
        },
        onLatencyMs(latencyMs) {
          latencySamplesMs.push(latencyMs);
        },
        onClosed(reason) {
          closedReason = reason;
          if (firstFrameMs === undefined) firstFrameReject?.(new Error(`sessao encerrou antes do primeiro frame: ${reason}`));
        }
      }
    );

    await firstFrame;
    await delay(Math.max(0, startedAt + durationMs - Date.now()));
  } catch (error: unknown) {
    failure = error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(firstFrameTimeout);
    connection?.close();
  }

  const report = summarizeRealtimeMeasurement({
    durationMs: Math.max(1, Date.now() - startedAt),
    firstFrameMs,
    framesReceived,
    bytesReceived,
    latencySamplesMs,
    firstFrameValid,
    closedReason
  });
  const reportPath = process.env.MEASURE_OUTPUT_PATH?.trim();
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report));
  if (failure) throw failure;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ausente`);
  return value;
}

function readSeconds(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} deve estar entre ${min} e ${max} segundos`);
  }
  return value;
}

function hasMp4Box(frame: Buffer, type: string) {
  const marker = Buffer.from(type, "ascii");
  for (let offset = 4; offset + marker.byteLength <= frame.byteLength; offset += 1) {
    if (frame.subarray(offset, offset + marker.byteLength).equals(marker)) return true;
  }
  return false;
}

function delay(timeoutMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
