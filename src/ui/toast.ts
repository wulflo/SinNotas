/** Notificaciones flotantes de la app de escritorio. */

const toastNotification = document.getElementById("toast-notification") as HTMLDivElement;

let toastTimeout: number | null = null;
export function showToast(message: string, duration = 2500): void {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastNotification.innerText = message;
  toastNotification.classList.add("visible");
  toastTimeout = window.setTimeout(() => {
    toastNotification.classList.remove("visible");
  }, duration);
}

window.addEventListener("vault-operation-error", (event) => {
  const message = (event as CustomEvent<string>).detail;
  if (message) showToast(message);
});
