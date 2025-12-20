'use client';

import { type Path, useController, useFormContext } from 'react-hook-form';

import Input, { type Props as InputProps } from '../common/Input';

export type FieldValues = Record<string, string | number | null | undefined>;

type Props<T extends FieldValues = FieldValues> = InputProps & {
  name: Path<T>;
  deps?: Path<T>[];
};

export default function FormInput<T extends FieldValues = FieldValues>({
  name,
  tooltip,
  deps,
  ...props
}: Props<T>) {
  const { control } = useFormContext<T>();
  const { field, fieldState } = useController<T>({
    name,
    control,
    rules: deps ? { deps } : undefined,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? null : e.target.value;
    field.onChange(value);
  };

  return (
    <Input
      {...props}
      ref={field.ref}
      name={field.name}
      onBlur={field.onBlur}
      onChange={handleChange}
      value={field.value ?? ''}
      tooltip={tooltip}
      error={fieldState.error?.message}
    />
  );
}
