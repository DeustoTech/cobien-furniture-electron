// electron/services/sttService.ts
// NOTE: vosk native module fails on Node 25. 
// STT is handled client-side via Web Speech API (Chromium).
// This file is intentionally left minimal; 
// the IPC bridge is not needed for STT.
export {}
