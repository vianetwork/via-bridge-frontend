/* Dev-only mock for fee estimation. This route is guarded so it cannot be used in production by accident. */
const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_MOCKS === "1";

export async function GET(req: Request) {
  if (!isDev)  return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const sp = url.searchParams;

  const amountRaw = sp.get("amount");
  const amount = Number(amountRaw ?? "0");
  const delayMs = Number(sp.get("delay") ?? "300"); // simulate network latency
  const shouldFail = sp.get("fail") === "1"; // simulate server error

  // Simulate latency (even for invalid/failing paths so cancellation is realistic)
  await new Promise((r) => setTimeout(r, Number.isFinite(delayMs) ? delayMs : 300));

  if (shouldFail)  return Response.json({ success: false, data: 0, message: "Mock failure (forced via ?fail=1)" }, { status: 500 });
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ success: false, data: 0, message: "Invalid amount" }, { status: 400 });

  // Simple synthetic fee: 0.5% of the amount + 250 sats, rounded down
  const fee = Math.floor(amount * 0.005) + 250;
  return Response.json({ success: true, data: fee, message: "" });
}
