package app.minimal.wellbeing

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class WellbeingUsageModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext).applicationContext
  override fun definition() = ModuleDefinition {
    Name("WellbeingUsage")
    AsyncFunction("status") { UsageRepository.status(context) }
    AsyncFunction("openSettings") {
      val intents = listOf(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + context.packageName)),
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      )
      intents.any { intent ->
        try {
          context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          true
        } catch (_: ActivityNotFoundException) { false } catch (_: SecurityException) { false }
      }
    }
    AsyncFunction("setEnabled") { enabled: Boolean -> UsageRepository.setEnabled(context, enabled, UsageWorker::schedule) }
    AsyncFunction("readDays") { days: Int -> UsageRepository.read(context, days) }
    AsyncFunction("clearHistory") { UsageRepository.clear(context) }
    AsyncFunction("syncPolicy") { json: String -> UsageRepository.policy(context, json) }
  }
}

class UsageWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
  override fun doWork(): Result = try {
    UsageRepository.refresh(applicationContext)
    Result.success()
  } catch (_: android.database.sqlite.SQLiteException) { Result.retry() }

  companion object {
    private const val NAME = "wellbeing-usage-refresh"
    fun schedule(context: Context, enabled: Boolean) {
      val manager = WorkManager.getInstance(context)
      if (enabled) {
        val request = PeriodicWorkRequest.Builder(UsageWorker::class.java, 15, TimeUnit.MINUTES).build()
        manager.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
      } else manager.cancelUniqueWork(NAME)
    }
  }
}
