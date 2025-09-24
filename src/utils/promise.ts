/**
 * Wraps a Promise with a timeout functionality. If the Promise does not resolve or reject within the specified time,
 * it will reject with the provided error message.
 *
 * @param {Promise<T>} p - The promise to be wrapped with a timeout.
 * @param {number} ms - The timeout duration in milliseconds.
 * @param {string} msg - The error message for rejecting when the timeout occurs.
 * @return {Promise<T>} A new promise that either resolves or rejects based on the input promise or the timeout.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.finally(() => clearTimeout(t)).then(resolve, reject);
  });
}