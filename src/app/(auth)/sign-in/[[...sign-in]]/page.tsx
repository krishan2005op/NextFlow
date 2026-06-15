import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas-bg px-4 py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-purple-300/70">
            NextFlow
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Sign in to your workflow builder
          </h1>
        </div>
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          forceRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card:
                "w-full rounded-lg border border-canvas-border bg-canvas-node shadow-2xl shadow-purple-950/20",
              headerTitle: "text-white",
              headerSubtitle: "text-neutral-400",
              socialButtonsBlockButton:
                "border-canvas-border bg-[#111111] text-neutral-100 hover:bg-[#181818]",
              formFieldLabel: "text-neutral-300",
              formFieldInput:
                "border-canvas-border bg-[#111111] text-white focus:border-brand-purple focus:ring-brand-purple",
              footerActionText: "text-neutral-400",
              footerActionLink: "text-purple-300 hover:text-purple-200",
              formButtonPrimary:
                "bg-brand-purple text-white hover:bg-purple-500 shadow-lg shadow-purple-950/30",
            },
          }}
        />
      </section>
    </main>
  );
}
