"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  Calendar,
  LineChart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/auth";
import { focuslyApi } from "@/lib/api";
import { MODULES, MODULE_TYPE_MAP } from "@/constants/modules";
import type { ModuleOutputRecord } from "@/types";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { formatSubject } from "@/lib/utils";
import { PomodoroTimer } from "@/components/dashboard/pomodoro-timer";
import { TaskList } from "@/components/dashboard/task-list";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [greeting, setGreeting] = useState("Hello");

  const { data: outputsData, isLoading } = useQuery({
    queryKey: ["outputs"],
    queryFn: () => focuslyApi.listOutputs({ limit: 10 }),
    enabled: status === "authenticated",
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const outputs = outputsData?.outputs || [];
  const stats = calculateStats(outputs);

  return (
    <DashboardShell showNavigation={true}>
      <div className="space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {greeting}
                {user && status === "authenticated" && (
                  <span className="text-primary">
                    , {user.name || user.email.split("@")[0]}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground">
                Ready to make today count? Let&apos;s study smarter.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        {status === "authenticated" && outputs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <StatCard
              title="Total Outputs"
              value={stats.totalOutputs}
              icon={BookOpen}
              trend={stats.weekTrend}
            />
            <StatCard
              title="Quiz Accuracy"
              value={`${stats.quizAccuracy}%`}
              icon={TrendingUp}
              trend="Keep it up!"
            />
            <StatCard
              title="Study Streak"
              value={`${stats.streak} days`}
              icon={Calendar}
              trend="Personal best!"
            />
            <StatCard
              title="Active Subjects"
              value={stats.subjects}
              icon={Brain}
              trend={`${stats.recentSubject} most recent`}
            />
          </motion.div>
        )}

        {/* Pomodoro Timer & Task List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid gap-6 md:grid-cols-2"
        >
          <PomodoroTimer />
          <TaskList />
        </motion.div>

        {/* Recent Activity */}
        {status === "authenticated" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Recent Activity</CardTitle>
                    <CardDescription>Your latest study sessions</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/workspace">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : outputs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mb-2 text-lg font-medium">No activity yet</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Start using Focusly modules to see your recent work here
                    </p>
                    <Link href="/workspace">
                      <Button>Get Started</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outputs.slice(0, 5).map((output, index) => (
                      <motion.div
                        key={output.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        <RecentActivityItem output={output} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* CTA for Non-Authenticated Users */}
        {status === "unauthenticated" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LineChart className="h-5 w-5" />
                  Track Your Progress
                </CardTitle>
                <CardDescription>
                  Sign in to save your work, track your study analytics, and access your content
                  from any device.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/workspace">
                  <Button size="lg">
                    Start Studying Now
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}

function RecentActivityItem({ output }: { output: ModuleOutputRecord }) {
  const moduleId = MODULE_TYPE_MAP[output.module];
  const moduleConfig = MODULES.find((m) => m.id === moduleId);
  const Icon = moduleConfig?.icon || BookOpen;
  const formattedDate = new Date(output.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${
          moduleConfig?.accent || "from-gray-400 to-gray-600"
        } text-white shadow-sm`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium leading-none">
            {output.label || moduleConfig?.label || "Untitled"}
          </p>
          {output.subject && (
            <Badge variant="secondary" className="text-xs">
              {formatSubject(output.subject)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>
    </div>
  );
}

function calculateStats(outputs: ModuleOutputRecord[]) {
  const now = new Date();
  const totalOutputs = outputs.length;
  const subjects = new Set(outputs.map((o) => o.subject).filter(Boolean)).size;
  const recentSubject = outputs[0]?.subject || "None";

  // Calculate week-over-week growth
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeekOutputs = outputs.filter(o => new Date(o.createdAt) >= oneWeekAgo).length;
  const lastWeekOutputs = outputs.filter(o => {
    const date = new Date(o.createdAt);
    return date >= twoWeeksAgo && date < oneWeekAgo;
  }).length;

  let weekTrend = "";
  if (lastWeekOutputs === 0 && thisWeekOutputs > 0) {
    weekTrend = "New this week!";
  } else if (lastWeekOutputs > 0) {
    const percentChange = Math.round(((thisWeekOutputs - lastWeekOutputs) / lastWeekOutputs) * 100);
    if (percentChange > 0) {
      weekTrend = `+${percentChange}% this week`;
    } else if (percentChange < 0) {
      weekTrend = `${percentChange}% this week`;
    } else {
      weekTrend = "Same as last week";
    }
  } else {
    weekTrend = "Start creating!";
  }

  // Calculate quiz accuracy from quiz sessions (fixed)
  const quizOutputs = outputs.filter((o) => o.module === "QUIZ_SESSION");
  let totalQuestions = 0;
  let correctAnswers = 0;

  quizOutputs.forEach((output) => {
    const session = output.output as { attempts?: Array<{ isCorrect?: boolean }> };
    if (session?.attempts && Array.isArray(session.attempts)) {
      session.attempts.forEach((attempt) => {
        totalQuestions++;
        if (attempt.isCorrect) correctAnswers++;
      });
    }
  });

  const quizAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // Calculate streak (consecutive days with activity)
  const sortedDates = outputs
    .map((o) => new Date(o.createdAt))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  let currentDate = new Date(now.setHours(0, 0, 0, 0));

  if (sortedDates.length > 0) {
    const uniqueDates = [...new Set(sortedDates.map(d => d.toDateString()))];

    for (let i = 0; i < uniqueDates.length; i++) {
      const dateStr = new Date(currentDate).toDateString();
      if (uniqueDates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    totalOutputs,
    subjects,
    recentSubject,
    quizAccuracy,
    streak,
    weekTrend,
  };
}
