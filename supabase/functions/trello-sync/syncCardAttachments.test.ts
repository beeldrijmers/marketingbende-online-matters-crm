// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import WITHOUT the .ts extension (Vitest "functions" project convention).
import {
  attachmentMarker,
  attachmentNoteText,
  readBodyWithCap,
  storageNameFor,
  syncCardAttachments,
} from "./syncCardAttachments";

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockCreateSignedUrl = vi.hoisted(() => vi.fn());
vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  },
}));

vi.mock("./resolveDefaultSalesId.ts", () => ({
  resolveDefaultSalesId: async () => 1,
}));

const baseAttachment = {
  id: "att123",
  name: "Offerte klant.pdf",
  url: "https://trello.com/1/cards/c1/attachments/att123/download/offerte.pdf",
  mimeType: "application/pdf",
  bytes: 1024,
  date: "2026-05-01T10:00:00.000Z",
  fileName: "offerte.pdf",
};

const dealNotesQuery = (existing: unknown) => ({
  select: () => ({
    eq: () => ({
      like: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: existing, error: null }),
        }),
      }),
    }),
  }),
  insert: mockInsert,
});
const mockInsert = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ error: null })),
);

describe("storage/note helpers", () => {
  it("builds a deterministic marker and note text", () => {
    expect(attachmentMarker("att123")).toBe("[trello-bijlage:att123]");
    expect(attachmentNoteText(baseAttachment)).toContain("Offerte klant.pdf");
    expect(attachmentNoteText(baseAttachment)).toContain(
      "[trello-bijlage:att123]",
    );
  });

  it("derives the storage name from the attachment id plus extension", () => {
    expect(storageNameFor(baseAttachment)).toBe("trello-att123.pdf");
    expect(
      storageNameFor({ id: "x", name: "Zonder extensie", fileName: null }),
    ).toBe("trello-x");
    expect(storageNameFor({ id: "y", name: "FOTO.JPG", fileName: null })).toBe(
      "trello-y.jpg",
    );
  });
});

describe("syncCardAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSignedUrl.mockResolvedValue({
      data: {
        signedUrl:
          "https://cdn.example/attachments/trello-att123.pdf?token=signed",
      },
      error: null,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a new attachment with Trello auth and attaches it as a note", async () => {
    mockFrom.mockImplementation(() => dealNotesQuery(null));
    mockStorageUpload.mockResolvedValue({ error: null });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(new ArrayBuffer(8), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const imported = await syncCardAttachments({
      dealId: 7,
      attachments: [baseAttachment],
      apiKey: "KEY",
      token: "TOKEN",
    });

    expect(imported).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(baseAttachment.url, {
      headers: {
        Authorization: 'OAuth oauth_consumer_key="KEY", oauth_token="TOKEN"',
      },
    });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "trello-att123.pdf",
      expect.anything(),
      { contentType: "application/pdf", upsert: true },
    );
    expect(mockInsert).toHaveBeenCalledWith({
      deal_id: 7,
      text: attachmentNoteText(baseAttachment),
      sales_id: 1,
      activity_source: "trello",
      attachments: [
        {
          title: "Offerte klant.pdf",
          type: "application/pdf",
          path: "trello-att123.pdf",
          src: "https://cdn.example/attachments/trello-att123.pdf?token=signed",
        },
      ],
      date: baseAttachment.date,
    });
  });

  it("skips an attachment that was already imported (marker exists)", async () => {
    mockFrom.mockImplementation(() => dealNotesQuery({ id: 99 }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const imported = await syncCardAttachments({
      dealId: 7,
      attachments: [baseAttachment],
      apiKey: "KEY",
      token: "TOKEN",
    });

    expect(imported).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips oversized attachments without downloading", async () => {
    mockFrom.mockImplementation(() => dealNotesQuery(null));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const imported = await syncCardAttachments({
      dealId: 7,
      attachments: [{ ...baseAttachment, bytes: 26 * 1024 * 1024 }],
      apiKey: "KEY",
      token: "TOKEN",
    });

    expect(imported).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a failing download and continues with the next attachment", async () => {
    mockFrom.mockImplementation(() => dealNotesQuery(null));
    mockStorageUpload.mockResolvedValue({ error: null });
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        (url as string).includes("att123")
          ? new Response("boom", { status: 500 })
          : new Response(new ArrayBuffer(8), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const second = {
      ...baseAttachment,
      id: "att456",
      fileName: "logo.png",
      url: "https://trello.com/1/cards/c1/attachments/att456/download/logo.png",
    };
    const imported = await syncCardAttachments({
      dealId: 7,
      attachments: [baseAttachment, second],
      apiKey: "KEY",
      token: "TOKEN",
    });

    expect(imported).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe("readBodyWithCap", () => {
  it("rejects a download whose Content-Length exceeds the cap", async () => {
    const response = new Response("x", {
      headers: { "content-length": "2048" },
    });
    expect(await readBodyWithCap(response, 1024)).toBe(null);
  });

  it("aborts a streamed download without Content-Length once it exceeds the cap", async () => {
    const chunk = new Uint8Array(512);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const response = new Response(stream);
    response.headers.delete("content-length");
    expect(await readBodyWithCap(response, 1024)).toBe(null);
  });

  it("returns the full body when it fits within the cap", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
        controller.close();
      },
    });
    const response = new Response(stream);
    const body = await readBodyWithCap(response, 1024);
    expect(body).not.toBe(null);
    expect(Array.from(body as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
  });
});
