package app.minimal.wellbeing

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.ZoneId

internal class UsageDatabase(context: Context) : SQLiteOpenHelper(
  context, File(context.noBackupFilesDir, "wellbeing-usage.db").absolutePath, null, 2
) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
    db.execSQL("CREATE TABLE days (date TEXT PRIMARY KEY, covered INTEGER NOT NULL, end INTEGER NOT NULL, unlocks INTEGER NOT NULL, deviceMs INTEGER NOT NULL DEFAULT 0)")
    db.execSQL("CREATE TABLE apps (date TEXT NOT NULL, pkg TEXT NOT NULL, duration INTEGER NOT NULL, launches INTEGER NOT NULL, PRIMARY KEY(date,pkg))")
    db.execSQL("CREATE TABLE notices (date TEXT NOT NULL, token TEXT NOT NULL, PRIMARY KEY(date,token))")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) {
      db.execSQL("ALTER TABLE days ADD COLUMN deviceMs INTEGER NOT NULL DEFAULT 0")
      // Earlier versions credited one package per instant, so this historical sum is the union.
      db.execSQL("UPDATE days SET deviceMs=coalesce((SELECT sum(duration) FROM apps WHERE apps.date=days.date),0)")
    }
  }

  fun value(key: String): String? =
    readableDatabase.rawQuery("SELECT value FROM settings WHERE name=?", arrayOf(key)).use {
      if (it.moveToFirst()) it.getString(0) else null
    }

  fun timestamp(key: String) = value(key)?.toLongOrNull() ?: 0L

  fun set(key: String, value: Any) {
    writableDatabase.execSQL("INSERT OR REPLACE INTO settings VALUES (?,?)", arrayOf(key, value.toString()))
  }

  fun transaction(body: () -> Unit) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      body()
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
  }

  fun clear(now: Long) = transaction {
    for (table in listOf("days", "apps", "notices")) writableDatabase.delete(table, null, null)
    resetCursor(now)
    set("lastRefresh", 0)
  }

  fun resetCursor(now: Long) {
    set("floor", now)
    set("cursor", 0)
    writableDatabase.delete("settings", "name=?", arrayOf("foreground"))
  }

  fun state(): ForegroundState {
    val saved = value("foreground")?.let { JSONObject(it) } ?: return ForegroundState()
    val activities = linkedMapOf<String, String>()
    val list = saved.getJSONArray("activities")
    for (index in 0 until list.length()) {
      val entry = list.getJSONArray(index)
      activities[entry.getString(0)] = entry.getString(1)
    }
    return ForegroundState(activities, saved.optBoolean("interactive", true), saved.optBoolean("unlocked", true),
      saved.optString("lastPackage"), saved.optLong("lastPause"))
  }

  fun commit(acc: UsageAccumulator, now: Long, zone: ZoneId) = transaction {
    val db = writableDatabase
    for ((date, totals) in acc.days) {
      val day = date.toString()
      db.execSQL("INSERT OR IGNORE INTO days VALUES (?,0,0,0,0)", arrayOf(day))
      db.execSQL("UPDATE days SET covered=covered+?, end=max(end,?), unlocks=unlocks+?, deviceMs=deviceMs+? WHERE date=?",
        arrayOf(totals.covered, totals.end, totals.unlocks, totals.deviceMs, day))
      for ((pkg, app) in totals.apps) {
        db.execSQL("INSERT OR IGNORE INTO apps VALUES (?,?,0,0)", arrayOf(day, pkg))
        db.execSQL("UPDATE apps SET duration=duration+?, launches=launches+? WHERE date=? AND pkg=?",
          arrayOf(app.duration, app.launches, day, pkg))
      }
    }
    val state = acc.state
    val activities = JSONArray()
    state.activities.forEach { (key, pkg) -> activities.put(JSONArray().put(key).put(pkg)) }
    set("foreground", JSONObject().put("activities", activities).put("interactive", state.interactive)
      .put("unlocked", state.unlocked).put("lastPackage", state.lastPackage).put("lastPause", state.lastPause))
    set("cursor", now)
    set("lastRefresh", now)
    set("zone", zone.id)
    prune(localDay(now, zone))
  }

  fun prune(today: LocalDate) {
    for (table in listOf("days", "apps", "notices")) {
      writableDatabase.delete(table, "date < ?", arrayOf(today.minusDays(89).toString()))
    }
  }

  data class Coverage(val covered: Long, val end: Long, val unlocks: Int, val deviceMs: Long)

  fun coverage(start: String, end: String): Map<String, Coverage> {
    val rows = mutableMapOf<String, Coverage>()
    readableDatabase.rawQuery("SELECT date,covered,end,unlocks,deviceMs FROM days WHERE date BETWEEN ? AND ?", arrayOf(start,end)).use {
      while (it.moveToNext()) rows[it.getString(0)] = Coverage(it.getLong(1), it.getLong(2), it.getInt(3), it.getLong(4))
    }
    return rows
  }

  fun apps(start: String, end: String): Map<String, Map<String, AppTotals>> {
    val result = mutableMapOf<String, MutableMap<String, AppTotals>>()
    readableDatabase.rawQuery("SELECT date,pkg,duration,launches FROM apps WHERE date BETWEEN ? AND ? ORDER BY date,duration DESC,pkg", arrayOf(start,end)).use {
      while (it.moveToNext()) result.getOrPut(it.getString(0)) { linkedMapOf() }[it.getString(1)] =
        AppTotals(it.getLong(2), it.getInt(3))
    }
    return result
  }

  fun alreadySent(date: String, token: String): Boolean =
    readableDatabase.rawQuery("SELECT 1 FROM notices WHERE date=? AND token=?", arrayOf(date,token)).use { it.moveToFirst() }

  fun markSent(date: String, token: String) {
    writableDatabase.execSQL("INSERT OR IGNORE INTO notices VALUES (?,?)", arrayOf(date, token))
  }
}
