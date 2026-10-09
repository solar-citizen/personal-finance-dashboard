'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { LoginSchema } from '#pfd-schemas';
import { useLogin } from '#src/_generated/api/pfd-components';

import Button from '../common/Button';
import Form from '../form/Form';
import FormInput from '../form/FormInput';
import { type LoginFormData } from './auth.types';
import AuthCard from './AuthCard';

export default function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation();

  const { mutate, isPending } = useLogin({
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

  const handleSubmit = ({ email, password }: LoginFormData) => {
    mutate({
      body: {
        email,
        password,
      },
    });
  };

  return (
    <AuthCard
      title={t('auth.welcomeBack')}
      description={t('auth.loginSubtitle')}
      footerText={t('auth.noAccount')}
      footerLink={'/register'}
      footerLinkText={t('auth.createOne')}
    >
      <Form
        defaultValues={{
          email: '',
          password: '',
        }}
        validationSchema={LoginSchema}
        onSubmit={handleSubmit}
        className={'space-y-4'}
      >
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
          disabled={isPending}
        />

        <Button type={'submit'} disabled={isPending} fullWidth={true} className={'mt-4'}>
          {t('auth.signIn')}
        </Button>
      </Form>
    </AuthCard>
  );
}
