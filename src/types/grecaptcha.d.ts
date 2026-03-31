export {};

declare global {
  type Grecaptcha = {
    ready(cb: () => void): void;
    execute(siteKey: string, opts: { action: string }): Promise<string>;
  };

  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

