type LessonTitles = readonly [string, string, string, string, string];
type Unit = readonly [name: string, lessons: LessonTitles];

export const FLUENT_KIDS_NAME = 'Fluent Kids';
export const FLUENT_KIDS_PATH = '/materials/fluent-kids';
export const FLUENT_KIDS_EDITOR_PATH = '/fluent-kids-editor';
export const PARK_LESSON_ID = 'fluent-kids-l1-u1-l1';
export const PARK_LESSON_GOAL = 'I can name things I see and ask, “What do you see?”';
export const PARK_LESSON_HREF = `${FLUENT_KIDS_PATH}/lesson/${PARK_LESSON_ID}`;
export const PARK_CLASSROOM_MATERIAL = {
  id: PARK_LESSON_ID,
  course: 'young-learners',
  level: 1,
  // The shared classroom picker uses chapter for its grouping field.
  chapter: 1,
  chapterLabel: 'Chapter 1: At the Park',
  lessonNumber: 1,
  lessonTitle: 'Lesson 1: A Day in the Park',
  goalTextEn: PARK_LESSON_GOAL,
};

const levels: readonly { name: string; goal: string; units: readonly Unit[] }[] = [
  {
    name: 'First Conversations',
    goal: 'Name and describe familiar things and take turns in short conversations.',
    units: [
      ['At the Park', ['A Day in the Park', 'The Color Hunt', 'Where’s the Ball?', 'Park Detectives', 'Be My Park Guide']],
      ['My School Bag', ['What’s in My Bag?', 'How Many Pencils?', 'Can I Borrow It?', 'Pack for Class', 'Ready for School']],
      ['Animal Friends', ['Meet the Animals', 'Big, Small, and Fast', 'Can It Swim?', 'Guess My Animal', 'Animal Keeper']],
      ['Snack Time', ['What’s in the Lunchbox?', 'I Like Apples', 'Can I Have Some Water?', 'A Snack for My Friend', 'Snack Stand']],
      ['Outside Today', ['What’s the Weather Like?', 'What Are You Wearing?', 'What Should I Wear?', 'Pack for a Rainy Day', 'Weather Helper']],
      ['Let’s Play', ['What Do You Like to Play?', 'Can You Play With Me?', 'My Turn, Your Turn', 'Pick a Game Together', 'Playground Partners']],
      ['People I Know', ['Meet My Family', 'Who’s in the Picture?', 'How Are They Feeling?', 'What Do They Like?', 'Meet the Characters']],
      ['At Home', ['Welcome to My Home', 'What’s in This Room?', 'Where Are My Shoes?', 'What Are They Doing?', 'The Home Tour']],
    ],
  },
  {
    name: 'Everyday English',
    goal: 'Ask for information, talk about routines and plans, and solve everyday problems.',
    units: [
      ['Around Town', ['Places in My Town', 'Go Straight, Turn Left', 'Follow the Map', 'Ask a Local', 'Help a Visitor']],
      ['My Week', ['What Time Do You Get Up?', 'My School-Day Routine', 'How Often Do You Play?', 'Interview a Friend', 'Our Week in Pictures']],
      ['Animal Habitats', ['Where Do Animals Live?', 'What Do They Eat?', 'Read an Animal Fact Card', 'Compare Two Animals', 'Habitat Match']],
      ['At the Café', ['Read the Menu', 'I’d Like a Sandwich', 'What Would You Like to Drink?', 'Sorry, We’re Out of That', 'Café Roleplay']],
      ['Weekend Plans', ['What Are You Doing on Saturday?', 'Would You Like to Come?', 'Where and When?', 'Make a Plan That Works', 'See You on Saturday']],
      ['Lost and Found', ['What Does It Look Like?', 'Where Did You Last See It?', 'Read a Lost-Item Notice', 'Ask the Office for Help', 'Find the Right Bag']],
      ['At the Market', ['Make a Shopping List', 'How Much Is It?', 'How Many Do We Need?', 'Choose Within a Budget', 'Shop for a Picnic']],
      ['On the Move', ['How Do You Get There?', 'Read a Simple Timetable', 'Which Bus Should We Take?', 'We Missed the Bus', 'Get There on Time']],
    ],
  },
  {
    name: 'Stories & Projects',
    goal: 'Retell events, give reasons, and make decisions with a partner.',
    units: [
      ['Plan a Day Out', ['Read Three Place Cards', 'Compare Two Places', 'Give a Reason', 'Agree on the Schedule', 'Pitch Our Day Out']],
      ['School Club Fair', ['Explore Club Posters', 'Ask About Interests', 'Interview a Club Member', 'Recommend a Club', 'Find the Right Club']],
      ['Wildlife Report', ['Choose an Animal', 'Find the Main Idea', 'Pick the Best Facts', 'Rehearse and Take Questions', 'Wildlife Reporter']],
      ['Design a Café', ['Explore Two Menus', 'Choose Who the Café Is For', 'Write a Mini Menu', 'Solve a Customer Problem', 'Present Your Café']],
      ['A Plan That Changed', ['What Was the Plan?', 'What Happened First?', 'Explain Why It Changed', 'Suggest a Backup Plan', 'Tell the Story, Fix the Plan']],
      ['The Missing Bag', ['Read the Case File', 'Ask Two Witnesses', 'Put the Clues in Order', 'Test Your Explanation', 'Solve the Mystery']],
      ['Build a Better Park', ['Read the Park Map', 'Listen to What Visitors Need', 'Compare Improvements', 'Choose Two Changes', 'Pitch a Better Park']],
      ['The Kids’ News Show', ['Choose a Local Story', 'Prepare Interview Questions', 'Interview a Guest', 'Write and Rehearse the Rundown', 'Present the News']],
    ],
  },
];

export const fluentKidsLevels = levels.map((level, levelIndex) => ({
  name: level.name,
  goal: level.goal,
  number: levelIndex + 1,
  units: level.units.map(([name, lessons], unitIndex) => ({
    name,
    number: unitIndex + 1,
    lessons: lessons.map((title, lessonIndex) => {
      const id = `fluent-kids-l${levelIndex + 1}-u${unitIndex + 1}-l${lessonIndex + 1}`;
      return { id, title, number: lessonIndex + 1, checkpoint: lessonIndex === 4, available: id === PARK_LESSON_ID };
    }),
  })),
}));

export const fluentKidsLessonCount = fluentKidsLevels.reduce(
  (count, level) => count + level.units.reduce((total, unit) => total + unit.lessons.length, 0),
  0,
);
