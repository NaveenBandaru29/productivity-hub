package app.minimal.wellbeing

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId

internal object UsageAdvisories {
  private const val CHANNEL = "wellbeing"
  private const val TAG = "wellbeing:"

  private fun rules(array: JSONArray?): List<JSONObject> =
    (0 until (array?.length() ?: 0)).mapNotNull { array?.optJSONObject(it) }

  private fun JSONArray?.containsValue(value: String): Boolean =
    (0 until (this?.length() ?: 0)).any { this?.optString(it) == value }

  fun dismiss(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.activeNotifications.filter { it.tag?.startsWith(TAG) == true }.forEach {
      manager.cancel(it.tag, it.id)
    }
  }

  fun evaluate(context: Context, db: UsageDatabase, policy: JSONObject, now: Long, zone: ZoneId, visible: String?) {
    if (!policy.optBoolean("warningsEnabled")) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (!manager.areNotificationsEnabled()) return
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Digital Wellbeing", NotificationManager.IMPORTANCE_DEFAULT))
    if (manager.getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) return
    val today = localDay(now, zone)
    val date = today.toString()
    val labels = AppLabels(context)
    val apps = db.apps(date, date)[date].orEmpty()

    fun send(token: String, title: String, body: String, section: String, id: String) {
      if (db.alreadySent(date, token)) return
      val uri = Uri.parse("productivityhub:///wellbeing").buildUpon()
        .appendQueryParameter("section", section).appendQueryParameter("ruleId", id).build()
      val open = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val intent = PendingIntent.getActivity(context, token.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      val notice = Notification.Builder(context, CHANNEL).setContentTitle(title).setContentText(body)
        .setSmallIcon(context.applicationInfo.icon).setVisibility(Notification.VISIBILITY_PRIVATE)
        .setContentIntent(intent).setOnlyAlertOnce(true).setAutoCancel(true).build()
      try {
        manager.notify(TAG + token, 1, notice)
        db.markSent(date, token)
      } catch (_: SecurityException) { /* Permission can change between the check and notify. */ }
    }

    for (rule in rules(policy.optJSONArray("limits"))) {
      val target = rule.optString("target")
      val id = rule.optString("id")
      val minutes = rule.optInt("minutes")
      if (minutes <= 0 || target.isBlank() || id.isBlank()) continue
      val isApp = rule.optString("targetType") == "app"
      val used = if (isApp) apps[target]?.duration ?: 0L
        else apps.filterKeys { labels.get(it).category == target }.values.sumOf { it.duration }
      val name = if (isApp) labels.get(target).label else target
      val extended = rule.optString("extensionDay") == date
      val threshold = (minutes.toLong() + if (extended) 10L else 0L) * 60_000L
      val reached = "limit/$id/" + if (extended) "extended" else "reached"
      if (used >= threshold) {
        send(reached, "Daily limit reached", "$name has reached your daily time limit.", "limits", id)
      } else if (rule.optBoolean("warnAt80") && used >= threshold * 4 / 5 &&
        !db.alreadySent(date, "limit/$id/reached")) {
        send("limit/$id/80", "Approaching your limit", "You’ve used 80% of your time for $name.", "limits", id)
      }
    }

    if (visible == null) return
    val category = labels.get(visible).category
    fun matches(rule: JSONObject) = rule.optJSONArray("apps").containsValue(visible) ||
      rule.optJSONArray("categories").containsValue(category)
    val sessions = mutableListOf<String>()
    for (rule in rules(policy.optJSONArray("focusSessions"))) {
      if (matches(rule) && now >= rule.optLong("startAt") && now < rule.optLong("endAt")) sessions.add(rule.getString("id"))
    }
    for (rule in rules(policy.optJSONArray("focusSchedules"))) {
      if (!matches(rule)) continue
      val minute = rule.optInt("startMinute", -1)
      if (minute !in 0..1439) continue
      for (day in listOf(today.minusDays(1), today)) {
        if (!rule.optJSONArray("days").containsValue((day.dayOfWeek.value % 7).toString())) continue
        val start = day.atTime(minute / 60, minute % 60).atZone(zone).toInstant().toEpochMilli()
        val occurrence = rule.getString("id") + "/" + day
        if (start >= rule.optLong("startsAfter") && now >= start && now < start + rule.optLong("durationMinutes") * 60_000 &&
          !policy.optJSONArray("suppressions").containsValue(occurrence)) sessions.add(occurrence)
      }
    }
    val pending = sessions.distinct().filterNot { db.alreadySent(date, "focus/$it/$visible") }
    if (pending.isNotEmpty()) {
      val first = pending.first()
      send("focus/$first/$visible", "Focus is active", labels.get(visible).label + " is on your focus list.", "focus", first)
      if (db.alreadySent(date, "focus/$first/$visible")) pending.drop(1).forEach { db.markSent(date, "focus/$it/$visible") }
    }
  }
}
