'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { RegisterSchema } from '#pfd-schemas';
import { useRegister } from '#src/_generated/api/pfd-components';

import Form from '../form/Form';
import FormInput from '../form/FormInput';
import { type RegisterFormData } from './auth.types';
import AuthCard from './AuthCard';

export default function RegisterForm() {
  const router = useRouter();
  const { t } = useTranslation();

  const { mutate, isPending } = useRegister({
    onMutate: () => {
      // TODO: Add toast.info or alternative
    },
    onError: () => {
      // TODO: Add toast.error or alternative
    },
    onSuccess: () => {
      // TODO: Add toast.success or alternative
      router.replace('/dashboard');
    },
  });

  const handleSubmit = ({ email, password, repeatPassword, name }: RegisterFormData) => {
    mutate({
      body: {
        email,
        password,
        repeatPassword,
        name,
      },
    });
  };

  return (
    <AuthCard
      title={t('auth.createAccount')}
      description={t('auth.registerSubtitle')}
      footerText={t('auth.hasAccount')}
      footerLink={'/login'}
      footerLinkText={t('auth.signIn')}
    >
      <Form
        defaultValues={{
          email: '',
          name: '',
          password: '',
          repeatPassword: '',
        }}
        validationSchema={RegisterSchema}
        onSubmit={handleSubmit}
        className={'[&>*:not(button)]:space-y-4'}
      >
        <FormInput
          name={'name'}
          type={'text'}
          label={t('auth.fullName')}
          placeholder={'John Doe'}
          disabled={isPending}
        />

        <FormInput
          name={'email'}
          type={'email'}
          label={t('auth.email')}
          placeholder={'admin@finance.ua'}
          disabled={isPending}
        />

        <FormInput
          name={'password'}
          type={'password'}
          label={t('auth.password')}
          placeholder={'At least 8 characters'}
          disabled={isPending}
          deps={['repeatPassword']}
        />

        <FormInput
          name={'repeatPassword'}
          type={'password'}
          label={t('auth.confirmPassword')}
          placeholder={'Re-enter your password'}
          disabled={isPending}
        />

        {/* FIXME: Consider using shadcn/custom component */}
        <button
          type={'submit'}
          disabled={isPending}
          className={
            'cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full mt-4'
          }
        >
          {t('auth.createAccount')}
        </button>
      </Form>
    </AuthCard>
  );
}
