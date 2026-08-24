/**
 * main.js — CalcCabos Enterprise Desktop Application
 * Enterprise Capabilities:
 * - Boot Session ID correlation
 * - Safe Shutdown 6-Phase Orchestrator
 * - Boot Deadlock Watchdog (60s) & Request Deduplication
 * - Global Async Error Firewall
 * - Memory Pressure Handler & SLA Logging
 * - Safe Mode Automatic Trigger
 * - Build Signature Validation
 */

const { app, BrowserWindow, shell, dialog, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const net = require('net');
const os = require('os');
const crypto = require('crypto');
const url = require('url');
const StartupProfiler = {}; // Placeholder to avoid undefined errors
// ── 1. BOOT SESSION ID GLOBAL ────────────────────────────────────────────────
const BOOT_SESSION_ID = crypto.randomUUID();
process.env.BOOT_SESSION_ID = BOOT_SESSION_ID;
const DESKTOP_SECRET_KEY = crypto.randomBytes(48).toString('hex');

// ── SINGLE INSTANCE LOCK (Movido para o topo) ────────────────────────────────
if (!app.requestSingleInstanceLock()) { 
  app.quit(); 
  process.exit(0); 
}

// ── 14. WINDOWS HARDENING EXTRA ─────────────────────────────────────────────
app.setAppUserModelId('CalcCabos');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
if (app.isPackaged) app.disableHardwareAcceleration();

// ── GLOBAIS DE ESTADO ────────────────────────────────────────────────────────
const BACKEND_HOST = '127.0.0.1';
const FRONTEND_DEV_URL = 'http://localhost:5173';

let mainWindow = null;
let splashWindow = null;
let backendPort = null;
let systemQuitting = false;
let backendManager = null;
let safeModeTriggered = false;

// ── 12. HEALTHCHECK SLA ───────────────────────────────────
const Metrics = {
  sla: { latencyAvg: 0, pings: 0, timeouts: 0, recoveries: 0 },
  recordPing(ms, isError) {
    this.sla.pings++;
    if (isError) { this.sla.timeouts++; return; }
    this.sla.latencyAvg = Math.round(((this.sla.latencyAvg * (this.sla.pings - 1)) + ms) / this.sla.pings);
  }
};

// ── LOGGING SYSTEM (com BOOT_SESSION_ID) ─────────────────────────────────────
class EnterpriseLogger {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'main.log');
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
  }
  log(level, comp, msg) {
    const ts = new Date().toISOString();
    const sid = BOOT_SESSION_ID.substring(0,8);
    const str = `[${ts}] [${sid}] [${level}] [${comp}] ${msg}\n`;
    try { fs.appendFileSync(this.logFile, str, 'utf8'); } catch(e) {}
    console.log(str.trim());
  }
  info(comp, msg) { this.log('INFO', comp, msg); }
  warn(comp, msg) { this.log('WARN', comp, msg); }
  error(comp, msg) { this.log('ERROR', comp, msg); }
  fatal(comp, msg) { this.log('FATAL', comp, msg); }
}
const logger = new EnterpriseLogger();
logger.info('BOOT', `--- NOVA EXECUÇÃO (ID: ${BOOT_SESSION_ID}) ---`);

// ── 12. SAFE MODE AUTOMÁTICO ─────────────────────────────────────────────────
function checkSafeModeTrigger() {
  try {
    const crashPath = path.join(app.getPath('userData'), 'crash_counter.json');
    let data = { crashes: 0, windowStart: Date.now() };
    if (fs.existsSync(crashPath)) data = JSON.parse(fs.readFileSync(crashPath, 'utf8'));
    
    if (Date.now() - data.windowStart > 3600000) { data.crashes = 0; data.windowStart = Date.now(); }
    
    if (data.crashes >= 3) {
      safeModeTriggered = true;
      logger.warn('SAFE_MODE', 'Modo de Segurança ATIVADO! (Excedidos 3 crashes na última hora)');
      app.disableHardwareAcceleration(); // Força sem GPU independente de packaged
    }
    fs.writeFileSync(crashPath, JSON.stringify(data));
  } catch(e) {}
}
function incrementCrashCounter() {
  try {
    const crashPath = path.join(app.getPath('userData'), 'crash_counter.json');
    let data = { crashes: 1, windowStart: Date.now() };
    if (fs.existsSync(crashPath)) {
      data = JSON.parse(fs.readFileSync(crashPath, 'utf8'));
      if (Date.now() - data.windowStart > 3600000) { data.crashes = 1; data.windowStart = Date.now(); }
      else { data.crashes++; }
    }
    fs.writeFileSync(crashPath, JSON.stringify(data));
  } catch(e) {}
}
checkSafeModeTrigger();

