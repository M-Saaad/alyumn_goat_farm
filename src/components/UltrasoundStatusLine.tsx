import { formatDate } from "@/lib/format";
import { ultrasoundStatusText, type UltrasoundStatus } from "@/lib/livestock/breeding";

const colorClass: Record<UltrasoundStatus, string> = {
  not_due: "text-stone-500",
  in_window: "text-emerald-700",
  overdue: "text-red-700",
  confirmed: "text-emerald-700",
};

export function UltrasoundStatusLine({
  ultrasoundStatus,
  ultrasoundDate,
  daysSinceCrossed,
  showWhenIdle = false,
}: {
  ultrasoundStatus: UltrasoundStatus;
  ultrasoundDate: string | null;
  daysSinceCrossed: number | null;
  /** Show early/window/overdue lines; confirmed always shown when set. */
  showWhenIdle?: boolean;
}) {
  if (ultrasoundStatus === "confirmed" && ultrasoundDate) {
    return (
      <p className={`text-sm font-medium ${colorClass.confirmed}`}>
        Ultrasound {formatDate(ultrasoundDate)}
      </p>
    );
  }

  if (!showWhenIdle && ultrasoundStatus === "not_due") return null;

  const text = ultrasoundStatusText(ultrasoundStatus, ultrasoundDate, daysSinceCrossed);
  return <p className={`text-sm font-medium ${colorClass[ultrasoundStatus]}`}>{text}</p>;
}
