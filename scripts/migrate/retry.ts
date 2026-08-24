type RetryOptions = {
  attempts?: number;
  delay?: (milliseconds: number) => Promise<void>;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delay = options.delay ?? wait;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(250 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