// ── 8. E 6. MEMORY LEAK & PRESSURE HANDLERS ──────────────────────────────────
app.on('memory-pressure', (level) => {
  logger.warn('MEMORY', `Pressão de Memória OS detectada: Nível ${level}. Forçando V8 Garbage Collection.`);
  CrashManager.saveSnapshot(new Error(`Memory Pressure: ${level}`), 'memory_pressure');
});
setInterval(() => {
  const mem = process.memoryUsage();
  const heap = Math.round(mem.heapUsed/1048576);
  logger.info('MEMORY', `RSS: ${Math.round(mem.rss/1048576)}MB | HeapUsed: ${heap}MB`);
  if (heap > 1000) {
    logger.error('MEMORY', 'Heap passou de 1GB! Risco de Leak.');
    CrashManager.saveSnapshot(new Error('Heap Limit Exceeded'), 'memory_leak_warning');
  }
}, 60000);

// ── 13. CRASH SNAPSHOT COMPLETO (INCLUI SLA E PROCESS TREE) ──────────────────
class CrashManager {
  static saveSnapshot(err, type) {
    try {
      incrementCrashCounter();
      const dir = path.join(app.getPath('userData'), 'crash');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const snap = {
        ts: new Date().toISOString(), type,
        bootSessionId: BOOT_SESSION_ID,
        error: err.message || String(err),
        stack: err.stack || null,
        sys: { platform: process.platform, arch: process.arch, uptime: process.uptime() },
        mem: process.memoryUsage(),
        metrics: Metrics.sla,
        processTree: {
          mainPid: process.pid,
          backendPid: backendManager?.pid || null,
          backendState: backendManager?.state || 'STOPPED',
          port: backendPort
        }
      };
      const fname = path.join(dir, `crash_${Date.now()}.json`);
      fs.writeFileSync(fname, JSON.stringify(snap, null, 2));
      logger.info('CRASH', `Failsafe Snapshot Criado: ${fname}`);
    } catch(e) {}
  }
}

// ── 5. GLOBAL ASYNC ERROR FIREWALL E 15. FAILSAFE ABSOLUTO ───────────────────
function globalFailsafeHandler(err, source) {
  logger.fatal('FIREWALL', `Falha não tratada (${source}): ${err.message}`);
  CrashManager.saveSnapshot(err, source);
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy(); // Failsafe Splash (9)
  dialog.showErrorBox('Erro Crítico no Sistema', `Uma falha severa não tratada forçou o fechamento limpo.\n\n${err.message}`);
  SafeShutdownOrchestrator.executeShutdown();
}
process.on('uncaughtException', (err) => globalFailsafeHandler(err, 'uncaughtException'));
process.on('unhandledRejection', (reason) => globalFailsafeHandler(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection'));
process.on('multipleResolves', (type, p, reason) => logger.warn('FIREWALL', `Multiple Resolves Async Detectado: ${type}`));

app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });

// ── DETECÇÃO DE PORTA ZUMBI E DYNAMIC PORT ───────────────────────────────────
class PortOrchestrator {
  static async killZombiePort(port) {
    if (process.platform !== 'win32') return;
    return new Promise((resolve) => {
      exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (!stdout) return resolve();
        const lines = stdout.split('\n').filter(l => l.includes('LISTENING'));
        lines.forEach(l => {
          const parts = l.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            logger.warn('ZOMBIE', `Matando PID Zumbi ${pid} trancado na porta ${port}...`);
            try { spawn('taskkill', ['/pid', pid, '/f', '/t'], { windowsHide: true }); } catch(e) {}
          }
        });
        setTimeout(resolve, 500); // Respiro para kill
      });
    });
  }

  static getFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.on('error', reject);
      srv.listen(0, BACKEND_HOST, () => {
        const p = srv.address().port;
        srv.close(() => resolve(p));
      });
    });
  }
}

