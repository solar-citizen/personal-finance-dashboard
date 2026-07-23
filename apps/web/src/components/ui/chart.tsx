import { createContext, forwardRef, isValidElement, useContext, useId, useMemo } from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '#src/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = {
  config: ChartConfig;
};

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES: Record<'light' | 'dark', string> = { light: '', dark: '.dark' };
const ChartContext = createContext<ChartContextProps | null>(null);

function hasKey<K extends string>(obj: object, key: K): obj is Record<K, unknown> {
  return key in obj;
}

function useChart() {
  const context = useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

const ChartContainer = forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot={'chart'}
        data-chart={chartId}
        ref={ref}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line-line]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'Chart';

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, { theme, color }]) => theme ?? color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => {
            const themeKey = theme === 'light' || theme === 'dark' ? theme : undefined;

            if (!themeKey) {
              return '';
            }

            return `
              ${prefix} [data-chart=${id}] {
              ${colorConfig
                .map(([key, itemConfig]) => {
                  const color = itemConfig.theme?.[themeKey] ?? itemConfig.color;
                  return color ? `  --color-${key}: ${color};` : null;
                })
                .filter(Boolean)
                .join('\n')}
              }
            `;
          })
          .join('\n'),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: 'line' | 'dot' | 'dashed';
    nameKey?: string;
    labelKey?: string;
    active?: boolean;
    payload?: {
      dataKey?: string | number;
      name?: string;
      value?: unknown;
      payload?: { fill?: string; [key: string]: unknown };
      color?: string;
      [key: string]: unknown;
    }[];
    className?: string;
    label?: React.ReactNode;
    labelFormatter?: (value: unknown, payload: unknown) => React.ReactNode;
    formatter?: (
      value: unknown,
      name: unknown,
      item: unknown,
      index: number,
      payload: unknown,
    ) => React.ReactNode;
    color?: string;
  }
>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelKey,
      formatter,
      color,
      nameKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey ?? item.dataKey ?? item.name ?? 'value'}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === 'string'
          ? ((label in config ? config[label].label : undefined) ?? label)
          : itemConfig?.label;

      if (labelFormatter) {
        return <div className={cn('font-medium', className)}>{labelFormatter(value, payload)}</div>;
      }

      if (!value) {
        return null;
      }

      return <div className={cn('font-medium', className)}>{value}</div>;
    }, [hideLabel, payload, labelKey, config, label, labelFormatter, className]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== 'dot';

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className={'grid gap-1.5'}>
          {payload.map(
            (
              item: {
                dataKey?: string | number;
                name?: string;
                value?: unknown;
                payload?: { fill?: string; [key: string]: unknown };
                color?: string;
              },
              index: number,
            ) => {
              const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = color ?? item.payload?.fill ?? item.color;

              return (
                <div
                  key={item.dataKey ?? index}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground',
                    indicator === 'dot' && 'items-center',
                  )}
                >
                  {formatter && item.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn('shrink-0 rounded-[2px] border-current bg-current', {
                              'h-2.5 w-2.5': indicator === 'dot',
                              'h-1 w-4': indicator === 'line',
                              'h-0 w-2 border-b-2 border-dashed bg-transparent':
                                indicator === 'dashed',
                              'my-0.5': nestLabel && indicator === 'dashed',
                            })}
                            style={{ color: indicatorColor }}
                          />
                        )
                      )}
                      <div
                        className={cn(
                          'flex flex-1 justify-between leading-none',
                          nestLabel ? 'items-end' : 'items-center',
                        )}
                      >
                        <div className={'grid gap-1.5'}>
                          {nestLabel ? tooltipLabel : null}
                          <span className={'text-muted-foreground'}>
                            {itemConfig?.label ?? item.name}
                          </span>
                        </div>
                        {item.value !== undefined && (
                          <span className={'font-mono font-medium tabular-nums text-foreground'}>
                            {typeof item.value === 'number'
                              ? item.value.toLocaleString()
                              : renderTooltipValue(item.value)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = 'ChartTooltip';

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Legend> & {
    hideIcon?: boolean;
    nameKey?: string;
    className?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    payload?: {
      value?: string | number | React.ReactNode;
      dataKey?: string | number;
      color?: string;
      [key: string]: unknown;
    }[];
  }
>(({ className, hideIcon = false, payload, position = 'bottom', nameKey }, ref) => {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-center gap-4',
        position === 'top'
          ? 'pb-3'
          : position === 'bottom'
            ? 'pt-3'
            : position === 'left'
              ? 'pr-3'
              : 'pl-3',
        className,
      )}
    >
      {payload.map(
        (
          item: {
            value?: React.ReactNode;
            dataKey?: string | number;
            color?: string;
            [key: string]: unknown;
          },
          index,
        ) => {
          const key = `${nameKey ?? item.dataKey ?? 'value'}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.dataKey ?? index}
              className={cn(
                'flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground',
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className={'h-2 w-2 shrink-0 rounded-[2px]'}
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              <span className={'text-xs text-muted-foreground'}>
                {itemConfig?.label ?? item.value}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
});
ChartLegendContent.displayName = 'ChartLegend';

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const payloadPayload =
    'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in config) {
    configLabelKey = key;
  } else if (payloadPayload && hasKey(payloadPayload, key)) {
    configLabelKey = String(payloadPayload[key]);
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

function renderTooltipValue(value: unknown): React.ReactNode {
  if (isValidElement(value) || typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (value == null) {
    return null;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};
