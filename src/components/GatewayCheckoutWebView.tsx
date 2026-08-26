import React, { useRef } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { buildCheckoutHtml, CheckoutOpts, CheckoutResult } from "@/utils/paymentGateway";
import { GatewayOrder } from "@/api/types";

/**
 * Full-screen modal hosting the Razorpay/Cashfree checkout page (see
 * utils/paymentGateway.ts for what's actually loaded into it). Resolves via
 * onClose for ANY reason the checkout ends — paid, cancelled, failed, or the
 * patient tapping the X — with `{completed}` true only meaning the checkout
 * flow itself finished, never proof of payment (see that module's docstring).
 * A ref guards against onClose firing twice (e.g. a postMessage arriving
 * right as the patient also taps X) since the caller treats each close as a
 * one-time transition (confirm-or-cancel), not an idempotent event.
 */
export function GatewayCheckoutWebView({
  visible,
  order,
  name,
  description,
  onClose,
}: {
  visible: boolean;
  order: GatewayOrder | null | undefined;
  name?: string;
  description?: string;
  onClose: (result: CheckoutResult) => void;
}) {
  const settledRef = useRef(false);

  if (!visible || !order) return null;

  const finish = (result: CheckoutResult) => {
    if (settledRef.current) return;
    settledRef.current = true;
    onClose(result);
  };

  const opts: CheckoutOpts = { name, description };
  const html = buildCheckoutHtml(order, opts);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => finish({ completed: false })}
      onShow={() => {
        settledRef.current = false;
      }}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => finish({ completed: false })} hitSlop={10} style={styles.closeBtn}>
            <X size={20} color={NEUTRAL.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.title}>Complete payment</Text>
          <View style={{ width: 36 }} />
        </View>
        <WebView
          source={{ html }}
          onMessage={(e) => {
            try {
              const result = JSON.parse(e.nativeEvent.data) as CheckoutResult;
              finish(result);
            } catch {
              finish({ completed: false, error: "Unexpected response from the payment window." });
            }
          }}
          onError={() => finish({ completed: false, error: "Could not load the payment window. Check your connection and try again." })}
          startInLoadingState
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NEUTRAL.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.surfaceAlt },
  title: { fontSize: 14, fontWeight: "600", color: NEUTRAL.textPrimary },
});
