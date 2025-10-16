"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Moon, Sun, Laptop, Trash2, Download, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { usePomodoroStore } from "@/store/pomodoro";
import { useTaskStore } from "@/store/tasks";
import { useQuizStore } from "@/store/quiz";
import { useExamStore } from "@/store/exam";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [mounted, setMounted] = useState(false);

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pomodoroNotifications, setPomodoroNotifications] = useState(true);
  const [quizReminders, setQuizReminders] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if notifications are enabled
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleEnableNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      if (permission === "granted") {
        toast.success("Notifications enabled");
      } else {
        toast.error("Notifications permission denied");
      }
    }
  };

  const handleClearAllData = () => {
    if (confirm("Are you sure? This will clear all local data including tasks, timer sessions, and preferences.")) {
      localStorage.clear();
      toast.success("All local data cleared");
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const data = {
      pomodoro: localStorage.getItem("focusly-pomodoro"),
      tasks: localStorage.getItem("focusly-tasks"),
      quiz: localStorage.getItem("focusly-quiz-history"),
      exam: localStorage.getItem("focusly-exam-history"),
      preferences: localStorage.getItem("focusly-preferences"),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `focusly-data-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  if (!mounted) {
    return null;
  }

  return (
    <DashboardShell showNavigation={true}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
              <SettingsIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground">
                Customize your app experience and manage your data
              </p>
            </div>
          </div>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how Focusly looks on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Control when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow Focusly to send you browser notifications
                  </p>
                </div>
                {notificationsEnabled ? (
                  <Switch checked disabled />
                ) : (
                  <Button onClick={handleEnableNotifications} size="sm">
                    Enable
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pomodoro-notif">Pomodoro Timer</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when timer phases complete
                  </p>
                </div>
                <Switch
                  id="pomodoro-notif"
                  checked={pomodoroNotifications}
                  onCheckedChange={setPomodoroNotifications}
                  disabled={!notificationsEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiz-reminders">Study Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive reminders to complete pending quizzes
                  </p>
                </div>
                <Switch
                  id="quiz-reminders"
                  checked={quizReminders}
                  onCheckedChange={setQuizReminders}
                  disabled={!notificationsEnabled}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or clear your local application data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download all your tasks, sessions, and preferences
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clear All Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all local data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAllData}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* About */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Application information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Build</span>
                <span className="font-medium">2025.01</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
