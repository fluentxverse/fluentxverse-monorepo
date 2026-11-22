import park from './park.html?raw';
import colorHunt from './color-hunt.html?raw';
import wheresTheBall from './wheres-the-ball.html?raw';
import parkDetectives from './park-detectives.html?raw';
import parkGuide from './park-guide.html?raw';
import schoolBag from './school-bag.html?raw';
import howManyPencils from './how-many-pencils.html?raw';
import canIBorrowIt from './can-i-borrow-it.html?raw';
import packForClass from './pack-for-class.html?raw';
import readyForSchool from './ready-for-school.html?raw';
import meetTheAnimals from './meet-the-animals.html?raw';
import bigSmallAndFast from './big-small-and-fast.html?raw';
import canItSwim from './can-it-swim.html?raw';
import guessMyAnimal from './guess-my-animal.html?raw';
import animalKeeper from './animal-keeper.html?raw';
import bird from './art/bird.webp';
import tree from './art/tree.webp';
import ball from './art/ball.webp';
import flower from './art/flower.webp';
import bench from './art/bench.webp';
import kite from './art/kite.webp';
import parkStory from './art/park-story.webp';
import parkMission from './art/park-mission.webp';
import findTheBall from './art/find-the-ball.webp';
import ballOnBench from './art/ball-on-bench.webp';
import ballUnderBench from './art/ball-under-bench.webp';
import ballNextToBench from './art/ball-next-to-bench.webp';
import parkDetectiveStory from './art/park-detective-story.webp';
import blueBallOnBench from './art/blue-ball-on-bench.webp';
import blueBallUnderBench from './art/blue-ball-under-bench.webp';
import blueBallNextToBench from './art/blue-ball-next-to-bench.webp';
import parkGuideTour from './art/park-guide-tour.webp';
import schoolBagStory from './art/school-bag-story.webp';
import schoolBagMission from './art/school-bag-mission.webp';
import schoolBackpack from './art/school-backpack.webp';
import schoolBook from './art/school-book.webp';
import schoolPencil from './art/school-pencil.webp';
import schoolEraser from './art/school-eraser.webp';
import schoolRuler from './art/school-ruler.webp';
import schoolPencilCase from './art/school-pencil-case.webp';
import countingPencilsStory from './art/counting-pencils-story.webp';
import borrowPencilStory from './art/borrow-pencil-story.webp';
import packingForClassStory from './art/packing-for-class-story.webp';
import readyForSchoolStory from './art/ready-for-school-story.webp';
import animalPondStory from './art/animal-pond-story.webp';
import animalDog from './art/animal-dog.webp';
import animalCat from './art/animal-cat.webp';
import animalRabbit from './art/animal-rabbit.webp';
import animalDuck from './art/animal-duck.webp';
import animalFrog from './art/animal-frog.webp';
import animalFish from './art/animal-fish.webp';
import animalPathStory from './art/animal-path-story.webp';
import animalSizePair from './art/animal-size-pair.webp';
import animalRabbitHopping from './art/animal-rabbit-hopping.webp';
import animalTurtleWalking from './art/animal-turtle-walking.webp';
import animalActionStory from './art/animal-action-story.webp';
import animalDuckSwimming from './art/animal-duck-swimming.webp';
import animalBirdFlying from './art/animal-bird-flying.webp';
import animalRabbitHop from './art/animal-rabbit-hop.webp';
import animalTurtleStep from './art/animal-turtle-step.webp';
import animalClueStory from './art/animal-clue-story.webp';
import animalKeeperBoard from './art/animal-keeper-board.webp';
import {
  ANIMAL_KEEPER_LESSON_ID,
  BIG_SMALL_AND_FAST_LESSON_ID,
  CAN_I_BORROW_IT_LESSON_ID,
  CAN_IT_SWIM_LESSON_ID,
  COLOR_HUNT_LESSON_ID,
  GUESS_MY_ANIMAL_LESSON_ID,
  HOW_MANY_PENCILS_LESSON_ID,
  MEET_THE_ANIMALS_LESSON_ID,
  PACK_FOR_CLASS_LESSON_ID,
  PARK_DETECTIVES_LESSON_ID,
  PARK_GUIDE_LESSON_ID,
  PARK_LESSON_ID,
  READY_FOR_SCHOOL_LESSON_ID,
  SCHOOL_BAG_LESSON_ID,
  WHERES_THE_BALL_LESSON_ID,
  type FluentKidsLessonId,
} from './curriculum';
import './lesson.css';

