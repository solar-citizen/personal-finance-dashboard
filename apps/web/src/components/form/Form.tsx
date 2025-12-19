'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type DefaultValues, FormProvider, type Mode, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { cn } from '#src/lib/utils';

import type { FieldValues } from './FormInput';

type ChildrenFn<T extends FieldValues> = (values: T) => React.ReactNode;

type Props<T extends FieldValues> = {
  defaultValues: DefaultValues<T>;
  validationSchema: z.ZodType<T, T>;
  mode?: Mode;
  className?: string | string[];
  onSubmit: (form: T) => void;
  children: React.ReactNode | ChildrenFn<T>;
};

export default function Form<T extends FieldValues>({
  defaultValues,
  validationSchema,
  mode = 'onSubmit',
  className,
  onSubmit,
  children,
}: Props<T>) {
  const form = useForm<T>({
    mode,
    defaultValues,
    resolver: zodResolver(validationSchema),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(e);
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    <FormProvider {...form}>
      <form
        className={cn(className, {
          'pointer-events-none': form.formState.isLoading,
        })}
        onSubmit={handleSubmit}
        onReset={handleReset}
      >
        {typeof children === 'function' ? children(form.watch()) : children}
      </form>
    </FormProvider>
  );
}
