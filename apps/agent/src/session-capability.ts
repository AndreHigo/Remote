export interface InteractiveSessionProbe {
  platform: NodeJS.Platform;
  serviceMode: boolean;
  taskInstalled: boolean;
  processRunning: boolean;
}

export interface InteractiveSessionCapability {
  interactiveSessionReady: boolean;
  interactiveTaskInstalled: boolean;
  interactiveProcessRunning: boolean;
}

export function buildInteractiveSessionCapability(input: InteractiveSessionProbe): InteractiveSessionCapability {
  const windowsReady = input.platform === "win32";
  const ready = windowsReady && (!input.serviceMode || (input.taskInstalled && input.processRunning));
  return {
    interactiveSessionReady: ready,
    interactiveTaskInstalled: input.taskInstalled,
    interactiveProcessRunning: input.processRunning
  };
}
