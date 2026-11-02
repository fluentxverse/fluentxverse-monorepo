import { onMount } from 'solid-js';
import { ArrowLeft, ArrowRight } from 'lucide-solid';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import InterviewPreparation from '../Components/InterviewPreparation';
import { useAuthContext } from '../context/AuthContext';
export default function InterviewGuidePage() {
  const auth = useAuthContext();
  onMount(() => { document.title = 'Interview Guide | FluentXVerse'; window.scrollTo(0, 0); });
  return <><SideBar/><div class="main-content"><DashboardHeader user={auth.user || undefined}/><main class="interview-guide-page">
    <a href="/home"><ArrowLeft size={16}/>Application progress</a><h1>Your FluentXVerse interview</h1>
    <InterviewPreparation/><a class="interview-prep-link" href="/interview">ID submission &amp; interview booking <ArrowRight size={17}/></a>
  </main></div></>;
}
