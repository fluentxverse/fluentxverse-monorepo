# Business English Level 3 Plan

## Purpose

This file stores the working plan and key decisions for the Business English Level 3 build so the project context can be recovered later even if chat context is limited.

## Locked Decisions

- Course: Business English
- Level: 3
- Chapter count: 5
- Lessons per chapter: 10
- Total lessons: 50
- Translation language: KR
- Business English is a separate material system and must not be treated as Conversational Skills
- Core Business English lesson flow:
  - Warm-Up
  - Key Expressions
  - Comprehension
  - Drill
  - Simulation

## Special Lesson 10 Plan

- Lesson 10 in each chapter is planned as a dynamically generated lesson
- It should be based on the student's mistakes, corrections, and weak points from Lessons 1 to 9 in the same chapter
- This is not only a content task. It is a cross-app product feature involving tutor input, backend storage, aggregation logic, and lesson generation

## Current Product Understanding

- The current Business English admin editor supports a dedicated `beData` lesson structure
- The live admin flow is designed around 10 lessons per chapter
- Existing mock/reference materials for Business English Level 3 already provide a useful content seed, but they currently reflect a 5-lesson-per-chapter reference structure
- The Business English lesson model is separate from the general Conversational Skills lesson-material builder

## Immediate Priority

We need to inspect the tutor app first.

Reason:
- Dynamic Lesson 10 depends on structured correction data
- We need to understand where tutor notes, corrections, feedback, and post-lesson observations are currently entered
- We need to determine what is already stored versus what is only free-text or not stored at all

## Discovery Goals For Tutor App Review

1. Find where tutors currently write lesson feedback, corrections, or notes
2. Check whether correction data is structured, semi-structured, or plain text
3. Identify the backend models and APIs used to save tutor-side lesson outcomes
4. Check whether corrections can be linked to:
   - student
   - course
   - chapter
   - lesson number
   - mistake category
5. Determine what minimum schema is needed to support dynamic Lesson 10 generation

## Working MVP Direction For Dynamic Lesson 10

- Start with a structured correction model instead of relying only on free-text tutor notes
- Aggregate repeated issues across Lessons 1 to 9
- Generate Lesson 10 from the top recurring issues for that student within the chapter
- Keep the generated output in Business English format:
  - Warm-Up
  - Key Expressions
  - Comprehension
  - Drill
  - Simulation
- Include fallback behavior when too little usable correction data exists

## Likely Work Areas

- Tutor app UI and lesson workflow
- Server routes and persistence for structured corrections
- Student or tutor lesson history retrieval
- Business English generation logic
- Possibly dashboard/admin tooling for review or override

## Next Step

Review the tutor app to map the current tutor note and feedback flow before designing the dynamic Lesson 10 architecture.
