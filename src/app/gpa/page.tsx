import GPAClient from "./GPAClientComponent";

export const revalidate = 3600;

export default async function GPAPage() {
  return (
    <div className="min-h-screen">
      <GPAClient />
    </div>
  );
}
