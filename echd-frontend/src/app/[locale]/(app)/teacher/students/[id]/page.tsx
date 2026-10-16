import { StudentDetail } from '@/components/app/student-detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetail id={id} mode="teacher" />;
}
