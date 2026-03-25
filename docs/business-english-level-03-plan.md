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

## RareJob Level 3 Reference Notes

- Reference source reviewed:
  - `/home/paulanthonyarriola/Desktop/rarejob_predicted_tutor_urls_v2.fixed.csv`
- RareJob Level 3 is organized as:
  - 6 chapters
  - 5 lessons per chapter
  - a repeated cycle of:
    - Listening
    - Speaking 1
    - Reading
    - Speaking 2
    - Review
- Main Level 3 chapter themes in the reference:
  - Work Introductions
  - Company / Responsibilities / Work Day
  - Meetings / Schedules / Appointments
  - Food / Ordering / Offering
  - Office Tour / Directions / Office Supplies
  - Job Search / Interview

## What To Borrow From The Reference

- Strong functional progression inside each chapter
- Short, practical beginner workplace goals
- Repetition of the same language across input and output tasks
- Clear tutor-facing scripting and scaffolding
- Review lessons that recombine earlier language into one practical task
- Use of simple workplace documents such as e-mails, memos, schedules, and maps

## What Not To Copy

- Do not copy lesson titles, dialogues, scenarios, question wording, or example sets
- Do not mirror the chapter map 1:1 just because the reference has 6 chapters
- Do not bring over Japanese content or JP-facing assumptions
- Do not force the reference skill labels directly into our Business English schema

## Current Format We Must Keep

- App/editor capacity remains:
  - 5 chapters
  - 10 lessons per chapter
- Business English lesson data must stay in the current `beData` structure
- The user-facing Business English flow remains:
  - Warm-Up
  - Key Expressions
  - Comprehension
  - Drill
  - Simulation
- In the current schema this maps to:
  - `introduce`
  - `present`
  - `understand`
  - `practice`
  - `challenge`
- Existing `discussion` and `feedback` blocks can remain lightweight support sections

## Recommended Level 3 Adaptation Direction

- Keep our existing 5-chapter Level 3 direction as the main spine because it already fits the current product:
  - Work Introductions
  - Office Basics
  - Time and Schedules
  - Requests and Help
  - Phone and Email Communication
- Use RareJob as a reference for progression quality, not for direct lesson conversion
- Treat each chapter as two arcs:
  - Lessons 1-4 = foundation
  - Lesson 5 = checkpoint / review
  - Lessons 6-9 = extension / stronger output
  - Lesson 10 = dynamic personalized review/remediation
- Pull selected ideas from the reference only where they support our existing spine:
  - company profile / job role content can enrich Chapters 1-2
  - schedule / appointment material can enrich Chapter 3
  - hospitality / offering language can inform polite request lessons in Chapter 4
  - office tour / supplies / memo ideas can support Chapters 2 and 5
- Save heavier job interview material for a later level unless we intentionally expand Level 3 scope

## Content Writing Rules For The New Level 3

- Write original scenarios, original documents, and original examples
- Use KR for all translation fields
- Keep vocabulary and patterns beginner-safe and workplace-realistic
- Use only `3` key expressions per lesson for Level 3
- Recycle target expressions across the five core sections of the lesson
- Make simulations clearly different from drills:
  - drills = controlled practice
  - simulation = realistic workplace interaction

## Tutor Notes Standard

- Tutor teaching notes must be fully scripted, not generic
- For `Key Expressions`, the tutor notes should explicitly tell the tutor:
  - opening transition into the section
  - read the first pattern and ask for repetition
  - exact explanation of how to use the first pattern
  - read the second pattern and ask for repetition
  - exact explanation of how to use the second pattern
  - read the third pattern and ask for repetition
  - exact explanation of how to use the third pattern
  - closing question and transition to the next page
- The required model for Level 3 Key Expressions is:
  - script: `"Let's look at patterns used in ..."`
  - instruction: `Read the first pattern. Ask the student to repeat.`
  - script: `"Use this to ..."`
  - instruction: `Read the second pattern. Ask the student to repeat.`
  - script: `"Use this to ..."`
  - instruction: `Read the third pattern. Ask the student to repeat.`
  - script: `"Use this to ..."`
  - script: `"Do you have any questions about the patterns?"`
  - script: `"Let's go to the next page."`
- This scripted standard should be used for all Business English Level 3 lessons unless a section clearly needs a stronger custom version

## Chapter 1 Build Status

- Chapter 1 metadata is now set in the live course as:
  - Theme: `Work Introductions`
  - Name: `Work Introductions`
- Existing lessons 1-5 remain the foundation arc
- New extension lessons 6-10 are now defined as:
  - Lesson 6 `Listening`: `Meet the Support Team`
    - Goal: understand a short team introduction and simple job roles
  - Lesson 7 `Reading`: `Team Directory`
    - Goal: read a simple team directory and find the right person for a task
  - Lesson 8 `Speaking`: `My Main Tasks`
    - Goal: explain your department and main tasks in simple business English
  - Lesson 9 `Speaking`: `The Right Person to Ask`
    - Goal: introduce a coworker and explain who can help with different tasks
  - Lesson 10 `Review`: `Chapter 1 Personal Review`
    - Goal: review Chapter 1 based on personal weak points from Lessons 1-9
    - Note: currently written as a fallback static review template, with tutor notes marking it as the future dynamic lesson slot

## Extension Build Status

- Chapters 2 to 5 draft generation was removed from the live course and local lesson-data extension files
- Level 3 is currently being treated as:
  - Chapter 1 kept
  - Chapter 2 to Chapter 5 pending rewrite after better PDF-based reference review

## Next Step

Open the actual RareJob Level 3 PDF lessons chapter by chapter, extract the strongest non-copyable ideas, and rebuild Chapter 2 onward more carefully.
