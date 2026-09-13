export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full page-fade-in">
      {children}
    </div>
  );
}
