import { useRef, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, Pressable, Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "@/components/Layout";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { HealthNetLogo } from "@/components/Logo";
import { BookIllustration, DocsIllustration, ShareIllustration } from "@/components/Illustrations";
import { BRAND_TEXT, NEUTRAL } from "@/theme/themes";
import { setWelcomeSeen } from "@/utils/storage";
import { AuthStackParamList } from "@/navigation/types";

/** Three short slides: what the app is for, how records get in, how sharing stays safe. */
const SLIDES = [
  { key: "book", Art: BookIllustration, title: "Your health record, always in your pocket", body: "Book appointments, see prescriptions, and track your family's care — across one hospital or twenty." },
  { key: "docs", Art: DocsIllustration, title: "Every report, in one place", body: "Snap a photo or scan the hospital QR. HealthNet reads it and files it by type and date." },
  { key: "share", Art: ShareIllustration, title: "Share safely, for two hours", body: "Read a code to your doctor. They see your records for 2 hours, then access ends on its own." },
];

// First screen a brand-new install ever sees — states what the app is for before asking for anything, then never
// appears again on this device (see getWelcomeSeen/setWelcomeSeen): a later sign-out drops straight back on Login.
export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pageW = width;

  const proceed = async (screen: "Register" | "Login") => {
    try {
      await setWelcomeSeen();
    } catch {
      // Not remembering it only means Welcome shows once more next launch.
    }
    navigation.replace(screen);
  };

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW));

  return (
    <Screen scroll={false} topColor={NEUTRAL.bg}>
      <View style={styles.top}>
        <HealthNetLogo size={56} />
        <Pressable onPress={() => proceed("Login")} hitSlop={10} accessibilityRole="button">
          <Text style={styles.skip}>Sign in</Text>
        </Pressable>
      </View>

      <Animated.FlatList
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={onMomentum}
        renderItem={({ item, index: i }) => {
          const range = [(i - 1) * pageW, i * pageW, (i + 1) * pageW];
          const lift = scrollX.interpolate({ inputRange: range, outputRange: [40, 0, -40], extrapolate: "clamp" });
          const fade = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: "clamp" });
          return (
            <View style={[styles.slide, { width: pageW }]}>
              <Animated.View style={{ transform: [{ translateX: lift }], opacity: fade, alignItems: "center" }}>
                <item.Art width={Math.min(300, pageW - 64)} />
              </Animated.View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={styles.dots} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => {
          const range = [(i - 1) * pageW, i * pageW, (i + 1) * pageW];
          const w = scrollX.interpolate({ inputRange: range, outputRange: [0.34, 1, 0.34], extrapolate: "clamp" });
          const c = scrollX.interpolate({ inputRange: range, outputRange: [0.25, 1, 0.25], extrapolate: "clamp" });
          return <Animated.View key={s.key} style={[styles.dot, { opacity: c, transform: [{ scaleX: w }] }]} />;
        })}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Create account" onPress={() => proceed("Register")} />
        <SecondaryButton label="I already have an account" onPress={() => proceed("Login")} style={{ marginTop: 10 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28, paddingTop: 12 },
  skip: { fontSize: 14, fontWeight: "800", color: BRAND_TEXT },
  bleed: { flexGrow: 1 },
  slide: { paddingHorizontal: 28, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", color: NEUTRAL.textPrimary, letterSpacing: -0.7, lineHeight: 34, marginTop: 24 },
  body: { fontSize: 15, color: NEUTRAL.textSecondary, lineHeight: 22, marginTop: 10 },
  dots: { flexDirection: "row", justifyContent: "center", gap: -6, paddingVertical: 14 },
  dot: { width: 24, height: 8, borderRadius: 4, backgroundColor: "#0C8A63" },
  actions: { paddingHorizontal: 16, paddingBottom: 18 },
});
