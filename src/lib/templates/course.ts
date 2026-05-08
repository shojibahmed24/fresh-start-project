import type { Template } from "./types";

export const courseTemplate: Template = {
  id: "course",
  emoji: "🎓",
  name: "Course / LMS",
  tagline: "Lessons, video player & progress",
  gradient: "from-purple-600 to-pink-500",
  defaultName: "My Academy",
  defaultDescription: "Online course / LMS platform with lessons, video player and progress tracking.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST online course / LMS platform. Inspired by Teachable / Udemy / Coursera. Requirements:
- react-router-dom routes: /, /catalog, /course/:id, /learn/:courseId/:lessonId, /my-courses, /profile.
- Custom design system in index.css + tailwind.config.ts (HSL tokens, premium feel — refined neutrals + bold accent gradient, dark mode default for /learn). Theme toggle in nav. framer-motion for course card hovers, lesson check animation, progress bar fill, page transitions. shadcn/ui + lucide-react + tailwind only. Use shadcn Progress, Tabs, Accordion, Sheet.
- Every CTA, enroll button, lesson row click, video controls (play/pause/seek/speed/fullscreen), "Mark complete" toggle, theme toggle MUST work.
- Persist enrollments + lesson completion + last-watched position in localStorage so reload restores exactly where the learner stopped.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines (target 150-220).
- \`src/components/course/\`: SiteNav, HeroBanner, CategoryRail, CourseCard, CourseGrid, InstructorCard, CourseHero, CurriculumAccordion, LessonRow, ReviewsList, CtaEnrollBar, VideoPlayer, PlayerControls, LessonSidebar, ProgressRing, CompletionBadge, NextLessonCard.
- \`src/pages/Learn.tsx\` < 130 lines (layout: sidebar + player + notes/transcript tabs).
- \`src/store/courseStore.ts\` (zustand + persist) — enrolledIds, completedLessonIds, lastPositionByLesson, markComplete, setPosition.
- \`src/data/{courses,instructors,reviews}.ts\`.

Pages:
1. **/** — SiteNav (logo, Catalog / My Learning / Pricing links, search input, theme toggle, avatar dropdown); HeroBanner (eyebrow chip, big headline "Learn anything, on your schedule", search, popular topics chips); CategoryRail (8 category tiles with icon + course count); FeaturedCourses (3-column CourseGrid of 6 trending); InstructorCard row (top 6 instructors); testimonials; CTA banner; footer.
2. **/catalog** — left filter sidebar (Category, Level chips beginner/intermediate/advanced, Duration ranges, Price tiers, Rating) + sort dropdown + responsive CourseGrid of 24+ courses (cover, title, instructor, rating + review count, lesson count + total hours, price/Free badge, "Enroll" button — toggles to "Continue" if enrolled).
3. **/course/:id** — CourseHero (left: title, instructor avatar+name, rating, enrolled count, last updated, language; right: sticky video preview card with price + "Enroll now" / "Go to course" CTA + "Add to wishlist"); tabs (Overview / Curriculum / Instructor / Reviews). Curriculum = Accordion of sections, each with LessonRows (icon by type: video/quiz/reading, title, duration, lock if not enrolled, check if completed). Reviews = star distribution bar chart + review cards with avatar + rating + date + helpful count.
4. **/learn/:courseId/:lessonId** — LessonSidebar (left, w-80, collapsible, sticky): course title + ProgressRing (% complete), curriculum tree with current lesson highlighted, completion checks. Main: VideoPlayer (16:9, custom PlayerControls — play/pause, scrub bar with buffered, time, speed 0.5/1/1.25/1.5/2, captions toggle, settings, fullscreen, picture-in-picture). Below player: tabs (Notes / Transcript / Resources / Q&A). NextLessonCard sticky at bottom right + "Mark complete" button (animates check → auto-advances after 1.5s).
5. **/my-courses** — tabs (In Progress / Completed / Wishlist), each lists enrolled courses with progress bar, "Continue" jumps to last-watched lesson.
6. **/profile** — avatar, learning streak, total hours watched, certificates earned grid, settings.

Use a real \`<video>\` element with a placeholder MP4 URL like https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 — controls must be custom-built, not native browser controls.

Seed: 8 categories, 24 courses (each 5-8 sections × 4-7 lessons), 12 instructors, 6 reviews per course, 3 sample enrollments with varied progress.`,
};
