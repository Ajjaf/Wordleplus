import { io as ioClient } from "socket.io-client";
import { closeRoomStore } from "../../room-store.js";

let serverModule;
let httpServer;
let serverPort;

/**
 * Boot the real server on a random port.
 * Must be called once in a top-level beforeAll.
 */
export async function bootServer() {
  process.env.SKIP_AUTH_SETUP = "true";
  process.env.NODE_ENV = "test";

  serverModule = await import("../../index.js");
  httpServer = serverModule.httpServer;

  await new Promise((resolve) => {
    if (httpServer.listening) {
      serverPort = httpServer.address().port;
      return resolve();
    }
    httpServer.listen(0, "127.0.0.1", () => {
      serverPort = httpServer.address().port;
      resolve();
    });
  });

  return { httpServer, port: serverPort };
}

/**
 * Shut down the server.  Call in afterAll.
 */
export async function shutdownServer() {
  if (httpServer?.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await closeRoomStore();
}

/**
 * Create a connected Socket.IO test client.
 * Resolves once the client is connected.
 */
export function createClient() {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      reconnectionDelay: 0,
      forceNew: true,
      transports: ["websocket"],
    });
    client.on("connect", () => resolve(client));
    client.on("connect_error", reject);
  });
}

/**
 * Emit an event and collect the acknowledgement callback value.
 */
export function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (ack) => resolve(ack));
  });
}

/**
 * Wait for a specific event on a socket. Times out after `ms`.
 */
export function waitForEvent(socket, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      ms,
    );
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Emit an event AND simultaneously wait for a response event.
 * Sets up the listener before emitting to avoid race conditions.
 * Returns { ack, event } where ack is the callback result and event is the listened data.
 */
export function emitAndWait(socket, emitEvent, data, listenEvent = "roomState", ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${listenEvent}" after "${emitEvent}"`)),
      ms,
    );

    let ack = undefined;
    let eventData = undefined;
    let ackDone = false;
    let eventDone = false;

    function tryResolve() {
      if (ackDone && eventDone) {
        clearTimeout(timer);
        resolve({ ack, event: eventData });
      }
    }

    socket.once(listenEvent, (d) => {
      eventData = d;
      eventDone = true;
      tryResolve();
    });

    socket.emit(emitEvent, data, (a) => {
      ack = a;
      ackDone = true;
      tryResolve();
    });
  });
}

/**
 * Disconnect an array of client sockets.
 */
export function disconnectAll(...clients) {
  for (const c of clients.flat()) {
    if (c?.connected) c.disconnect();
  }
}
