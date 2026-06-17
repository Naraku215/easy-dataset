// lib/utils/logger.js
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

function formatError(error) {
  const parts = [];
  const name = error && error.name ? error.name : 'Error';
  const message = error && error.message ? error.message : String(error);

  parts.push(`${name}: ${message}`);

  if (error && error.stack) {
    parts.push(error.stack);
  }

  if (error && error.cause) {
    parts.push(`Cause: ${formatLogArg(error.cause)}`);
  }

  return parts.join('\n');
}

function formatLogArg(arg) {
  if (arg instanceof Error) {
    return formatError(arg);
  }

  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch (error) {
      return `[Unserializable Object: ${error.message}]`;
    }
  }

  return String(arg);
}

function formatLogMessage(args) {
  return args.map(formatLogArg).join(' ');
}

function log(level, ...args) {
  try {
    const message = formatLogMessage(args);
    if (isElectron) {
      // 在 Electron 环境下，将日志写入文件
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('log', { level, message });
    } else {
      // 在非 Electron 环境下，只输出到控制台
      console[level](...args);
    }
  } catch (error) {
    console.error('Failed to log:', error);
  }
}

export { formatError, formatLogArg, formatLogMessage };

export default {
  info: (...args) => log('info', ...args),
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  debug: (...args) => log('debug', ...args)
};
