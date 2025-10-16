"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ListTodo,
  X,
} from "lucide-react";
import { useTaskStore } from "@/store/tasks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TaskList() {
  const { tasks, addTask, toggleTask, deleteTask, clearCompleted } =
    useTaskStore();
  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    addTask(newTaskText.trim());
    setNewTaskText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTask();
    }
  };

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Today&apos;s Tasks</CardTitle>
          </div>
          {completedTasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              className="h-8 text-xs"
            >
              Clear completed
            </Button>
          )}
        </div>
        <CardDescription>
          Keep track of your study goals for today
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add task input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a new task..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={handleAddTask}
              disabled={!newTaskText.trim()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Task stats */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {activeTasks.length} active
            </Badge>
            <Badge variant="outline">
              {completedTasks.length} completed
            </Badge>
          </div>

          {/* Task list */}
          <ScrollArea className="h-[280px] pr-4">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ListTodo className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-sm font-medium">No tasks yet</h3>
                <p className="text-xs text-muted-foreground">
                  Add your first task to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {/* Active tasks first */}
                  {activeTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      <TaskItem
                        task={task}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                      />
                    </motion.div>
                  ))}
                  {/* Completed tasks */}
                  {completedTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      <TaskItem
                        task={task}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskItemProps {
  task: {
    id: string;
    text: string;
    completed: boolean;
  };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:bg-muted/50",
        task.completed && "opacity-60"
      )}
    >
      <button
        onClick={() => onToggle(task.id)}
        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      >
        {task.completed ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <p
        className={cn(
          "flex-1 text-sm leading-relaxed",
          task.completed && "line-through"
        )}
      >
        {task.text}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
