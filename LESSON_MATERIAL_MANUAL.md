# Conversational Skills Lesson Material Maker — Quick Manual

## Overview

The Visual Editor is a WYSIWYG page builder for creating conversational English lesson materials. It provides inline text editing, section editors, a floating AI assistant, autosave, and an optional Story Mode for immersive K-drama style lessons.

---

## Toolbar

| Feature | Description |
|---------|-------------|
| **Back** | Returns to the lesson list |
| **Preview** | Opens student-facing preview in a new tab |
| **Save** | Manual save (autosave triggers 5 sec after any edit) |

---

## Hero Header

Click the header to open a side panel with:
- Background image upload
- Overlay color picker + opacity slider
- Editable: **Chapter Name**, **Lesson Name**, **Goal (EN)**, **Goal (JP/KR)**

---

## Lesson Sections

### 1. Introduce
- Intro paragraphs (multilingual) + optional image
- Lesson Issue callout (title + bullet points)
- Lesson Goal Steps (tutor guide)

### 2. Learn (Step A + Step B)

**Step A** — choose one:
- **Vocabulary**: image + English text + highlighted word + translation
- **Expressions**: rich-text definition + example sentence + translation

**Step B** — choose one:
- **Speak Your Mind**: explanation + two-speaker dialogue + question
- **Grammar Tip**: grammar rules with translations + examples
- **Pronunciation**: tip + phrases with pronunciation guides

### 3. Apply

Choose one activity type:
- **Speaking**: situation + dialogue lines (speaker + text) + tutor steps
- **Listening**: situation + listening script + comprehension questions
- **Reading**: situation + reading passage + tutor steps

Optional **Trivia Time** sub-section available for all types.

### 4. Exercise (Step A + optional Step B)

**Step A** — choose one:
- **Rephrase**: expression box + exercise items
- **Choose**: sentences with parenthetical choices
- **Change**: sentences with underlined portions to modify

**Step B** (optional) — choose one:
- **Conversation**: speech bubbles with fill-in-the-blank
- **Multiple Choice**: bold sentence + A/B options
- **Speech**: speaker with free-form bubble
- **Compare**: word box + comparison images + clue sentences

Both include Answer Keys and Tutor Guide Steps.

### 5. Mission (Challenge 1) & Mission 2 (Challenge 2)

Choose one type per challenge:
- **Speaking**: roleplay scenario + questions with hints
- **Discussion**: topic cards with grouped personal questions
- **Reading**: reading passage + roleplay follow-up
- **Listening**: listening script + roleplay follow-up

All include: situation/instruction, optional grammar tip, and Tutor Guide Steps.

### 6. Feedback (auto-populated)
- 4-point rubric (Very Good → Poor)
- Personalized feedback: Range, Accuracy, Fluency with "You said → Better" examples

---

## AI Content Generator

Toggle the floating **magic wand** button to open the AI panel.

### Section Tabs
Seven tabs: **Introduce**, **Learn**, **Apply**, **Trivia**, **Exercise**, **Mission**, **Mission 2**. A **✓** badge shows which sections already have content.

### How to Generate
1. Select the section tab you want
2. (Optional) Edit **Base Instructions** or add **Additional Notes**
3. Click **Generate [Section]** — or **Generate All** for batch
4. Preview the result in the modal → click **Insert Content** to apply

### Options
- **Generation Mode**: *Generate New* or *Improve Existing*
- **Include Translations**: toggle + pick language (JP/KR/VN/CN)
- **Include Lesson Issue**: for Introduce section only
- **Step A/B toggle**: for Learn and Exercise sections

### Story Mode
When enabled, story context (characters, setting, plot points) is injected into AI generation.
- **Important**: Generate sections in order (Introduce → Learn → Apply → Exercise → Mission) so each section continues the story
- Apply must be generated before Mission (the button is locked otherwise)

---

## Workflow Tips

1. **Fill the header first** — lesson name and goal are used by the AI for context
2. **AI reads your editor** — it matches your current item counts, selected types, and dialogue line counts
3. **Use Step A/B toggles** — generate Learn and Exercise steps independently
4. **Preview often** — check the student-facing view before saving
5. **Base Instructions persist** — they're saved to your browser across sessions
6. **Autosave is active** — changes save automatically after 5 seconds of inactivity
