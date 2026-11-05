import { useRoute } from 'preact-iso';
import DispatchArticleMaterial from '../components/DispatchArticleMaterial';

export default function DailyDispatchStudentPage() {
  const { params } = useRoute();
  return <DispatchArticleMaterial id={params?.id || ''} view="student" />;
}
