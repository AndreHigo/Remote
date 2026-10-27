import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type RemoteInputEvent =
  | { type: "mouse.relative"; dx: number; dy: number }
  | { type: "mouse.button"; button: "left" | "right" | "middle"; action: "down" | "up" }
  | { type: "mouse.wheel"; delta: number }
  | { type: "key"; scanCode: number; action: "down" | "up"; extended?: boolean };

export function createInputReleaseTracker() {
  const pressedKeys = new Map<number, boolean>();
  const pressedButtons = new Set<"left" | "right" | "middle">();

  return {
    observe(event: RemoteInputEvent) {
      if (event.type === "key") {
        if (event.action === "down") pressedKeys.set(event.scanCode, event.extended === true);
        else pressedKeys.delete(event.scanCode);
      }
      if (event.type === "mouse.button") {
        if (event.action === "down") pressedButtons.add(event.button);
        else pressedButtons.delete(event.button);
      }
    },
    releaseEvents(): RemoteInputEvent[] {
      const events: RemoteInputEvent[] = [];
      for (const button of pressedButtons) events.push({ type: "mouse.button", button, action: "up" });
      for (const [scanCode, extended] of pressedKeys) {
        events.push({ type: "key", scanCode, action: "up", ...(extended ? { extended: true } : {}) });
      }
      pressedButtons.clear();
      pressedKeys.clear();
      return events;
    }
  };
}

export function validateInputEvent(value: unknown): RemoteInputEvent {
  if (!value || typeof value !== "object") throw new Error("Evento de entrada invalido");
  const event = value as Record<string, unknown>;

  if (event.type === "mouse.relative" && isFiniteNumber(event.dx) && isFiniteNumber(event.dy)) {
    return { type: event.type, dx: clamp(event.dx, -32768, 32767), dy: clamp(event.dy, -32768, 32767) };
  }

  if (
    event.type === "mouse.button" &&
    (event.button === "left" || event.button === "right" || event.button === "middle") &&
    (event.action === "down" || event.action === "up")
  ) {
    return { type: event.type, button: event.button, action: event.action };
  }

  if (event.type === "mouse.wheel" && isFiniteNumber(event.delta)) {
    return { type: event.type, delta: clamp(event.delta, -12000, 12000) };
  }

  if (
    event.type === "key" &&
    isIntegerInRange(event.scanCode, 1, 255) &&
    (event.action === "down" || event.action === "up") &&
    (event.extended === undefined || typeof event.extended === "boolean")
  ) {
    return {
      type: event.type,
      scanCode: event.scanCode,
      action: event.action,
      ...(event.extended === undefined ? {} : { extended: event.extended })
    };
  }

  throw new Error("Evento de entrada nao permitido");
}

export function serializeInputEvent(value: RemoteInputEvent) {
  const event = validateInputEvent(value);
  switch (event.type) {
    case "mouse.relative":
      return `m ${event.dx} ${event.dy}`;
    case "mouse.button":
      return `b ${event.button} ${event.action}`;
    case "mouse.wheel":
      return `w ${event.delta}`;
    case "key":
      return `k ${event.scanCode} ${event.action} ${event.extended === true ? 1 : 0}`;
  }
}

export class WindowsInputBridge {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly releaseTracker = createInputReleaseTracker();
  private closed = false;
  private forceKillTimer?: NodeJS.Timeout;

  constructor() {
    if (process.platform !== "win32") throw new Error("A ponte de entrada esta disponivel apenas no Windows.");
    this.process = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_BRIDGE], {
      stdio: "pipe",
      windowsHide: true
    });
    this.process.once("close", () => {
      if (this.forceKillTimer) clearTimeout(this.forceKillTimer);
      this.forceKillTimer = undefined;
    });
  }

  get isOpen() {
    return !this.closed && this.process.stdin.writable;
  }

  send(value: unknown) {
    const event = validateInputEvent(value);
    if (!this.process.stdin.writable) throw new Error("Ponte de entrada encerrada");
    this.process.stdin.write(`${serializeInputEvent(event)}\n`);
    this.releaseTracker.observe(event);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.process.stdin.writable) {
      for (const event of this.releaseTracker.releaseEvents()) {
        this.process.stdin.write(`${serializeInputEvent(event)}\n`);
      }
      this.process.stdin.end();
      this.forceKillTimer = setTimeout(() => {
        if (this.process.exitCode === null && this.process.signalCode === null) this.process.kill();
      }, 250);
      this.forceKillTimer.unref?.();
    } else {
      this.process.kill();
    }
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// The bridge accepts only the typed line protocol above; it never evaluates a user command.
const POWERSHELL_BRIDGE = String.raw`
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class RemotoInput {
  // INPUT is 8-byte aligned on the x64 Windows ABI. Using offset 4 makes
  // SendInput return success while reading the mouse/key fields incorrectly.
  [StructLayout(LayoutKind.Explicit, Size = 40)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public MOUSEINPUT mi; [FieldOffset(8)] public KEYBDINPUT ki; [FieldOffset(8)] public HARDWAREINPUT hi; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  public static void Move(int dx, int dy) { SendMouse(dx, dy, 0, 0x0001); }
  public static void Button(uint data, uint flags) { SendMouse(0, 0, data, flags); }
  public static void Wheel(int delta) { SendMouse(0, 0, unchecked((uint)delta), 0x0800); }
  public static void Key(ushort scan, bool up, bool extended) { var input = Base(); input.ki.wScan = scan; input.ki.dwFlags = 0x0008u | (up ? 0x0002u : 0u) | (extended ? 0x0001u : 0u); EnsureSent(SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT)))); }
  private static void SendMouse(int dx, int dy, uint data, uint flags) { var input = Base(); input.mi.dx = dx; input.mi.dy = dy; input.mi.mouseData = data; input.mi.dwFlags = flags; EnsureSent(SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT)))); }
  private static void EnsureSent(uint sent) { if (sent != 1) throw new InvalidOperationException("SendInput falhou: " + Marshal.GetLastWin32Error()); }
  private static INPUT Base() { var input = new INPUT(); input.type = 0; return input; }
}
'@
Add-Type -TypeDefinition $signature
while ($line = [Console]::In.ReadLine()) {
  try {
    $parts = $line -split ' '
    switch ($parts[0]) {
      'm' { if ($parts.Count -eq 3) { [RemotoInput]::Move([int]$parts[1], [int]$parts[2]) } }
      'b' {
        if ($parts.Count -eq 3) {
          $down = $parts[2] -eq 'down'
          $flag = if ($parts[1] -eq 'left') { if ($down) { 2 } else { 4 } } elseif ($parts[1] -eq 'right') { if ($down) { 8 } else { 16 } } elseif ($parts[1] -eq 'middle') { if ($down) { 32 } else { 64 } } else { 0 }
          if ($flag -ne 0) { [RemotoInput]::Button(0, $flag) }
        }
      }
      'w' { if ($parts.Count -eq 2) { [RemotoInput]::Wheel([int]$parts[1]) } }
      'k' { if ($parts.Count -eq 4) { [RemotoInput]::Key([ushort]$parts[1], $parts[2] -eq 'up', $parts[3] -eq '1') } }
    }
  } catch { [Console]::Error.WriteLine("entrada: " + $_.Exception.Message) }
}
`;
