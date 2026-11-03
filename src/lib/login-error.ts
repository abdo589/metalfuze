/** Do not describe connection/service failures as incorrect credentials. */
export function loginErrorMessage(error: { code?: string; status?: number; name?: string }) {
  if (error.status === 429 || error.code === "over_request_rate_limit") return "محاولات دخول كثيرة، انتظر قليلًا وحاول مرة أخرى";
  if (error.name === "AuthRetryableFetchError" || error.status === 0 || (error.status !== undefined && error.status >= 500)) return "تعذر الاتصال بخدمة تسجيل الدخول، حاول مرة أخرى";
  return "اسم المستخدم أو كلمة المرور غير صحيحة";
}