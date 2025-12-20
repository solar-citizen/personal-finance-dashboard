export default function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div
      className={
        'min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden'
      }
    >
      <div
        className={
          'absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]'
        }
      />
      <div
        className={
          'absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[100px]'
        }
      />

      <div
        className={
          'bg-card text-card-foreground border border-border/60 shadow-xl shadow-primary/5 rounded-2xl overflow-hidden relative z-10 w-full max-w-md mx-4'
        }
      >
        {children}
      </div>
    </div>
  );
}