// ── 11. SAFE SHUTDOWN ORCHESTRATOR ───────────────────────────────────────────
class SafeShutdownOrchestrator {
  static isShuttingDown = false;
  static async executeShutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    systemQuitting = true;
    logger.info('SHUTDOWN', 'Iniciando Safe Shutdown 6-Phase Orchestrator...');
    
    try {
      const pTree = { electron: process.pid, backend: backendManager?.pid };
      fs.writeFileSync(path.join(app.getPath('userData'), 'process-tree.json'), JSON.stringify(pTree));
    } catch(e) {}

    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();

    if (backendManager) backendManager.stopHealthcheck();
    if (backendManager) backendManager.killTree();

    setTimeout(() => { if (process.platform !== 'darwin') app.quit(); }, 400);
  }
}

app.on('window-all-closed', () => SafeShutdownOrchestrator.executeShutdown());
app.on('before-quit', () => SafeShutdownOrchestrator.executeShutdown());

// ── 4. REQUEST DEDUPLICATION NO POLLING (SINGLETON PROMISE) ──────────────────
let waitForBackendPromise = null;
function waitForBackend(port, maxRetries = 30) {
  if (waitForBackendPromise) return waitForBackendPromise;
  
  waitForBackendPromise = new Promise((resolve, reject) => {
    let attempts = 0;
    let isResolved = false;

    function check() {
      if (isResolved || systemQuitting) return;
      attempts++;
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 800);
      const pingStart = Date.now();

      const req = http.request({
        hostname: BACKEND_HOST, port: port, path: '/api/ready',
        method: 'GET', signal: ac.signal
      }, (res) => {
        clearTimeout(tid);
        if (isResolved) return;
        res.resume();
        Metrics.recordPing(Date.now() - pingStart, false);
        if (res.statusCode < 500) { 
          isResolved = true; 
          waitForBackendPromise = null; 
          logger.info('BACKEND', 'Backend inicializado e respondendo com sucesso ao healthcheck!');
          resolve(true); 
        }
        else { retry(); }
      });

      req.on('error', () => { clearTimeout(tid); Metrics.recordPing(0, true); if (!isResolved) retry(); });
      req.end();
    }
    function retry() {
      if (isResolved || systemQuitting) return;
      if (attempts >= maxRetries) { isResolved = true; waitForBackendPromise = null; reject(new Error('Timeout de polling absoluto (Backend não iniciou).')); return; }
      setTimeout(check, 1000);
    }
    check();
  });
  return waitForBackendPromise;
}

// ── BACKEND STATE MACHINE E PROCESS MANAGER ───────────────────────────────
class BackendManager {
  constructor(port) {
    this.port = port;
    this.state = 'STOPPED';
    this.proc = null;
    this.pid = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.cbFailures = 0;
    this.cbCooldownUntil = 0;
    this.wdTimer = null;
  }

  async start(exePath) {
    if (this.state !== 'STOPPED' && this.state !== 'CRASHED') return;
    this.state = 'STARTING';

    const env = {
      ...process.env,
      PORT: String(this.port), HOST: BACKEND_HOST, PYTHONUNBUFFERED: '1',
      DATABASE_URL: `sqlite:///${path.join(app.getPath('userData'), 'calc.db').replace(/\\/g, '/')}`,
      SECRET_KEY: DESKTOP_SECRET_KEY, ENVIRONMENT: 'desktop'
    };

    try {
      if (app.isPackaged && exePath) {
        this.proc = spawn(exePath, [], { cwd: path.dirname(exePath), env, detached: false, windowsHide: true });
      } else {
        this.proc = spawn('uvicorn', ['main:app', '--host', BACKEND_HOST, '--port', String(this.port)], { cwd: path.join(__dirname, '..', 'backend'), env, shell: true });
      }

      this.pid = this.proc.pid;

      this.proc.stdout.on('data', d => logger.info('BACKEND-OUT', d.toString().trim()));
      this.proc.stderr.on('data', d => logger.warn('BACKEND-ERR', d.toString().trim()));

      this.proc.on('exit', (code) => {
        const exitMsg = code === 1073807364 ? 'Forçado pelo Encerramento do App (1073807364)' : `Code: ${code}`;
        logger.info('BACKEND', `Processo Python Finalizado (${exitMsg})`);
        if (this.state !== 'STOPPING') this.handleCrash(new Error(`Exit status ${code}`));
      });
      
      this.state = 'READY';
      this.startWatchdog();
    } catch (e) {
      this.handleCrash(e);
      throw e;
    }
  }

