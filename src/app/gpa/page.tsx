import { getSubjectsFromDB } from '@/lib/dataFetcher';
import GPAClient from './GPAClientComponent';

export const dynamic = 'force-dynamic';

export default async function GPAPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; semester?: string }>;
}) {
  const params = await searchParams;
  const branch = params.branch || 'AIDS';
  const semester = Number(params.semester || '4');

  const subjects = await getSubjectsFromDB(branch, semester);
  // Filter out the "Syllabus" entry if it exists in subjects list
  const filteredSubjects = subjects.filter((s: any) => s.name.toUpperCase() !== 'SYLLABUS');

  return (
    <GPAClient 
      initialSubjects={filteredSubjects} 
      branch={branch} 
      semester={semester} 
    />
  );
}
