/**
 * preload.js — CalcCabos Enterprise Desktop Application
 * Enterprise Capabilities:
 * - IPC Validation Layer (Type Guard & Schema Validation)
 * - Anti-flood IPC Rate Limiting
 * - ContextBridge strict isolation
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── 10. IPC RATE LIMITER ─────────────────────────────────────────────────────
const rateLimits = new Map();
const IPC_COOLDOWN_MS = 200; // 200ms de cooldown absoluto por canal

function isRateLimited(channel) {
  const now = Date.now();
  const last = rateLimits.get(channel) || 0;
  if (now - last < IPC_COOLDOWN_MS) {
    console.warn(`[IPC Rate Limit] Canal ${channel} bloqueado por excesso de requisições.`);
    return true; // Drop silencioso (Prevenção de UI Freeze/Memory Leak)
  }
  rateLimits.set(channel, now);
  return false;
}

// ── 11. PRELOAD VALIDATION LAYER (TYPE GUARD E SANITIZAÇÃO) ──────────────────
function validatePayload(payload, expectedType) {
  if (expectedType === 'string' && typeof payload !== 'string') throw new Error('Payload inválido. Esperado string.');
  if (expectedType === 'number' && typeof payload !== 'number') throw new Error('Payload inválido. Esperado number.');
  if (expectedType === 'object' && (typeof payload !== 'object' || payload === null)) throw new Error('Payload inválido. Esperado object.');
  return payload; // Sanitizado (em uso prático extrairia chaves explicitamente aqui)
}

// ── EXPOSIÇÃO SEGURA ─────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  
  getVersion: async () => {
    if (isRateLimited('get-version')) return null;
    return await ipcRenderer.invoke('get-version');
  },

  getApiPort: () => {
    if (isRateLimited('get-api-port')) return null;
    return ipcRenderer.sendSync('get-api-port');
  },

  // Evento assíncrono para relatar falhas UI detectáveis no Renderer
  reportUiCrash: (errorPayload) => {
    if (isRateLimited('report-ui-crash')) return;
    const safeError = validatePayload(errorPayload, 'object');
    const msg = String(safeError.message).substring(0, 500); // Sanitize string max length
    ipcRenderer.send('report-ui-crash', { message: msg });
  }

});
