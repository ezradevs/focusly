"use client";

import { SUBJECT_OPTIONS } from "@/constants/subjects";
import type { SubjectValue } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubjectSelectProps {
  value: SubjectValue;
  onChange: (value: SubjectValue) => void;
  label?: string;
}

export function SubjectSelect({
  value,
  onChange,
  label = "Subject",
}: SubjectSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as SubjectValue)}>
        <SelectTrigger>
          <SelectValue placeholder="Select subject" />
        </SelectTrigger>
        <SelectContent>
          {SUBJECT_OPTIONS.map((subject) => (
            <SelectItem key={subject.value} value={subject.value}>
              {subject.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
