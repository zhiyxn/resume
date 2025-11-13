import type { Browser } from 'puppeteer-core';

/**
 * 智能关闭浏览器实例
 *
 * 策略：
 * 1. 优先尝试优雅关闭（close）
 * 2. 如果超时，使用强制关闭（disconnect + kill）
 *
 * 这样在生产环境能优雅关闭，在 WSL2 等问题环境能强制关闭
 */
export async function closeBrowserSafely(
  browser: Browser,
  options: {
    /** 优雅关闭的超时时间（毫秒），默认 3000ms */
    timeout?: number;
    /** 是否强制使用快速关闭（跳过优雅关闭尝试） */
    force?: boolean;
  } = {}
): Promise<void> {
  const { timeout = 3000, force = false } = options;

  // 如果指定强制模式，直接使用快速关闭
  if (force) {
    return forceCloseBrowser(browser);
  }

  // 尝试优雅关闭，带超时
  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Browser close timeout')), timeout)
      ),
    ]);
    return;
  } catch (error) {
    // 优雅关闭失败或超时，使用强制关闭
    console.warn('Graceful browser close failed, forcing close:', error instanceof Error ? error.message : String(error));
    return forceCloseBrowser(browser);
  }
}

/**
 * 强制关闭浏览器进程
 */
function forceCloseBrowser(browser: Browser): void {
  try {
    browser.disconnect();
  } catch (e) {
    // 断开连接失败，继续尝试 kill
    console.warn('Browser disconnect failed:', e);
  }

  const pid = browser.process()?.pid;
  if (pid) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (e) {
      // 进程可能已经退出，忽略错误
      if ((e as NodeJS.ErrnoException).code !== 'ESRCH') {
        console.warn('Failed to kill browser process:', e);
      }
    }
  }
}
