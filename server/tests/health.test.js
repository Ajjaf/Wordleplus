import request from "supertest";

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
});

describe("Health endpoint", () => {
  it("returns ok:true", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ ok: true });
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
