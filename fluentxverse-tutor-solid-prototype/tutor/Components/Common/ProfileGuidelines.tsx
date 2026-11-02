import type { Component } from 'solid-js';
import { Camera, Video, UserRound } from 'lucide-solid';
import TutorArt from './TutorArt';
import './ProfileGuidelines.css';

const ProfileGuidelines: Component<{ kind: 'photo' | 'video' | 'interests' | 'nickname' | 'bio'; expanded?: boolean }> = props => {
  const title = () => props.kind === 'bio' ? 'Bio guidelines' : props.kind === 'nickname' ? 'Nickname guidelines' : props.kind === 'photo' ? 'Profile photo guidelines' : props.kind === 'video' ? 'Introduction video guidelines' : 'Interests guidelines';
  return <details class="profile-guidelines" open={props.expanded !== false}>
    <summary>{props.kind === 'bio' ? <TutorArt name="profile" size={24}/> : props.kind === 'nickname' ? <UserRound size={17}/> : props.kind === 'photo' ? <Camera size={17}/> : props.kind === 'video' ? <Video size={17}/> : <TutorArt name="interests" size={24}/>}<span>{title()}</span></summary>
    <div class="profile-guidelines-body">
      {props.kind === 'bio' && <>
        <p>Write a short introduction that helps students understand who you are as a tutor and what learning with you will be like.</p>
        <ul>
          <li>Introduce yourself using your preferred nickname, without your surname.</li>
          <li>Mention relevant teaching or work experience, your teaching approach, and how you can support students' English goals.</li>
          <li>You may include a genuine hobby or interest to help students connect with you. Finish with a friendly invitation to learn together.</li>
          <li>Use a few clear sentences in your own words. Check spelling and grammar, and keep the tone welcoming, professional, and focused on learning.</li>
          <li>Leave out contact details, social handles, private information, advertising, and unrelated personal messages. Avoid emoji, decorative lettering, copied quotes, and song lyrics.</li>
          <li>Be honest about your experience and qualifications. Do not promise guaranteed results.</li>
        </ul>
        <p><strong>Example:</strong> Hi, I'm Alex. I enjoy helping learners build confidence in everyday English. My lessons include clear explanations and plenty of conversation practice. I enjoy reading and learning about other cultures. I look forward to learning with you!</p>
        <p class="guideline-review-note">Your bio is reviewed before it appears to students. Updates to an approved profile also need review.</p>
      </>}
      {props.kind === 'nickname' && <>
        <p>Choose the name students will see on your profile and in lessons.</p>
        <ul>
          <li>Use a familiar first name or short nickname that is easy to read, say, and remember. Leave out your surname.</li>
          <li>Use 2-24 letters. Single spaces, hyphens, and apostrophes between names are allowed.</li>
          <li>Use ordinary spelling and capitalization. Avoid all caps, repeated letters, stylized lettering, numbers, emoji, and decorative symbols.</li>
          <li>Do not include titles such as Teacher or Doctor, contact information, social handles, advertising, offensive language, or another person's identity.</li>
          <li>Use the same nickname in your introduction video. Changes to an approved nickname need admin review before students see them.</li>
        </ul>
        <p class="guideline-review-note">Your legal account name stays unchanged. The review team checks readability, appropriateness, and consistency with your introduction.</p>
      </>}
      {props.kind === 'photo' && <>
        <p>A clear, welcoming portrait helps students recognize you and feel comfortable booking a lesson.</p>
        <ul>
          <li>Use a recent photo taken within the past six months, with only you in the frame.</li>
          <li>Face the camera in a collared shirt. Frame yourself from the chest up, with your face centered and space around your head and shoulders.</li>
          <li>Choose even, bright lighting and a friendly, natural smile. Keep the look professional and approachable.</li>
          <li>Keep hands out of the shot. Do not wear hats or sunglasses.</li>
          <li>Use a plain light-gray background: <span class="photo-background-swatch" aria-hidden="true"/> <strong>#C8C8C8</strong>.</li>
          <li>Upload a JPG/JPEG file, at least <strong>480 x 480 pixels</strong>, no larger than <strong>3 MB</strong>.</li>
        </ul>
        <p class="guideline-review-note">The review team checks portrait framing, clothing, lighting, background, and recency.</p>
      </>}
      {props.kind === 'video' && <>
        <p>Introduce the tutor students will meet: warm, clear, and focused on what you can help them learn.</p>
        <ul>
          <li>Prepare <strong>35-70 spoken words</strong> and keep the entire recording to <strong>30 seconds or less</strong>, even when reading from a script.</li>
          <li>Use your nickname, not your surname. You may mention your city, province, or country, but never share contact details, your address, account handles, or other private information.</li>
          <li>Use your own words. Leave out emoji, decorative symbols, quotations, and song lyrics.</li>
        </ul>
        <ol>
          <li><strong>Opening, up to 5 seconds:</strong> greet students and introduce yourself by nickname.</li>
          <li><strong>Main message:</strong> choose no more than two topics: relevant teaching or work experience; hobbies, travel, or interest in Japanese culture; what your lessons are like; or why students might enjoy learning with you.</li>
          <li><strong>Closing:</strong> invite students to book a lesson and end with a brief thank-you or friendly goodbye.</li>
        </ol>
        <p class="guideline-review-note">FluentXVerse may request changes to meet its profile standards. Spoken word count, privacy, and script content are checked during review.</p>
      </>}
      {props.kind === 'interests' && <p>Choose up to five genuine interests to help students find common ground with you. Keep each entry short, specific, and different from the others.</p>}
    </div>
  </details>;
};
export default ProfileGuidelines;
