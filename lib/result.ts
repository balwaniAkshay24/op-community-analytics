import type { StatbotResult } from "./statbot/client";

/** Apply `fn` to a successful result; otherwise return the error message. */
export function read<T, R>(
  result: StatbotResult<T>,
  fn: (data: T) => R,
): { value: R | null; error: string | null } {
  if (!result.ok) return { value: null, error: result.error };
  try {
    return { value: fn(result.data), error: null };
  } catch (err) {
    return {
      value: null,
      error: `Couldn't read this response: ${(err as Error).message}`,
    };
  }
}
