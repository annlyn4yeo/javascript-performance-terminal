const encoder = new TextEncoder();

type StreamPayload =
  | { type: "step"; message: string }
  | { type: "result"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

const streamDelay = (duration: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

const createEventChunk = (payload: StreamPayload) =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Missing url query param" })}\n\n`),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const payloads: StreamPayload[] = [
        { type: "step", message: "\u25B6 Fetching page..." },
        { type: "step", message: "\u25B6 Detecting framework..." },
        { type: "step", message: "\u25B6 Discovering scripts..." },
        { type: "result", message: "\u2713 Done" },
        { type: "done" },
      ];

      for (const payload of payloads) {
        controller.enqueue(createEventChunk(payload));
        await streamDelay(500);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
