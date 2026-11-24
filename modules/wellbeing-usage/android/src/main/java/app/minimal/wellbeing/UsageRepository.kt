package app.minimal.wellbeing

import android.app.AppOpsManager
import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.os.UserManager
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

internal data class AppInfo(val label: String, val category: String)
internal class AppLabels(private val context: Context) {
  private val cache = mutableMapOf<String, AppInfo>()
  @Suppress("DEPRECATION")
  fun get(pkg: String): AppInfo = cache.getOrPut(pkg) {
    val pm = context.packageManager
    try {
      val info = pm.getApplicationInfo(pkg, 0)
      val category = listOf("Game", "Audio", "Video", "Image", "Social", "News", "Maps", "Productivity", "Accessibility")
        .getOrNull(info.category) ?: "Uncategorized"
      AppInfo(info.loadLabel(pm).toString().ifBlank { pkg }, category)
    } catch (_: PackageManager.NameNotFoundException) { AppInfo(pkg, "Uncategorized") }
      catch (_: SecurityException) { AppInfo(pkg, "Uncategorized") }
  }
}

internal object UsageRepository {
  private const val DAY = 86_400_000L
  private const val LOOKBACK = 7 * DAY
  private var instance: UsageDatabase? = null
  private fun db(context: Context) = instance ?: UsageDatabase(context.applicationContext).also { instance = it }
  private fun supported(context: Context) = Build.VERSION.SDK_INT >= 28 &&
    !context.getSystemService(UserManager::class.java).isManagedProfile
  private fun locked(context: Context) = !context.getSystemService(UserManager::class.java).isUserUnlocked ||
    context.getSystemService(KeyguardManager::class.java).isDeviceLocked

