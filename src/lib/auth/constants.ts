export const INVITE_COOKIE = "homie_invite";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MS = 5 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Used only while Supabase is not configured. A filled .env.local replaces this with email OTP. */
export const DEMO_OTP = "123456";

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
