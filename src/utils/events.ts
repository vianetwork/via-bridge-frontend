// Create a simple event system for cross-component communication

type EventListener<T> = (data: T) => void;

export interface EventEmitter<T> {
  on: (listener: EventListener<T>) => () => void;
  emit: (data?: T) => void;
}

export function createEvent<T>(name: string): EventEmitter<T> {
  const listeners = new Set<EventListener<T>>();
  
  // Use name for debugging
  const debugPrefix = `[Event: ${name}]`;

  return {
    on: (listener: EventListener<T>) => {
      console.debug(`${debugPrefix} Listener added`);
      listeners.add(listener);
      return () => {
        console.debug(`${debugPrefix} Listener removed`);
        listeners.delete(listener);
      };
    },
    emit: (data?: T) => {
      console.debug(`${debugPrefix} Event emitted`, data);
      listeners.forEach(listener => {
        listener(data as T);
      });
    }
  };
}
