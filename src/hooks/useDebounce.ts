// src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

/**
 * Debounce a changing value by a specified delay (milliseconds).
 * Returns a "settled" value that updates only after the input has remained unchanged for the full delay.
 * If the input changes during the delay, the pending update is canceled and a new timer starts.
 *
 * @template T
 * @param {T} value - The raw (rapidly changing) input value to debounce.
 * @param {number} delay - The debounced duration in milliseconds.
 * @returns {T} The debounced value.
 */
export function useDebounce<T>(value:T, delay: number): T {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
        }, [value, delay]);
    return debounced;
}

