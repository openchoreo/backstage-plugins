const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** A time as "3 hours ago", with the full date and time on hover. */
export function RelativeTime({ iso }: { iso?: string }) {
  if (!iso) {
    return <>—</>;
  }
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const [unit, size] =
    RELATIVE_UNITS.find(([, s]) => Math.abs(seconds) >= s) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return (
    <span title={new Date(iso).toLocaleString()}>
      {format.format(Math.round(seconds / size), unit)}
    </span>
  );
}
