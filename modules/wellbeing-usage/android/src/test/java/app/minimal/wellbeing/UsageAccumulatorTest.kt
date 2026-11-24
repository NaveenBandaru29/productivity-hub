package app.minimal.wellbeing

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class UsageAccumulatorTest {
  private val utc = ZoneId.of("UTC")
  private val date = LocalDate.of(2026, 1, 1)
  private val start = midnight(date, utc)

  @Test fun deviceTotalUnionsWindowsWhileEachResumedPackageAccruesTime() {
    val acc = UsageAccumulator(start, ForegroundState(), utc)
    acc.event(start, 1, "a", "one")
    acc.event(start + 1000, 1, "b", "two")
    acc.event(start + 2000, 2, "a", "one")
    acc.event(start + 3000, 2, "b", "two")
    acc.advance(start + 4000)
    val day = acc.days.getValue(date)
    assertEquals(2000L, day.apps.getValue("a").duration)
    assertEquals(2000L, day.apps.getValue("b").duration)
    assertEquals(4000L, day.covered)
    assertEquals(3000L, day.deviceMs)
  }

  @Test fun lockedAndNonInteractiveTimeIsExcluded() {
    val acc = UsageAccumulator(start, ForegroundState(), utc)
    acc.event(start, 1, "a", "one")
    acc.event(start + 1000, 16, "", "")
    acc.event(start + 1500, 17, "", "")
    acc.event(start + 3000, 15, "", "")
    acc.event(start + 4000, 18, "", "")
    acc.advance(start + 5000)
    val day = acc.days.getValue(date)
    assertEquals(2000L, day.apps.getValue("a").duration)
    assertEquals(1, day.unlocks)
  }

  @Test fun midnightSplitsElapsedTimeAcrossRealLocalDays() {
    val zone = ZoneId.of("America/New_York")
    val spring = LocalDate.of(2026, 3, 8)
    val begin = midnight(spring, zone)
    val acc = UsageAccumulator(begin - 1000, ForegroundState(), zone)
    acc.event(begin - 1000, 1, "a", "one")
    acc.advance(midnight(spring.plusDays(1), zone) + 1000)
    assertEquals(1000L, acc.days.getValue(spring.minusDays(1)).apps.getValue("a").duration)
    assertEquals(23 * 3_600_000L, acc.days.getValue(spring).apps.getValue("a").duration)
    assertEquals(1000L, acc.days.getValue(spring.plusDays(1)).apps.getValue("a").duration)
  }

  @Test fun rebootClearsStaleForegroundAndCheckpointContinues() {
    val first = UsageAccumulator(start, ForegroundState(), utc)
    first.event(start, 1, "a", "one")
    first.advance(start + 1000)
    val second = UsageAccumulator(start + 1000, first.state, utc)
    second.event(start + 2000, 26, "", "")
    second.advance(start + 5000)
    assertEquals(1000L, first.days.getValue(date).apps.getValue("a").duration)
    assertEquals(1000L, second.days.getValue(date).apps.getValue("a").duration)
    assertEquals(0, second.days.getValue(date).apps.getValue("a").launches)
  }
}
