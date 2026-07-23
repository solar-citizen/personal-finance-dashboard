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
  const {
    field: { ref, onBlur, onChange, value: fieldValue },
    fieldState,
  } = useController<T>({
    name,
    control,
    rules: deps ? { deps } : undefined,
  });

  const handleChange = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
    onChange(value === '' ? null : value);
  };

  return (
    <Input
      {...props}
      ref={ref}
      name={name}
      onBlur={onBlur}
      onChange={handleChange}
      value={fieldValue ?? ''}
      tooltip={tooltip}
      error={fieldState.error?.message}
    />
  );
}
