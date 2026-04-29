import { useTheme } from '@material-ui/core/styles';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: any;
  labelFormatter?: (label: any) => string;
  formatter?: (value: number) => string;
}

export const ChartTooltip = ({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: ChartTooltipProps) => {
  const theme = useTheme();

  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: theme.spacing(1, 1.5),
      }}
    >
      <p
        style={{
          margin: `0 0 ${theme.spacing(0.5)}px`,
          color: theme.palette.text.secondary,
          fontSize: 12,
        }}
      >
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: TooltipEntry) => (
        <p
          key={entry.dataKey}
          style={{ margin: `${theme.spacing(0.5)}px 0`, color: entry.color }}
        >
          {entry.name} :{' '}
          {formatter && entry.value !== undefined
            ? formatter(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
};
