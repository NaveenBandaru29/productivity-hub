package app.minimal.wellbeing

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

internal fun localDay(time: Long, zone: ZoneId): LocalDate =
  Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

internal fun midnight(date: LocalDate, zone: ZoneId): Long =
  date.atStartOfDay(zone).toInstant().toEpochMilli()

// Android may keep activities in several packages resumed in multi-window.
internal data class ForegroundState(
  val activities: LinkedHashMap<String, String> = linkedMapOf(),
  var interactive: Boolean = true,
  var unlocked: Boolean = true,
  var lastPackage: String = "",
  var lastPause: Long = 0L,
) {
  fun visible(): String? = if (interactive && unlocked) activities.values.lastOrNull() else null
}

internal data class AppTotals(var duration: Long = 0L, var launches: Int = 0)
internal data class DayTotals(
  val apps: MutableMap<String, AppTotals> = mutableMapOf(),
  var deviceMs: Long = 0L,
  var unlocks: Int = 0,
  var covered: Long = 0L,
  var end: Long = 0L,
)

internal class UsageAccumulator(start: Long, val state: ForegroundState, private val zone: ZoneId) {
  val days = sortedMapOf<LocalDate, DayTotals>()
  private var cursor = start

  fun advance(end: Long) {
    val visiblePackages = if (state.interactive && state.unlocked) state.activities.values.toSet() else emptySet()
    while (cursor < end) {
      val date = localDay(cursor, zone)
      val stop = minOf(end, midnight(date.plusDays(1), zone))
      val elapsed = stop - cursor
      val day = days.getOrPut(date) { DayTotals() }
      day.covered += elapsed
      day.end = stop
      if (visiblePackages.isNotEmpty()) day.deviceMs += elapsed
      for (pkg in visiblePackages) day.apps.getOrPut(pkg) { AppTotals() }.duration += elapsed
      cursor = stop
    }
  }

  // Event numbers are stable public UsageEvents.Event constants, including the
  // older MOVE_TO_FOREGROUND/BACKGROUND aliases for ACTIVITY_RESUMED/PAUSED.
  fun event(time: Long, type: Int, pkg: String, activity: String) {
    if (time < cursor) return
    advance(time)
    val key = pkg + "/" + activity
    when (type) {
      1 -> {
        if (pkg.isEmpty()) return
        val previous = state.visible()
        state.activities.remove(key)
        state.activities[key] = pkg
        if (state.visible() != null && previous != pkg &&
          (state.lastPackage != pkg || time - state.lastPause > 1000L)) {
          val day = days.getOrPut(localDay(time, zone)) { DayTotals() }
          day.apps.getOrPut(pkg) { AppTotals() }.launches++
        }
        state.lastPackage = pkg
      }
      2, 23, 24 -> {
        if (state.activities.remove(key) != null) state.lastPause = time
      }
      15 -> state.interactive = true
      16 -> state.interactive = false
      17 -> state.unlocked = false
      18 -> {
        val day = days.getOrPut(localDay(time, zone)) { DayTotals() }
        day.unlocks++
        state.unlocked = true
      }
      26, 27 -> {
        state.activities.clear()
        state.lastPackage = ""
        state.interactive = false
        state.unlocked = false
      }
    }
  }
}
