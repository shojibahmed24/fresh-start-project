// Template registry — aggregates all per-template definitions.
// Each template lives in its own file so this list stays small and
// individual modules can be edited / token-loaded independently.

import type { Template } from "./types";
import { ecommerceTemplate } from "./ecommerce";
import { chatTemplate } from "./chat";
import { socialTemplate } from "./social";
import { todoTemplate } from "./todo";
import { fitnessTemplate } from "./fitness";
import { foodTemplate } from "./food";
import { blogTemplate } from "./blog";
import { bookingTemplate } from "./booking";
import { adminDashboardTemplate } from "./adminDashboard";
import { saasLandingTemplate } from "./saasLanding";
import { portfolioTemplate } from "./portfolio";
import { aiChatTemplate } from "./aiChat";
import { restaurantTemplate } from "./restaurant";
import { eventTemplate } from "./event";
import { courseTemplate } from "./course";
import { directoryTemplate } from "./directory";
import { jobBoardTemplate } from "./jobBoard";
import { socialFeedTemplate } from "./socialFeed";
import { crmTemplate } from "./crm";

export type { Template } from "./types";

export const TEMPLATES: Template[] = [
  ecommerceTemplate,
  chatTemplate,
  socialTemplate,
  todoTemplate,
  fitnessTemplate,
  foodTemplate,
  blogTemplate,
  bookingTemplate,
  adminDashboardTemplate,
  saasLandingTemplate,
  portfolioTemplate,
  aiChatTemplate,
  restaurantTemplate,
  eventTemplate,
  courseTemplate,
  directoryTemplate,
  jobBoardTemplate,
  socialFeedTemplate,
  crmTemplate,
];
