import { z } from "zod";

// ── Domain types ──

export interface Goal {
  id: string;
  name: string;
  description?: string;
  lifeAreaId?: string;
  lifeAreaName?: string;
  parentGoalId?: string;
  startDate?: string;
  deadline?: string;
  metricType?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  colorHex?: string;
  icon?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  isCompleted?: boolean;
  progress?: number;
  subgoals?: Goal[];
  taskCount?: number;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  priority?: string;
  scheduledDate?: string;
  startTime?: string;
  duration?: number;
  deadline?: string;
  goalId?: string;
  goalName?: string;
  lifeAreaId?: string;
  parentTaskId?: string;
  isCompleted?: boolean;
  subtasks?: Task[];
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  targetPeriod?: string;
  targetCount?: number;
  schedulePeriod?: string;
  scheduleDays?: string[];
  startDate?: string;
  startTime?: string;
  duration?: number;
  priority?: string;
  icon?: string;
  goalId?: string;
  goalName?: string;
  lifeAreaId?: string;
  isArchived?: boolean;
  completedToday?: boolean;
  todayCount?: number;
}

export interface HabitOccurrence {
  habitId: string;
  date: string;
  status?: string;
}

export interface TodaySummary {
  date: string;
  tasks: Task[];
  habits: Habit[];
  completedTaskCount: number;
  totalTaskCount: number;
  completedHabitCount: number;
  totalHabitCount: number;
}

// ── Zod input schemas for MCP tools ──

// Goals
export const listGoalsSchema = z.object({
  lifeAreaId: z.string().optional().describe("Filter by life area ID"),
  includeArchived: z.boolean().optional().describe("Include archived goals"),
});

export const getGoalSchema = z.object({
  goalId: z.string().describe("The goal ID"),
});

export const createGoalSchema = z.object({
  name: z.string().describe("Goal name"),
  goalDescription: z.string().optional().describe("Goal description"),
  lifeAreaId: z.string().optional().describe("Life area to assign the goal to"),
  parentGoalId: z.string().optional().describe("Parent goal ID for subgoals"),
  startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
  deadline: z.string().optional().describe("Deadline (YYYY-MM-DD)"),
  metricType: z.string().optional().describe("Metric type for tracking progress"),
  targetValue: z.number().optional().describe("Target value for the metric"),
  unit: z.string().optional().describe("Unit for the metric"),
  colorHex: z.string().optional().describe("Color hex code"),
  icon: z.string().optional().describe("Icon identifier"),
  isFavorite: z.boolean().optional().describe("Mark as favorite"),
});

export const completeGoalSchema = z.object({
  goalId: z.string().describe("The goal ID to complete"),
});

export const getGoalProgressSchema = z.object({
  goalId: z.string().describe("The goal ID"),
});

// Tasks
export const listTasksSchema = z.object({
  filter: z
    .string()
    .describe(
      'Task filter: "today", "upcoming", "inbox", "all", or "completed"'
    ),
  goalId: z.string().optional().describe("Filter by goal ID"),
  tagId: z.string().optional().describe("Filter by tag ID"),
});

export const createTaskSchema = z.object({
  name: z.string().describe("Task name"),
  taskDescription: z.string().optional().describe("Task description"),
  priority: z.string().optional().describe("Priority: High, Medium, or Low"),
  scheduledDate: z.string().optional().describe("Scheduled date (YYYY-MM-DD)"),
  startTime: z.string().optional().describe("Start time (HH:MM)"),
  duration: z.number().optional().describe("Duration in minutes"),
  deadline: z.string().optional().describe("Deadline (YYYY-MM-DD)"),
  goalId: z.string().optional().describe("Link to a goal by ID"),
  lifeAreaId: z.string().optional().describe("Link to a life area by ID"),
  parentTaskId: z.string().optional().describe("Parent task ID for subtasks"),
});

export const completeTaskSchema = z.object({
  taskId: z.string().describe("The task ID to complete"),
});

export const deleteTaskSchema = z.object({
  taskId: z.string().describe("The task ID to delete"),
});

// Habits
export const listHabitsSchema = z.object({});

export const addHabitOccurrenceSchema = z.object({
  habitId: z.string().describe("The habit ID"),
  date: z.string().optional().describe("Date for the occurrence (YYYY-MM-DD), defaults to today"),
  status: z.string().optional().describe("Occurrence status"),
});

// Summary
export const getTodaySummarySchema = z.object({
  timezone: z.string().optional().describe("Timezone for today calculation"),
});
