import loglevel from 'loglevel';
import color from 'ansi-colors';

export function wait(time = 0) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function debugLog(...args) {
  loglevel.debug(color.magenta('[DEBUG]:'), ...args);
}

export function warnLog(...args) {
  loglevel.warn(color.yellow('[WARN]:'), ...args);
}

export function errorLog(...args) {
  loglevel.error(color.red('[ERROR]:'), ...args);
}

export function infoLog(...args) {
  loglevel.error(color.blueBright('[INFO]:'), ...args);
}
