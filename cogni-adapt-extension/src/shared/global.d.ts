/// <reference types="chrome" />

export {};

declare global {
  interface Window {
    __COGNI_FOCUS_INIT__?: boolean;
  }
}
