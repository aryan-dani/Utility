import GPAClient from './GPAClientComponent';

export const dynamic = 'force-dynamic';

export default async function GPAPage() {
  return (
    <div className="min-h-screen bg-background">
      <GPAClient />
    </div>
  );
}
