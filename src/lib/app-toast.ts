export const APP_TOAST_SUCCESS = "app-toast-success";

export type AppToastDetail = { message: string };

export function toastSuccess(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_SUCCESS, { detail: { message } satisfies AppToastDetail }));
}
