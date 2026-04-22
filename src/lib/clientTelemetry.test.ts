import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the supabase client BEFORE importing the module under test.
const insertMock = vi.fn(() => Promise.resolve({ error: null }));
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

// Stable session id so we don't depend on randomness.
vi.mock("@/lib/session", () => ({
  getSessionId: () => "test-session-id",
}));

import { trackClientEvent } from "./clientTelemetry";

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
  insertMock.mockImplementation(() => Promise.resolve({ error: null }));
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("trackClientEvent", () => {
  it("sends exactly one insert on the first call (default oncePerSession)", async () => {
    await trackClientEvent("webp_unsupported");
    expect(fromMock).toHaveBeenCalledWith("client_telemetry");
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "webp_unsupported",
        session_id: "test-session-id",
      }),
    );
  });

  it("dedupes the same event within one session", async () => {
    await trackClientEvent("webp_unsupported");
    await trackClientEvent("webp_unsupported");
    await trackClientEvent("webp_unsupported");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes per-event-type independently in the same session", async () => {
    await trackClientEvent("webp_unsupported");
    await trackClientEvent("webp_fallback_used");
    await trackClientEvent("webp_unsupported"); // dup, should not insert
    await trackClientEvent("webp_fallback_used"); // dup, should not insert
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("with oncePerSession=false, every call dispatches an insert", async () => {
    await trackClientEvent("webp_fallback_used", undefined, { oncePerSession: false });
    await trackClientEvent("webp_fallback_used", undefined, { oncePerSession: false });
    await trackClientEvent("webp_fallback_used", undefined, { oncePerSession: false });
    expect(insertMock).toHaveBeenCalledTimes(3);
  });

  it("does not throw when sessionStorage.getItem throws", async () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    await expect(trackClientEvent("webp_unsupported")).resolves.toBeUndefined();
    // Catching getItem returns false → not "alreadySent" → still attempts insert.
    expect(insertMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("does not throw when supabase.insert rejects (fire-and-forget)", async () => {
    insertMock.mockImplementationOnce(() => Promise.reject(new Error("boom")));
    await expect(trackClientEvent("webp_unsupported")).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("forwards the meta payload to insert", async () => {
    await trackClientEvent("webp_fallback_used", { foo: "bar", n: 3 });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "webp_fallback_used",
        meta: { foo: "bar", n: 3 },
      }),
    );
  });
});
