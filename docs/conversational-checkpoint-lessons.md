# Conversational Skills checkpoint lessons

Lessons 5 and 10 are student-specific reviews. Lesson 5 uses published Lessons 1-4 in the same level and chapter; Lesson 10 uses published Lessons 6-9. A checkpoint slot appears in the student and tutor lesson lists only when all four source lessons are published. An authored review lesson may occupy the same slot.

The first authenticated open generates a lesson with new Step A and Step B exercises and three connected challenges: sustained speaking, practical reading, and follow-up speaking. It reuses the four lessons' grammar tips and vocabulary as review material. Recent incorrect exercise marks and classroom notes can influence a few practice items. If there are fewer than two specific observed errors or corrections, the prompt omits isolated errors and reviews all four lessons evenly. It must not invent a weakness.

The generated lesson is saved as a `StudentCheckpointLesson` node in Memgraph, keyed by student, course, level, chapter, and checkpoint number. Reopening returns the same snapshot; later changes to tutor notes do not silently rewrite a lesson the student may already have used. Student access requires student authentication. Tutor access requires an active classroom session so the server can resolve the assigned student. The student response excludes tutor guidance and exercise answer keys; the saved lesson and tutor response retain them. Personalized content is never served through the public lesson-preview endpoint.

Generation validates the structured response before saving: all four source lessons must appear in both exercise steps, errors must have real corrections, choices must differ, and HTML is rejected. A failed generation is not persisted and can be retried. The feedback rubric and range/accuracy/fluency guide remain fixed rather than AI-generated.

Tests:

```sh
cd fluentxverse-server
bun test tests/checkpointLesson.test.ts
TEST_MEMGRAPH_URI=bolt://127.0.0.1:7687 bun tests/checkpointLesson.integration.ts
```
