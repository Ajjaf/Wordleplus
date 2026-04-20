import request from "supertest";
import { closeRoomStore } from "../room-store.js";

let app;
let httpServer;

beforeAll(async () => {
  process.env.SKIP_AUTH_SETUP = "true";
  process.env.NODE_ENV = "test";
  const serverModule = await import("../index.js");
  app = serverModule.app;
  httpServer = serverModule.httpServer;
});

afterAll(async () => {
  if (httpServer?.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await closeRoomStore();
});

describe("Health endpoint", () => {
  it("returns health info with expected fields", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toHaveProperty("status");
    expect(["ok", "degraded"]).toContain(response.body.status);
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body).toHaveProperty("wordLists");
    expect(response.body.wordLists.words).toBeGreaterThan(0);
    expect(response.body.wordLists.guesses).toBeGreaterThan(0);
    expect(response.body).toHaveProperty("activeRooms");
  });
});

describe("Readiness and liveness endpoints", () => {
  it("/ready returns ready:true when word lists are loaded", async () => {
    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ready: true });
  });

  it("/alive returns alive:true", async () => {
    const response = await request(app).get("/alive");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ alive: true });
  });
});

describe("Word routes", () => {
  it("returns valid=false when word is missing", async () => {
    const response = await request(app).get("/api/validate");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("returns a random five-letter uppercase word", async () => {
    const response = await request(app).get("/api/random-word");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("word");
    expect(typeof response.body.word).toBe("string");
    expect(response.body.word).toMatch(/^[A-Z]{5}$/);
  });
});
