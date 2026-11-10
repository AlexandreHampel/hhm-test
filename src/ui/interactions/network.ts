import { CDPSession, Page } from '@playwright/test';
import { interaction } from '../screenplay/core';

/**
 * Browser network conditions. They degrade the network the interface runs on,
 * making transient states observable, without calling or faking the API.
 */

const sessions = new WeakMap<Page, CDPSession>();

async function networkSession(page: Page): Promise<CDPSession> {
  let session = sessions.get(page);

  if (!session) {
    session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    sessions.set(page, session);
  }

  return session;
}

async function emulate(page: Page, latency: number): Promise<void> {
  const session = await networkSession(page);

  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

/** Delay applied to every request while the network is slow, long enough to observe busy states. */
export const SLOW_NETWORK_LATENCY = 2500;

export const Network = {
  /** Adds latency to every request the page sends from now on. */
  becomesSlow: (latency = SLOW_NETWORK_LATENCY) =>
    interaction('Make the network slow', async (page) => {
      await emulate(page, latency);
    }),

  /** Removes any added latency. */
  becomesNormal: () =>
    interaction('Make the network normal again', async (page) => {
      await emulate(page, 0);
    }),

  /** Disconnects the browser, as if the server could not be reached. */
  goesOffline: () =>
    interaction('Disconnect the browser from the network', async (page) => {
      await page.context().setOffline(true);
    }),

  /** Reconnects the browser. */
  comesBackOnline: () =>
    interaction('Reconnect the browser to the network', async (page) => {
      await page.context().setOffline(false);
    }),
};
