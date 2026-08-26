import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthStackParamList } from "./types";
import { WelcomeScreen } from "@/screens/auth/WelcomeScreen";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { RegisterScreen } from "@/screens/auth/RegisterScreen";
import { ForgotPasswordScreen } from "@/screens/auth/ForgotPasswordScreen";
import { OTPLoginScreen } from "@/screens/auth/OTPLoginScreen";
import { getWelcomeSeen } from "@/utils/storage";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  // Decided once, before the navigator ever mounts — initialRouteName only
  // takes effect on first render, so this has to resolve before rendering
  // the Stack at all. A brand-new device (or one that's never gotten past
  // Welcome) starts there; anyone who's already seen it goes straight to
  // Login, same as signing back in normally.
  const [initialRoute, setInitialRoute] = useState<"Welcome" | "Login" | null>(null);

  useEffect(() => {
    getWelcomeSeen().then((seen) => setInitialRoute(seen ? "Login" : "Welcome"));
  }, []);

  if (!initialRoute) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTPLogin" component={OTPLoginScreen} />
    </Stack.Navigator>
  );
}
