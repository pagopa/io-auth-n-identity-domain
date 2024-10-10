export type LoggerPort = {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
};