  @Suppress("DEPRECATION")
  private fun granted(context: Context): Boolean = try {
    context.getSystemService(AppOpsManager::class.java).checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
    ) == AppOpsManager.MODE_ALLOWED
  } catch (_: SecurityException) { false }

  @Synchronized fun status(context: Context): Map<String, Any?> {
    val supported = supported(context)
    val unlockedStorage = context.getSystemService(UserManager::class.java).isUserUnlocked
    val storage = if (supported && unlockedStorage) db(context) else null
    val allowed = supported && granted(context)
    if (!allowed && storage?.value("enabled") == "true" && storage.timestamp("lastRefresh") > 0 && storage.value("interrupted") != "true") {
      storage.transaction {
        storage.resetCursor(System.currentTimeMillis())
        storage.set("interrupted", true)
      }
    }
    return mapOf("supported" to supported, "granted" to allowed, "enabled" to (storage?.value("enabled") == "true"),
      "notificationsGranted" to context.getSystemService(NotificationManager::class.java).areNotificationsEnabled(),
      "locked" to locked(context), "lastRefresh" to storage?.timestamp("lastRefresh")?.takeIf { it > 0 })
  }

  @Synchronized fun setEnabled(context: Context, enabled: Boolean, schedule: (Context, Boolean) -> Unit) {
    if (!supported(context)) return
    val storage = db(context)
    if ((storage.value("enabled") == "true") != enabled) {
      storage.transaction {
        if (!enabled || storage.value("enabled") != null) storage.resetCursor(System.currentTimeMillis())
        storage.set("enabled", enabled)
      }
    }
    schedule(context, enabled)
  }

  @Synchronized fun clear(context: Context) {
    if (supported(context)) db(context).clear(System.currentTimeMillis())
    UsageAdvisories.dismiss(context)
  }

  @Synchronized fun policy(context: Context, json: String) {
    if (!supported(context)) return
    JSONObject(json)
    db(context).set("policy", json)
  }

  // The cursor is exclusive at the end of each successful query. Rows and the
  // continuation state advance in one transaction, so retries cannot add time twice.
  private fun accumulate(
    context: Context, start: Long, end: Long, initial: ForegroundState?,
    zone: ZoneId
  ): UsageAccumulator? {
    if (start >= end) return null
    val manager = context.getSystemService(UsageStatsManager::class.java)
    val stream = try { manager.queryEvents(start, end) } catch (_: SecurityException) { null } ?: return null
    var acc = initial?.let { UsageAccumulator(start, it, zone) }
    val event = UsageEvents.Event()
    while (stream.hasNextEvent()) {
      stream.getNextEvent(event)
      val time = event.timeStamp
      if (time < start || time >= end) continue
      val type = event.eventType
      if (type !in 1..2 && type !in 15..18 && type !in 23..24 && type !in 26..27) continue
      val current = acc ?: UsageAccumulator(time, ForegroundState(), zone).also { acc = it }
      current.event(time, type, event.packageName.orEmpty(), event.className.orEmpty())
    }
    // A fresh/expired query with no evidence stays unavailable. An established
    // cursor can measure a genuinely idle interval even when no event was emitted.
    acc?.advance(end)
    return acc
  }

  @Synchronized fun refresh(context: Context) {
    val status = status(context)
    if (status["supported"] != true || status["granted"] != true || status["enabled"] != true || status["locked"] == true) return
    val now = System.currentTimeMillis()
    val zone = ZoneId.systemDefault()
    val storage = db(context)
    if (storage.value("interrupted") == "true") storage.transaction {
      storage.resetCursor(now)
      storage.set("interrupted", false)
    }
    val cursor = storage.timestamp("cursor")
    if (now <= cursor) return
    val resume = cursor > 0 && now - cursor <= DAY && storage.value("zone") == zone.id
    val start = maxOf(cursor, storage.timestamp("floor"), now - LOOKBACK)
    val acc = accumulate(context, start, now, if (resume) storage.state() else null, zone) ?: return
    storage.commit(acc, now, zone)
    val policy = storage.value("policy") ?: return
    UsageAdvisories.evaluate(context, storage, JSONObject(policy), now, zone, acc.state.visible())
  }

  private fun matchedDuration(
    context: Context, storage: UsageDatabase, zone: ZoneId, comparison: LocalDate, today: LocalDate, now: Long,
    coverage: UsageDatabase.Coverage?
  ): Long? {
    val start = midnight(comparison, zone)
    val end = midnight(comparison.plusDays(1), zone)
    if (coverage == null || coverage.covered != end - start || coverage.end != end) return null
    val floor = storage.timestamp("floor")
    val cutoff = minOf(end, start + (now - midnight(today, zone)))
    if (cutoff <= start || floor > start) return null
    val acc = accumulate(context, maxOf(floor, start - 2 * DAY), cutoff, null, zone) ?: return null
    val totals = acc.days[comparison] ?: return null
    if (totals.covered != cutoff - start) return null
    return totals.deviceMs
  }

  @Synchronized fun read(context: Context, count: Int): List<Map<String, Any?>> {
    if (!supported(context) || !context.getSystemService(UserManager::class.java).isUserUnlocked) return emptyList()
    refresh(context)
    val storage = db(context)
    val zone = ZoneId.systemDefault()
    val now = System.currentTimeMillis()
    val today = localDay(now, zone)
    storage.prune(today)
    val active = storage.value("enabled") == "true" && granted(context) && !locked(context)
    val matchDates = if (active)
      setOf(today.minusDays(1), today.minusWeeks(1), today.minusMonths(1)) else emptySet()
    val sampledAt = storage.timestamp("lastRefresh").coerceAtMost(now)
    val labels = AppLabels(context)
    val offset = count.coerceIn(1, 90) - 1
    val startDate = today.minusDays(offset.toLong()).toString()
    val coverageRows = storage.coverage(startDate, today.toString())
    val appRows = storage.apps(startDate, today.toString())
    return (offset downTo 0).map { ago ->
      val day = today.minusDays(ago.toLong())
      val date = day.toString()
      val row = coverageRows[date]
      val covered = row?.covered ?: 0
      val end = row?.end ?: 0
      val start = midnight(day, zone)
      val expectedEnd = if (day == today) end else midnight(day.plusDays(1), zone)
      val coverage = when {
        covered <= 0 -> "unavailable"
        day == today && (!active || now - end > 60_000L) -> "partial"
        end == expectedEnd && covered == expectedEnd - start -> "complete"
        else -> "partial"
      }
      val apps = appRows[date].orEmpty()
      mapOf("date" to date, "totalMs" to (row?.deviceMs ?: 0L),
        "unlocks" to (row?.unlocks ?: 0), "coverage" to coverage, "coverageEnd" to end.takeIf { it > 0 },
        "matchedTotalMs" to if (day in matchDates) matchedDuration(context, storage, zone, day, today, sampledAt, row) else null,
        "apps" to apps.map { (pkg, totals) ->
          val info = labels.get(pkg)
          mapOf("packageName" to pkg, "label" to info.label, "category" to info.category,
            "durationMs" to totals.duration, "launches" to totals.launches)
        })
    }
  }
}
