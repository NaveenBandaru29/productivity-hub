import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function notificationAccess() {
  return (await Notifications.getPermissionsAsync()).granted;
}
export async function requestWellbeingAlerts() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("wellbeing", {
      name: "Digital Wellbeing", importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return await notificationAccess() || (await Notifications.requestPermissionsAsync()).granted;
}
