import { Check } from 'lucide-solid';
export default function LessonJourney(props: { active: 'prepare' | 'classroom' | 'feedback' }) {
    const steps = [
        { id: 'booked', label: 'Booked', href: '#lesson-tutor-title' },
        { id: 'prepare', label: 'Prepare', href: '#lesson-classroom-title' },
        { id: 'classroom', label: 'Classroom', href: '#lesson-classroom-title' },
        { id: 'feedback', label: 'Feedback', href: '#student-recap-title' },
    ];
    const current = () => steps.findIndex(step => step.id === props.active);
    return <nav class="lesson-journey" aria-label="Lesson progress"><ol>{steps.map((step, index) => <li class={index < current() ? 'is-complete' : index === current() ? 'is-current' : ''}>
        <a href={step.href} aria-current={index === current() ? 'step' : undefined}><span class="lesson-journey-mark" aria-hidden="true">{index < current() ? <Check size={15}/> : index + 1}</span><span>{step.label}</span></a>
    </li>)}</ol></nav>;
}