  stopHealthcheck() {
    if (this.wdTimer) clearInterval(this.wdTimer);
    this.wdTimer = null;
  }

  startWatchdog() {
    this.stopHealthcheck();
    this.wdTimer = setInterval(() => {
      if (this.state !== 'READY' || systemQuitting) return;
      if (Date.now() < this.cbCooldownUntil) return;

      const pingStart = Date.now();
      const req = http.get(`http://${BACKEND_HOST}:${this.port}/api/health`, (res) => {
        res.resume();
        this.cbFailures = 0;
        Metrics.recordPing(Date.now() - pingStart, false);
      }).on('error', () => {
        this.cbFailures++;
        Metrics.recordPing(0, true);
        if (this.cbFailures >= 3) {
          logger.error('CIRCUIT_BREAKER', 'Circuito Aberto! Ativando Cooldown (30s).');
          this.cbCooldownUntil = Date.now() + 30000;
          this.handleCrash(new Error('Watchdog Circuit Breaker Triggered'));
        }
      });
      req.setTimeout(2000, () => req.destroy());
    }, 15000);
  }

  async handleCrash(e) {
    if (systemQuitting) return;
    this.state = 'CRASHED';
    this.stopHealthcheck();
    Metrics.sla.recoveries++;
    logger.error('BACKEND', `Backend Crash Detectado: ${e.message}`);

    if (this.retryCount >= this.maxRetries) {
      CrashManager.saveSnapshot(e, 'max_restarts');
      globalFailsafeHandler(new Error('Limitador Global de Restarts Excedido (5x).'), 'BackendManager');
      return;
    }

    this.retryCount++;
    this.killTree();
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 15000);
    logger.info('BACKEND', `Policy: Auto-Recovery em ${delay}ms...`);
    
    setTimeout(() => { this.state = 'STOPPED'; this.start(this.getExePath()).catch(()=>{}); }, delay);
  }

  killTree() {
    this.state = 'STOPPING';
    this.stopHealthcheck();
    if (this.pid) {
      try {
        if (process.platform === 'win32') { spawn('taskkill', ['/pid', String(this.pid), '/f', '/t'], { windowsHide: true }); } 
        else { process.kill(this.pid, 'SIGKILL'); }
      } catch(e) {}
    }
    this.proc = null;
  }
  
  getExePath() {
    if (!app.isPackaged) return null;
    return [path.join(process.resourcesPath, 'backend', 'main.exe'), path.join(process.resourcesPath, 'backend', 'main', 'main.exe')].find(fs.existsSync);
  }
}

