import loglevel from 'loglevel';
import color from 'ansi-colors';

export function wait(time = 0) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function debugLog(...args: any[]) {
  loglevel.debug(color.magenta('[DEBUG]:'), ...args);
}

export function warnLog(...args: any[]) {
  loglevel.warn(color.yellow('[WARN]:'), ...args);
}

export function errorLog(...args: any[]) {
  loglevel.error(color.red('[ERROR]:'), ...args);
}

export function infoLog(...args: any[]) {
  loglevel.error(color.blueBright('[INFO]:'), ...args);
}