const templates: Record<FluentKidsLessonId, string> = {
  [PARK_LESSON_ID]: park,
  [COLOR_HUNT_LESSON_ID]: colorHunt,
  [WHERES_THE_BALL_LESSON_ID]: wheresTheBall,
  [PARK_DETECTIVES_LESSON_ID]: parkDetectives,
  [PARK_GUIDE_LESSON_ID]: parkGuide,
  [SCHOOL_BAG_LESSON_ID]: schoolBag,
  [HOW_MANY_PENCILS_LESSON_ID]: howManyPencils,
  [CAN_I_BORROW_IT_LESSON_ID]: canIBorrowIt,
  [PACK_FOR_CLASS_LESSON_ID]: packForClass,
  [READY_FOR_SCHOOL_LESSON_ID]: readyForSchool,
  [MEET_THE_ANIMALS_LESSON_ID]: meetTheAnimals,
  [BIG_SMALL_AND_FAST_LESSON_ID]: bigSmallAndFast,
  [CAN_IT_SWIM_LESSON_ID]: canItSwim,
  [GUESS_MY_ANIMAL_LESSON_ID]: guessMyAnimal,
  [ANIMAL_KEEPER_LESSON_ID]: animalKeeper,
};

const artwork: Record<string, string> = {
  bird, tree, ball, flower, bench, kite, 'park-story': parkStory, 'park-mission': parkMission,
  'find-the-ball': findTheBall,
  'ball-on-bench': ballOnBench,
  'ball-under-bench': ballUnderBench,
  'ball-next-to-bench': ballNextToBench,
  'park-detective-story': parkDetectiveStory,
  'blue-ball-on-bench': blueBallOnBench,
  'blue-ball-under-bench': blueBallUnderBench,
  'blue-ball-next-to-bench': blueBallNextToBench,
  'park-guide-tour': parkGuideTour,
  'school-bag-story': schoolBagStory,
  'school-bag-mission': schoolBagMission,
  'school-backpack': schoolBackpack,
  'school-book': schoolBook,
  'school-pencil': schoolPencil,
  'school-eraser': schoolEraser,
  'school-ruler': schoolRuler,
  'school-pencil-case': schoolPencilCase,
  'counting-pencils-story': countingPencilsStory,
  'borrow-pencil-story': borrowPencilStory,
  'packing-for-class-story': packingForClassStory,
  'ready-for-school-story': readyForSchoolStory,
  'animal-pond-story': animalPondStory,
  'animal-dog': animalDog,
  'animal-cat': animalCat,
  'animal-rabbit': animalRabbit,
  'animal-duck': animalDuck,
  'animal-frog': animalFrog,
  'animal-fish': animalFish,
  'animal-path-story': animalPathStory,
  'animal-size-pair': animalSizePair,
  'animal-rabbit-hopping': animalRabbitHopping,
  'animal-turtle-walking': animalTurtleWalking,
  'animal-action-story': animalActionStory,
  'animal-duck-swimming': animalDuckSwimming,
  'animal-bird-flying': animalBirdFlying,
  'animal-rabbit-hop': animalRabbitHop,
  'animal-turtle-step': animalTurtleStep,
  'animal-clue-story': animalClueStory,
  'animal-keeper-board': animalKeeperBoard,
};

interface LessonOptions {
  courseHref: string;
  audience: 'student' | 'tutor' | 'admin';
}

function updateBilingualText(element: Element, english: string, japanese: string) {
  element.querySelector('[data-en]')!.textContent = english;
  element.querySelector('[data-ja]')!.textContent = japanese;
}

export function mountFluentKidsLesson(container: HTMLElement, id: FluentKidsLessonId, options: LessonOptions) {
  // This template is reviewed course content bundled with the app.
  container.innerHTML = templates[id];
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
