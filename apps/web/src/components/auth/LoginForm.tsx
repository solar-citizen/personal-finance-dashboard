'use client';

import { useRouter } from 'next/navigation';

import { LoginSchema } from '#pfd-schemas';
import { useLogin } from '#src/_generated/api/pfd-components';

import Form from '../form/Form';
import FormInput from '../form/FormInput';
import { type LoginFormData } from './auth.types';
import AuthCard from './AuthCard';

export default function LoginForm() {
  const router = useRouter();

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
      title={'Welcome Back'}
      description={'Enter your credentials to access your finance dashboard.'}
      footerText={"Don't have an account?"}
      footerLink={'/register'}
      footerLinkText={'Create one'}
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
          label={'Email'}
          placeholder={'admin@finance.ua'}
          disabled={isPending}
          className={'space-y-2'}
        />

        <FormInput
          name={'password'}
          type={'password'}
          label={'Password'}
          disabled={isPending}
          className={'space-y-2'}
        />

        {/* FIXME: Consider using shadcn/custom component */}
        <button
          type={'submit'}
          disabled={isPending}
          className={
            'cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full mt-4'
          }
        >
          {'Sign In'}
        </button>
      </Form>
    </AuthCard>
  );
}
