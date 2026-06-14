'use client';

import { useRouter } from 'next/navigation';

import { RegisterSchema } from '#pfd-schemas';
import { useRegister } from '#src/_generated/api/pfd-components';

import Form from '../form/Form';
import FormInput from '../form/FormInput';
import { type RegisterFormData } from './auth.types';
import AuthCard from './AuthCard';

export default function RegisterForm() {
  const router = useRouter();

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
      title={'Create Account'}
      description={'Enter your details to create an account.'}
      footerText={'Already have an account?'}
      footerLink={'/login'}
      footerLinkText={'Sign in'}
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
          label={'Full Name'}
          placeholder={'John Doe'}
          disabled={isPending}
        />

        <FormInput
          name={'email'}
          type={'email'}
          label={'Email'}
          placeholder={'admin@finance.ua'}
          disabled={isPending}
        />

        <FormInput
          name={'password'}
          type={'password'}
          label={'Password'}
          placeholder={'At least 8 characters'}
          disabled={isPending}
          deps={['repeatPassword']}
        />

        <FormInput
          name={'repeatPassword'}
          type={'password'}
          label={'Confirm Password'}
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
          {'Create Account'}
        </button>
      </Form>
    </AuthCard>
  );
}
