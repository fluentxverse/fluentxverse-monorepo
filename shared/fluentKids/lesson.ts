import template from './park.html?raw';
import bird from './art/bird.webp';
import tree from './art/tree.webp';
import ball from './art/ball.webp';
import flower from './art/flower.webp';
import bench from './art/bench.webp';
import kite from './art/kite.webp';
import parkStory from './art/park-story.webp';
import parkMission from './art/park-mission.webp';
import './lesson.css';

const artwork: Record<string, string> = {
  bird, tree, ball, flower, bench, kite, 'park-story': parkStory, 'park-mission': parkMission,
};

interface LessonOptions {
  courseHref: string;
  audience: 'student' | 'tutor' | 'admin';
}

function updateBilingualText(element: Element, english: string, japanese: string) {
  element.querySelector('[data-en]')!.textContent = english;
  element.querySelector('[data-ja]')!.textContent = japanese;
}

export function mountParkLesson(container: HTMLElement, options: LessonOptions) {
  // This template is reviewed course content bundled with the app.
  container.innerHTML = template;
  const lesson = container.firstElementChild as HTMLElement;
  lesson.querySelector<HTMLAnchorElement>('[data-course-link]')!.href = options.courseHref;
  for (const picture of lesson.querySelectorAll<HTMLImageElement>('img[data-art]')) {
    picture.src = artwork[picture.dataset.art!];
  }
  if (options.audience === 'student') {
    lesson.querySelectorAll('[data-view-tools], .kf-teacher').forEach(element => element.remove());
  }

  const items = [...lesson.querySelectorAll<HTMLElement>('[data-item]')].map(item => ({
    item,
    feedback: item.querySelector<HTMLElement>('.kf-feedback')!,
    blank: item.querySelector<HTMLElement>('.kf-blank'),
    japaneseBlank: item.querySelector<HTMLElement>('[data-blank-ja]'),
    buttons: [...item.querySelectorAll<HTMLButtonElement>('button')],
    correct: Number(item.dataset.answer),
    selected: -1,
  }));
  const answerStatus = lesson.querySelector('.kf-exercise-status')!;
  let checked = false;

  function updateAnswers() {
    let answered = 0;
    let correct = 0;
    for (const exercise of items) {
      const { item, buttons, selected, feedback, blank, japaneseBlank } = exercise;
      const hasAnswer = selected >= 0;
      const isCorrect = selected === exercise.correct;
      if (hasAnswer) answered++;
      if (isCorrect) correct++;
      buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
      if (blank) blank.textContent = buttons[selected]?.dataset.answerEn ?? '…';
      if (japaneseBlank) japaneseBlank.textContent = buttons[selected]?.dataset.answerJa ?? '〇〇';
      item.dataset.checked = String(checked);
      if (!checked) continue;
      if (!hasAnswer) updateBilingualText(feedback, 'Choose an answer. Your tutor can help.', '答えをえらぼう。先生に聞いてもいいよ。');
      else if (isCorrect) updateBilingualText(feedback, 'You’ve got it! Say your answer aloud.', 'できたね！ 答えを声に出そう。');
      else updateBilingualText(feedback, `Let’s try again. ${item.dataset.explanation}`, `もう一度やってみよう。 ${item.dataset.explanationJa}`);
    }
    if (checked) {
      const remaining = answered < items.length;
      updateBilingualText(answerStatus,
        `${correct} of ${items.length} correct. ${remaining ? 'Try the remaining questions.' : 'Say your answers aloud.'}`,
        `${items.length}問中${correct}問正解。 ${remaining ? 'のこりの問題もやってみよう。' : '答えを声に出そう。'}`);
    } else {
      updateBilingualText(answerStatus, `${answered} of ${items.length} answers chosen.`, `${items.length}問中${answered}問の答えをえらんだよ。`);
    }
  }

  const ageButtons = lesson.querySelectorAll<HTMLButtonElement>('[data-age]');
  const ageContent = lesson.querySelectorAll<HTMLElement>('[data-age-content]');
  const viewButtons = lesson.querySelectorAll<HTMLButtonElement>('[data-view]');
  const reflectionButtons = lesson.querySelectorAll<HTMLButtonElement>('[data-reflect]');
  function setView(view: string) {
    lesson.dataset.tutor = String(view === 'tutor');
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(view === button.dataset.view)));
  }
  setView(options.audience === 'tutor' ? 'tutor' : 'student');
  const events = new AbortController();
  lesson.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.hasAttribute('data-japanese-toggle')) {
      const showJapanese = lesson.dataset.japanese !== 'true';
      lesson.dataset.japanese = String(showJapanese);
      button.setAttribute('aria-pressed', String(showJapanese));
    } else if (button.dataset.age) {
      ageButtons.forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
      ageContent.forEach(section => { section.hidden = section.dataset.ageContent !== button.dataset.age; });
    } else if (button.dataset.view && options.audience !== 'student') {
      setView(button.dataset.view);
    } else if (button.dataset.reflect) {
      reflectionButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
      updateBilingualText(lesson.querySelector('.kf-reflection-status')!,
        `You chose “${button.dataset.reflect}.” Tell your tutor what you would like to try next.`,
        `「${button.dataset.reflectJa}」をえらんだね。次にやってみたいことを先生に伝えよう。`);
    } else if (button.hasAttribute('data-check')) {
      checked = true;
      updateAnswers();
    } else {
      const exercise = items.find(({ buttons }) => buttons.includes(button));
      if (!exercise) return;
      exercise.selected = exercise.buttons.indexOf(button);
      updateAnswers();
    }
  }, { signal: events.signal });

  // Keep section links inside the lesson when it is embedded in a classroom.
  lesson.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const href = event.target.closest('a')?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    const target = lesson.querySelector(href) ?? (href === '#kids-full-lesson' ? lesson : null);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
    if (target instanceof HTMLElement) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }, { signal: events.signal });

  return () => events.abort();
}
