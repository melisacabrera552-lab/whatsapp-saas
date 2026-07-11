import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 gap-6">
      <div className="flex flex-col items-center gap-2.5">
        <Image
          src="/brand/pixiweb-icon.png"
          alt="Pixiweb"
          width={600}
          height={619}
          priority
          className="h-12 w-auto"
        />
        <p className="accent text-xl leading-none">tu inbox en calma</p>
      </div>
      {children}
    </div>
  );
}
