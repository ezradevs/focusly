"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  Timer,
} from "lucide-react";
import { usePomodoroStore } from "@/store/pomodoro";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PomodoroTimer() {
  const {
    phase,
    isRunning,
    timeRemaining,
    sessionsCompleted,
    settings,
    start,
    pause,
    reset,
    skip,
    tick,
    setPhase,
    updateSettings,
  } = usePomodoroStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  // Notification on phase complete
  useEffect(() => {
    if (timeRemaining === 0 && !isRunning) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Focusly Timer", {
          body: phase === "work" ? "Time for a break!" : "Time to focus!",
        });
      }
    }
  }, [timeRemaining, isRunning, phase]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const progress =
    (timeRemaining /
      ((phase === "work"
        ? settings.workDuration
        : phase === "shortBreak"
        ? settings.shortBreakDuration
        : settings.longBreakDuration) *
        60)) *
    100;

  const phaseLabels = {
    work: "Focus Time",
    shortBreak: "Short Break",
    longBreak: "Long Break",
  };

  const phaseColors = {
    work: "from-rose-500 to-orange-500",
    shortBreak: "from-blue-500 to-cyan-500",
    longBreak: "from-purple-500 to-pink-500",
  };

  const handleSaveSettings = () => {
    updateSettings(tempSettings);
    setSettingsOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Pomodoro Timer</CardTitle>
          </div>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Timer Settings</DialogTitle>
                <DialogDescription>
                  Customize your Pomodoro timer durations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="work">Focus Duration (minutes)</Label>
                  <Input
                    id="work"
                    type="number"
                    min={1}
                    max={60}
                    value={tempSettings.workDuration}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        workDuration: parseInt(e.target.value) || 25,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="short">Short Break (minutes)</Label>
                  <Input
                    id="short"
                    type="number"
                    min={1}
                    max={30}
                    value={tempSettings.shortBreakDuration}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        shortBreakDuration: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="long">Long Break (minutes)</Label>
                  <Input
                    id="long"
                    type="number"
                    min={1}
                    max={60}
                    value={tempSettings.longBreakDuration}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        longBreakDuration: parseInt(e.target.value) || 15,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">Long Break Interval</Label>
                  <Input
                    id="interval"
                    type="number"
                    min={1}
                    max={10}
                    value={tempSettings.longBreakInterval}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        longBreakInterval: parseInt(e.target.value) || 4,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    After how many focus sessions to take a long break
                  </p>
                </div>
                <Button onClick={handleSaveSettings} className="w-full">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Stay focused with the Pomodoro technique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Phase selector */}
          <div className="flex gap-2">
            <Button
              variant={phase === "work" ? "default" : "outline"}
              size="sm"
              onClick={() => setPhase("work")}
              disabled={isRunning}
              className="flex-1"
            >
              Focus
            </Button>
            <Button
              variant={phase === "shortBreak" ? "default" : "outline"}
              size="sm"
              onClick={() => setPhase("shortBreak")}
              disabled={isRunning}
              className="flex-1"
            >
              Short Break
            </Button>
            <Button
              variant={phase === "longBreak" ? "default" : "outline"}
              size="sm"
              onClick={() => setPhase("longBreak")}
              disabled={isRunning}
              className="flex-1"
            >
              Long Break
            </Button>
          </div>

          {/* Timer display */}
          <div className="relative">
            {/* Progress ring */}
            <div className="relative mx-auto h-48 w-48">
              <svg className="h-full w-full -rotate-90 transform">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <motion.circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  initial={false}
                  animate={{
                    strokeDashoffset: 553.28 - (553.28 * progress) / 100,
                  }}
                  transition={{ duration: 0.5 }}
                  style={{
                    strokeDasharray: 553.28,
                  }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" className={cn("stop-rose-500", phase === "work" && "stop-rose-500", phase === "shortBreak" && "stop-blue-500", phase === "longBreak" && "stop-purple-500")} />
                    <stop offset="100%" className={cn("stop-orange-500", phase === "work" && "stop-orange-500", phase === "shortBreak" && "stop-cyan-500", phase === "longBreak" && "stop-pink-500")} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Badge variant="outline" className="mb-2">
                  {phaseLabels[phase]}
                </Badge>
                <div className="text-5xl font-bold tabular-nums">
                  {String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={reset}
              disabled={isRunning}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              onClick={isRunning ? pause : start}
              className={cn(
                "gap-2 bg-gradient-to-r text-white",
                phaseColors[phase]
              )}
            >
              {isRunning ? (
                <>
                  <Pause className="h-5 w-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Start
                </>
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={skip}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Session counter */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Sessions completed: <span className="font-semibold">{sessionsCompleted}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
