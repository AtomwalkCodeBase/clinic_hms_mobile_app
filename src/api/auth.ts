import { api } from "./client";
import type { Envelope, LoginResponse } from "./types";

/**
 * POST /api/v1/auth/login/patient/ — {mobile, password} accepts mobile, AWPID, or email.
 * Response is wrapped in the {success,message,data} envelope — confirmed against
 * PatientLoginView's `return success(data=_make_tokens(payload), ...)` in
 * apps/auth_app/views.py:290. data contains only {access, refresh}.
 */
export async function loginPatient(mobile: string, password: string) {
  const res = await api.post<Envelope<LoginResponse>>("/auth/login/patient/", { mobile, password });
  return res.data.data;
}

export async function logout(refresh: string | null) {
  await api.post("/auth/logout/", refresh ? { refresh } : {});
}

/**
 * POST /api/v1/auth/otp/request/ — {purpose, identifier} -> {channel, masked_identifier}
 * purpose="registration_patient" requires an email identifier — mobile OTP
 * isn't wired up yet (see apps/auth_app/otp_views.py's own comment: a paid
 * SMS gateway isn't configured, email is free via the already-live SMTP).
 */
export async function registerRequestOtp(email: string) {
  const res = await api.post<Envelope<{ channel: string; masked_identifier: string }>>("/auth/otp/request/", {
    purpose: "registration_patient",
    identifier: email,
  });
  return res.data;
}

/**
 * POST /api/v1/auth/otp/verify/ — {purpose, identifier, code} -> {action_token}
 * The action_token is what actually proves the email was verified —
 * PortalRegisterView derives the account's email from it, not from
 * anything sent directly in the register call below.
 */
export async function registerVerifyOtp(email: string, otp: string) {
  const res = await api.post<Envelope<{ action_token: string }>>("/auth/otp/verify/", {
    purpose: "registration_patient",
    identifier: email,
    code: otp,
  });
  return res.data.data.action_token;
}

/** POST /api/v1/portal/register/ — {action_token, full_name, mobile, password, gender?, date_of_birth?} */
export async function registerAccount(payload: {
  action_token: string;
  full_name: string;
  mobile: string;
  password: string;
  gender?: string;
  date_of_birth?: string;
}) {
  const res = await api.post<Envelope<{ awpid: string; mobile: string }>>("/portal/register/", payload);
  return res.data;
}

/**
 * POST /api/v1/auth/otp/request/ — {purpose: "password_reset_patient", identifier} -> {channel, masked_identifier}
 * The backend also accepts mobile/AWPID here, but the app only ever sends
 * an email — SMS delivery isn't actually configured yet (core/sms.py just
 * logs the code server-side unless a paid MSG91 account is wired up), so a
 * mobile-number identifier would "succeed" without the code ever arriving.
 */
export async function forgotPasswordRequestOtp(identifier: string) {
  const res = await api.post<Envelope<{ channel: string; masked_identifier: string }>>("/auth/otp/request/", {
    purpose: "password_reset_patient",
    identifier,
  });
  return res.data;
}

/** POST /api/v1/auth/otp/verify/ — {purpose: "password_reset_patient", identifier, code} -> {action_token} */
export async function forgotPasswordVerifyOtp(identifier: string, code: string) {
  const res = await api.post<Envelope<{ action_token: string }>>("/auth/otp/verify/", {
    purpose: "password_reset_patient",
    identifier,
    code,
  });
  return res.data.data.action_token;
}

/** POST /api/v1/auth/forgot-password/patient/reset/ — {action_token, new_password, confirm_password} */
export async function resetPassword(actionToken: string, newPassword: string, confirmPassword: string) {
  const res = await api.post<Envelope<null>>("/auth/forgot-password/patient/reset/", {
    action_token: actionToken,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
  return res.data;
}

/**
 * POST /api/v1/auth/otp/request/ — {purpose: "login_patient", identifier} -> {channel, masked_identifier}
 * Day-to-day passwordless sign-in. Email-only for the same reason as
 * forgotPasswordRequestOtp above — SMS isn't actually configured yet.
 */
export async function otpLoginRequestOtp(email: string) {
  const res = await api.post<Envelope<{ channel: string; masked_identifier: string }>>("/auth/otp/request/", {
    purpose: "login_patient",
    identifier: email,
  });
  return res.data;
}

/** POST /api/v1/auth/otp/verify/ — {purpose: "login_patient", identifier, code} -> {action_token} */
export async function otpLoginVerifyOtp(email: string, code: string) {
  const res = await api.post<Envelope<{ action_token: string }>>("/auth/otp/verify/", {
    purpose: "login_patient",
    identifier: email,
    code,
  });
  return res.data.data.action_token;
}

/**
 * POST /api/v1/auth/login/patient/otp/ — {action_token} -> {access, refresh}
 * Consumes a login_patient-purpose action_token, issues the same JWT pair
 * shape as loginPatient above.
 */
export async function otpLogin(actionToken: string) {
  const res = await api.post<Envelope<LoginResponse>>("/auth/login/patient/otp/", { action_token: actionToken });
  return res.data.data;
}
