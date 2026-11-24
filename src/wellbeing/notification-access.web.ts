export async function notificationAccess() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}
export async function requestWellbeingAlerts() {
  if (typeof Notification === "undefined") return false;
  return Notification.permission === "granted" ||
    (Notification.permission === "default" && await Notification.requestPermission() === "granted");
}
