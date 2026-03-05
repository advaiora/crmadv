import React from 'react';
import { Inbox } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { cn } from '../../../lib/cn';

const WidgetCard = ({
  title,
  subtitle,
  icon: Icon,
  action,
  footer,
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  children,
}) => {
  const showHeader = Boolean(title || subtitle || action || Icon);

  return (
    <Card
      className={cn(
        'h-full rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover',
        className,
      )}
    >
      {showHeader ? (
        <CardHeader className={cn('flex flex-row items-start justify-between gap-4 p-4 pb-0 md:p-6 md:pb-0', headerClassName)}>
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bgSecondary text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-1">
              {title ? (
                <CardTitle className="text-base font-semibold leading-tight tracking-tight md:text-lg">{title}</CardTitle>
              ) : null}
              {subtitle ? (
                <CardDescription className="text-sm text-textMuted">{subtitle}</CardDescription>
              ) : null}
            </div>
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}

      <CardContent className={cn('p-4 md:p-6', showHeader ? 'pt-4' : '', contentClassName)}>
        {children}
      </CardContent>

      {footer ? (
        <CardFooter className={cn('justify-end p-4 pt-0 md:p-6 md:pt-0', footerClassName)}>
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
};

export const WidgetEmptyState = ({
  icon: Icon = Inbox,
  message,
  action,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cardBorder bg-bgSecondary px-4 py-8 text-center',
      className,
    )}
  >
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bgSecondary text-primary">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
    <p className="mb-0 text-sm text-textMuted">{message}</p>
    {action ? <div>{action}</div> : null}
  </div>
);

export default WidgetCard;

