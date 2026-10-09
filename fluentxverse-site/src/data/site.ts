import { BookOpen, GraduationCap } from 'lucide-solid';

export const projects = [
  {
    id: 'student',
    number: '01',
    name: 'ESL student app',
    category: 'FOR LEARNERS',
    description: 'The learner side of FluentXVerse ESL. Book one-to-one English lessons, study with learning materials, and follow your progress.',
    details: ['Onchain lesson tickets', 'One-to-one lessons', 'Progress & feedback'],
    href: 'https://student.fluentxverse.com',
    cta: 'Explore the ESL student app',
    image: '/assets/img/esl-japanese-student-v2.webp',
    alt: 'A Japanese student learning English at a laptop in a bright home study space',
    icon: BookOpen,
  },
  {
    id: 'tutor',
    number: '02',
    name: 'ESL tutor app',
    category: 'FOR EDUCATORS',
    description: 'The educator side of FluentXVerse ESL. Teach English, manage your lesson schedule, and give learners feedback that helps them improve.',
    details: ['Lesson scheduling', 'Teaching resources', 'Student feedback'],
    href: 'https://tutor.fluentxverse.com',
    cta: 'Explore the ESL tutor app',
    image: '/assets/img/esl-tutor-tailored.webp',
    alt: 'An English tutor wearing a headset and teaching from a laptop in a home workspace',
    icon: GraduationCap,
  },
];

export const founder = {
  name: 'Paul Anthony Arriola',
  role: 'CEO',
  image: '/assets/img/team/paul.webp',
  linkedin: 'https://www.linkedin.com/in/paul-anthony-arriola-a0436321b/',
};

// Replace the remaining placeholders with approved details and local portraits.
export const teamMembers: {
  name: string;
  role: string;
  bio: string;
  image?: string;
  linkedin?: string;
}[] = [
  { ...founder, bio: "Leading FluentXVerse's onchain education ecosystem." },
  {
    name: 'Agnes Atwel-Velasco',
    role: 'Head of Instructional Design',
    bio: 'Agnes leads instructional design at FluentXVerse, shaping the curriculum, lesson materials, and learning experiences behind our education apps. Her work focuses on clear learning goals, practical activities, and resources that support tutors and help learners build skills with confidence.',
    image: '/assets/img/team/agnes-headshot-v2.webp',
    linkedin: 'https://www.linkedin.com/in/agnes-atwel-161a60340/',
  },
  { name: 'Team member 03', role: 'Role to be announced', bio: 'Biography coming soon.' },
];

export const contactEmail = 'hello@fluentxverse.com';
