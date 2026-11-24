const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Display a local calendar day without converting it through UTC. */
export function formatDate(value: string | Date) {
  if (typeof value === "string") {
    const [year, month, day] = value.split("-");
    return [day, months[Number(month) - 1], year].join("-");
  }
  return [
    String(value.getDate()).padStart(2, "0"),
    months[value.getMonth()],
    String(value.getFullYear()).padStart(4, "0"),
  ].join("-");
}
