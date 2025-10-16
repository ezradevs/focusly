import type { SubjectOption, SubjectValue } from "@/types";

export const SUBJECT_VALUES = [
  "biology",
  "chemistry",
  "physics",
  "mathematics",
  "software-engineering",
  "english",
  "economics",
  "business-studies",
  "history",
  "custom",
] as const satisfies readonly SubjectValue[];

const SUBJECT_LABELS: Record<SubjectValue, string> = {
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  mathematics: "Mathematics",
  "software-engineering": "Software Engineering",
  english: "English",
  economics: "Economics",
  "business-studies": "Business Studies",
  history: "History",
  custom: "Custom Subject",
};

export const SUBJECT_OPTIONS: SubjectOption[] = SUBJECT_VALUES.map((value) => ({
  value,
  label: SUBJECT_LABELS[value],
}));

export const DEFAULT_SUBJECT = SUBJECT_OPTIONS[0];
