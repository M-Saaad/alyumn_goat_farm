import { formatDate } from "@/lib/format";
import {
  ultrasoundConfirmedText,
  ultrasoundStatusText,
  type UltrasoundStatus,
} from "@/lib/livestock/breeding";

const colorClass: Record<UltrasoundStatus, string> = {
  not_due: "text-stone-500",
  in_window: "text-emerald-700",
  overdue: "text-red-700",
  confirmed: "text-emerald-700",
};

export function UltrasoundStatusLine({
  ultrasoundStatus,
  ultrasoundDate,
  fetusCount,
  daysSinceCrossed,
  showWhenIdle = false,
}: {
  ultrasoundStatus: UltrasoundStatus;
  ultrasoundDate: string | null;
  fetusCount?: number | null;
  daysSinceCrossed: number | null;
  /** Show early/window/overdue lines; confirmed always shown when set. */
  showWhenIdle?: boolean;
}) {
  if (ultrasoundStatus === "confirmed" && ultrasoundDate) {
    return (
      <p className={`text-sm font-medium ${colorClass.confirmed}`}>
        {ultrasoundConfirmedText(ultrasoundDate, fetusCount ?? null)}
      </p>
    );
  }

  if (!showWhenIdle && ultrasoundStatus === "not_due") return null;

  const text = ultrasoundStatusText(
    ultrasoundStatus,
    ultrasoundDate,
    daysSinceCrossed,
    fetusCount ?? null
  );
  return <p className={`text-sm font-medium ${colorClass[ultrasoundStatus]}`}>{text}</p>;
}
