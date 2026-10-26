export type RemoteGamepadMode = "keyboard-mouse-map";

export interface InputCapabilities {
  keyboard: "sendinput";
  mouse: "sendinput";
  gamepad: RemoteGamepadMode;
  virtualGamepad: false;
  haptics: false;
}

export function buildInputCapabilities(): InputCapabilities {
  return {
    keyboard: "sendinput",
    mouse: "sendinput",
    gamepad: "keyboard-mouse-map",
    virtualGamepad: false,
    haptics: false
  };
}
