/**
 * utils/paymentGateway.ts
 * ------------------------
 * Builds the checkout HTML rendered inside GatewayCheckoutWebView
 * (src/components/GatewayCheckoutWebView.tsx) for a GatewayOrder, as
 * returned by PortalBookView — mirrors frontend/src/utils/paymentGateway.js
 * almost exactly (same provider branching, same checkout.js/cashfree-js
 * scripts, same options), just running inside a WebView's embedded browser
 * instead of a real browser tab. Chosen over Razorpay's/Cashfree's native
 * React Native SDKs specifically because those require a custom EAS
 * "dev client" build (they're not part of plain Expo Go's bundled native
 * modules) — WebView is a plain Expo Go-compatible module, so this keeps
 * the fast QR-scan-and-go dev loop working with no separate native build.
 *
 * IMPORTANT: neither the checkout page nor its postMessage result marks
 * anything as paid — the gateway webhook (server-side, signature-verified)
 * is the only source of truth, same as web. Callers must re-fetch the real
 * payment_status from the backend after the checkout closes (see
 * pollUntilTrue below), showing a "confirming" state in the meantime
 * rather than assuming success.
 */
import type { GatewayOrder } from "@/api/types";

export interface CheckoutResult {
  completed: boolean;
  failed?: boolean;
  error?: string;
}

export interface CheckoutOpts {
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
}

// Shared page chrome — a plain white body is enough since both SDKs render
// their own modal/overlay chrome on top; posts back to React Native via the
// WebView bridge injected by react-native-webview (window.ReactNativeWebView).
function page(bodyScript: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>html,body{margin:0;padding:0;background:#fff;height:100%;}</style>
</head>
<body>
<script>
  function post(result) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(result));
    }
  }
</script>
${bodyScript}
</body>
</html>`;
}

function razorpayHtml(order: GatewayOrder, opts: CheckoutOpts): string {
  const amountPaise = order.amount_paise ?? Math.round(Number(order.amount) * 100);
  const options = {
    key: order.key_id || "",
    amount: String(amountPaise),
    currency: order.currency || "INR",
    name: opts.name || "Atomwalk HMS",
    description: opts.description || "",
    order_id: order.order_id,
    prefill: opts.prefill || {},
  };
  return page(`
<script src="https://checkout.razorpay.com/v1/checkout.js" onerror="post({completed:false,error:'Could not load the payment window. Check your connection and try again.'})"></script>
<script>
  try {
    var options = ${JSON.stringify(options)};
    options.handler = function () { post({ completed: true }); };
    options.modal = { ondismiss: function () { post({ completed: false }); } };
    var rzp = new Razorpay(options);
    rzp.on("payment.failed", function (resp) {
      post({ completed: false, failed: true, error: resp && resp.error && resp.error.description });
    });
    rzp.open();
  } catch (e) {
    post({ completed: false, error: (e && e.message) || "Could not open the payment window." });
  }
</script>`);
}

function cashfreeHtml(order: GatewayOrder): string {
  const mode = order.environment === "production" ? "production" : "sandbox";
  return page(`
<script src="https://sdk.cashfree.com/js/v3/cashfree.js" onerror="post({completed:false,error:'Could not load the payment window. Check your connection and try again.'})"></script>
<script>
  (async function () {
    try {
      var cashfree = window.Cashfree({ mode: ${JSON.stringify(mode)} });
      var result = await cashfree.checkout({
        paymentSessionId: ${JSON.stringify(order.payment_session_id || "")},
        redirectTarget: "_modal",
      });
      // Resolves once the modal closes, for any reason — same "not proof,
      // just a hint to go check" caveat as the web app's own handler.
      post({ completed: !(result && result.error), error: result && result.error && result.error.message });
    } catch (e) {
      post({ completed: false, error: (e && e.message) || "The payment window closed unexpectedly." });
    }
  })();
</script>`);
}

/** Branches on order.provider and builds the matching checkout page. */
export function buildCheckoutHtml(order: GatewayOrder, opts: CheckoutOpts = {}): string {
  if (order.provider === "razorpay") return razorpayHtml(order, opts);
  if (order.provider === "cashfree") return cashfreeHtml(order);
  return page(`<script>post({completed:false,error:${JSON.stringify(`Unsupported payment provider: ${order.provider}`)}});</script>`);
}

/**
 * Polls `check()` (should return true once the thing being waited on is
 * confirmed) every `intervalMs`, up to `attempts` times. Used after a
 * checkout closes — the gateway webhook that actually flips payment_status
 * to "paid" is server-to-server and typically near-instant, but never
 * synchronous with the checkout UI closing, so callers show a "confirming"
 * state while this runs rather than assuming either outcome.
 */
export async function pollUntilTrue(check: () => Promise<boolean>, { attempts = 5, intervalMs = 2000 } = {}): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      if (await check()) return true;
    } catch {
      // transient — keep polling rather than giving up on one failed request
    }
  }
  return false;
}
