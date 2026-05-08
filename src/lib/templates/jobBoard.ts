import type { Template } from "./types";

export const jobBoardTemplate: Template = {
  id: "job-board",
  emoji: "💼",
  name: "Job Board",
  tagline: "Listings, filters & apply",
  gradient: "from-blue-600 to-cyan-500",
  defaultName: "My Job Board",
  defaultDescription: "Job board with listings, filters, company profiles and apply flow.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST job board (think We Work Remotely × LinkedIn Jobs × Wellfound). Requirements:
- react-router-dom routes: /, /jobs, /job/:id, /company/:slug, /apply/:jobId, /post-job, /my-applications, /saved.
- Custom design system in index.css + tailwind.config.ts (HSL tokens, professional but warm — single bold accent, light mode primary + dark toggle). framer-motion for filter slide, save burst, apply success confetti, page transitions. shadcn/ui + lucide-react + tailwind only.
- Every search, filter, sort, save toggle (heart with count + persisted), pagination, apply form (multi-step react-hook-form + zod), theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines (target 150-220).
- \`src/components/jobs/\`: SiteNav, HeroSearch, QuickFilterChips, FeaturedCompanies, JobsHero, FiltersPanel, FilterSection, SortBar, JobCard, JobsList, JobDetailHeader, JobDescriptionTabs, CompanySidebar, RelatedJobs, ApplyStepIntro, ApplyStepResume, ApplyStepQuestions, ApplyStepReview, MyAppCard, SiteFooter.
- \`src/pages/Jobs.tsx\` < 130 lines (filters + list + sticky preview).
- \`src/store/jobsStore.ts\` (zustand + persist) — savedIds, applications[{jobId, status, appliedAt, answers}], toggleSave, addApplication, withdrawApplication.
- \`src/data/{jobs,companies}.ts\`.

Pages:
1. **/** — SiteNav (logo, Jobs / Companies / Post a job links, theme toggle, sign in + "Post a job" gradient CTA); HeroSearch (massive search row: keyword input + location input with autocomplete + role-type select + Search button); QuickFilterChips (Remote, Full-time, Senior, Engineering, Design, Marketing); FeaturedCompanies (8 company logo tiles with open role count); recent jobs preview list; stats strip ("2400+ jobs · 800+ companies · 50+ countries"); newsletter CTA; footer.
2. **/jobs** — left FiltersPanel (sticky, collapsible): FilterSection groups (Job type checklist Full-time/Part-time/Contract/Internship, Experience level chips, Remote switch, Salary range slider USD, Posted within radio Today/Week/Month, Visa sponsorship switch, Tech tags multi-select). Top SortBar (count + sort: Most relevant / Newest / Salary high→low). Two-column: JobsList (JobCards: company logo, title, company name, location + remote badge, salary range, type chip, posted ago, tag chips, save heart toggle) + sticky right preview pane showing selected job summary with "Apply" CTA.
3. **/job/:id** — JobDetailHeader (company logo, title, company link, location, salary, posted date, save + share buttons, "Apply now" sticky CTA). JobDescriptionTabs (Overview / Responsibilities / Requirements / Benefits / About company). CompanySidebar (sticky right): logo, name, size, industry, founded, website, "View all jobs" link, perks chips. RelatedJobs row at bottom.
4. **/apply/:jobId** — 4-step wizard: Step 1 ApplyStepIntro (job summary recap + why you'll love it); Step 2 ApplyStepResume (upload CV drag-and-drop + parsed name/email/phone editable + LinkedIn URL); Step 3 ApplyStepQuestions (3-5 role-specific textareas + cover letter rich textarea); Step 4 ApplyStepReview (read-only summary + EEO optional questions + Submit → confetti success screen with application id + "View my applications" CTA).
5. **/company/:slug** — company hero (cover + logo + name + tagline + size/industry/HQ + "Follow" toggle), about, perks grid, team photos row, open roles list, "Glassdoor-style" rating + reviews.
6. **/post-job** — employer multi-step form (company info → role details → screening questions → preview → publish, saves to localStorage).
7. **/my-applications** — tabs (Active / Interview / Offer / Rejected / Withdrawn), MyAppCards with status timeline + withdraw action.
8. **/saved** — grid of saved JobCards with "Apply" quick action.

Seed: 60 jobs across 12 categories with varied salaries/types/locations, 30 companies with logos via dicebear + cover images via picsum, 3 sample applications in different statuses.`,
};
