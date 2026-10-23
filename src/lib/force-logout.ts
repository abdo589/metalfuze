/** A session must end when a forced sign-out was issued after that session signed in. */
export function shouldForceOut(signedInAt: string | null | undefined, forceAt: string | null | undefined) {
  if (!forceAt) return false;
  if (!signedInAt) return true;
  return new Date(forceAt).getTime() > new Date(signedInAt).getTime();
}
