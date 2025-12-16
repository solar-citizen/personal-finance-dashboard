'use client';

import { useRouter } from 'next/navigation';

import { useLogin } from '#src/_generated/api/pfd-components';

import Form from '../form/Form';
import FormInput from '../form/FormInput';
import { type LoginFormData, loginSchema } from './auth.schema';
import AuthCard from './AuthCard';

export default function LoginForm() {
  const router = useRouter();

  const { mutate, isPending } = useLogin({
    onMutate: () => {
      // FIXME: Replace with toast.info or alternative
      console.log('Logging in...');
    },
    onError: () => {
      // FIXME: Replace with toast.error or alternative
      console.log('Failed to log in');
    },
    onSuccess: () => {
      // FIXME: Replace with toast.success or alternative
      console.log('Logged in successfully');

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
      {isPending ? (
        // FIXME: Replace with actual loading spinner component
        'Loading spinner here'
      ) : (
        <Form
          defaultValues={{
            email: '',
            password: '',
          }}
          validationSchema={loginSchema}
          onSubmit={handleSubmit}
          className={'space-y-4'}
        >
          <FormInput
            name={'email'}
            type={'email'}
            label={'Email'}
            placeholder={'admin@finance.ua'}
            className={'space-y-2'}
          />

          <div className={'space-y-2'}>
            <div className={'flex items-center justify-between'}>
              <FormInput name={'password'} type={'password'} label={'Password'} />
            </div>
          </div>

          <button
            type={'submit'}
            className={
              'cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full mt-4'
            }
          >
            {'Sign In'}
          </button>
        </Form>
      )}
    </AuthCard>
  );
}