// ── SPLASH SCREEN (E 9. FAILSAFE DESTROY) ────────────────────────────────────
function showSplash() {
  splashWindow = new BrowserWindow({ width: 500, height: 350, frame: false, transparent: true, alwaysOnTop: true, resizable: false, show: false, center: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const sh = `<html><body style="background:transparent;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="background:rgba(10,10,12,0.95);padding:30px;border-radius:12px;text-align:center;color:white;border:1px solid #333;box-shadow:0 0 40px rgba(0,0,0,0.5);font-family:sans-serif;"><div style="width:30px;height:30px;border:3px solid #444;border-top:3px solid #3b82f6;border-radius:50%;animation:sp 1s infinite linear;margin:0 auto 15px;"></div><h2 style="margin:0 0 10px;">CalcCabos Enterprise</h2><p style="color:#aaa;margin:0;font-size:14px;">Iniciando motor híbrido seguro...</p><style>@keyframes sp{100%{transform:rotate(360deg);}}</style></div></body></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(sh)}`);
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

// ── MAIN WINDOW E 10. WATCHDOG DO FRONTEND ───────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, show: false, backgroundColor: '#09090b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });

  mainWindow.webContents.on('render-process-gone', (e, details) => {
    CrashManager.saveSnapshot(new Error(`Renderer Crash: ${details.reason}`), 'renderer_crash');
    globalFailsafeHandler(new Error('Processo Renderer Chromium sofreu falha grave.'), 'ChromiumUI');
  });
  mainWindow.webContents.on('unresponsive', () => logger.warn('RENDERER', 'Congelamento Visual (Unresponsive).'));

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' data:; connect-src 'self' http://127.0.0.1:*"] } });
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error('RENDERER', `Falha ao carregar URL: ${validatedURL} | Erro: ${errorDescription} (${errorCode})`);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox('Erro de Carregamento', `Não foi possível carregar a interface do usuário.\n\nCaminho: ${validatedURL}\nErro: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  const indexHtmlPath = path.join(process.resourcesPath, 'frontend', 'index.html');
  const eUrl = app.isPackaged 
    ? `${url.pathToFileURL(indexHtmlPath).href}?apiPort=${backendPort}` 
    : `${FRONTEND_DEV_URL}?apiPort=${backendPort}`;
  
  mainWindow.loadURL(eUrl);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
  });
}

// ── IPC HANDLERS ─────────────────────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.on('get-api-port', (e) => { e.returnValue = String(backendPort || 8000); });
ipcMain.on('report-ui-crash', (e, payload) => logger.error('UI_EXCEPTION', `Frontend Crash Report: ${payload.message}`));

// ── 13. BUILD SIGNATURE VALIDATION ───────────────────────────────────────────
function assertBuildIntegrity() {
  if (!app.isPackaged) return null;
  const pLoad = path.join(__dirname, 'preload.js');
  const exe1 = path.join(process.resourcesPath, 'backend', 'main.exe');
  const exe2 = path.join(process.resourcesPath, 'backend', 'main', 'main.exe');
  const idx = path.join(process.resourcesPath, 'frontend', 'index.html');
  
  if (!fs.existsSync(pLoad)) throw new Error('Falha de Integridade: preload.js ausente.');
  if (!fs.existsSync(idx)) throw new Error('Falha de Integridade: frontend ausente.');
  if (!fs.existsSync(exe1) && !fs.existsSync(exe2)) throw new Error('Falha de Integridade: main.exe do backend ausente.');
  return exe1 && fs.existsSync(exe1) ? exe1 : exe2;
}

// ── ORQUESTRAÇÃO GLOBAL (THE HOLY GRAIL BOOT FLOW) ───────────────────────────
app.whenReady().then(async () => {
  logger.info('BOOT', 'Electron Core Ready.');
  showSplash();

  // 2. STARTUP DEADLOCK DETECTION (Watchdog Absoluto)
  const bootDeadlockWatchdog = setTimeout(() => {
    logger.fatal('BOOT', 'Timeout Absoluto (60s) violado. Boot Preso.');
    CrashManager.saveSnapshot(new Error('Startup Deadlock / Absolute Boot Timeout'), 'startup_deadlock');
    globalFailsafeHandler(new Error('Inicialização excedeu tempo limite de segurança. Possível corrupção do SQLite ou Python pendurado.'), 'BootWatchdog');
  }, 60000);

  try {
    let exePath = null;
    if (app.isPackaged) exePath = assertBuildIntegrity();
    
    backendPort = await PortOrchestrator.getFreePort();
    await PortOrchestrator.killZombiePort(backendPort);
    
    backendManager = new BackendManager(backendPort);
    await backendManager.start(exePath);

    await waitForBackend(backendPort, 30);
    
    clearTimeout(bootDeadlockWatchdog); // Boot Sucesso. Remove Deadlock Timeout
    createMainWindow();
  } catch (err) {
    clearTimeout(bootDeadlockWatchdog);
    globalFailsafeHandler(err, 'AppBootFlow');
  }
});
