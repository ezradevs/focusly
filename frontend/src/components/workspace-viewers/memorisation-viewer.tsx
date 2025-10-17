import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookMarked,
  Brain,
  Lightbulb,
  ScrollText,
  Target,
} from "lucide-react";

import type {
  EssayCoachResponse,
  MemorisationResult,
  MnemonicResponse,
  RecallDrillResponse,
} from "@/types";

export function MnemonicResultView({ result }: { result: MnemonicResponse }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {result.mnemonics.map((mnemonic) => (
          <Card key={mnemonic.title} className="h-full border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{mnemonic.title}</CardTitle>
                <Badge variant="secondary" className="capitalize">
                  {mnemonic.type}
                </Badge>
              </div>
              <CardDescription>{mnemonic.mnemonic}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Why it works</p>
                <p className="text-sm leading-relaxed">{mnemonic.explanation}</p>
              </div>
              {mnemonic.usageTips?.length ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Usage tips</p>
                  <ul className="space-y-1 text-sm">
                    {mnemonic.usageTips.map((tip) => (
                      <li key={tip} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {(result.recallStrategies?.length || result.spacedRepetitionAdvice?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-4 w-4" />
              Retention guidance
            </CardTitle>
            <CardDescription>
              Reinforce your mnemonic devices with strategic recall habits.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {result.recallStrategies?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Active recall ideas</h4>
                <ul className="space-y-1 text-sm">
                  {result.recallStrategies.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.spacedRepetitionAdvice?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Spaced repetition</h4>
                <ul className="space-y-1 text-sm">
                  {result.spacedRepetitionAdvice.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function EssayCoachResultView({ result }: { result: EssayCoachResponse }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-4 w-4" />
            Section breakdown
          </CardTitle>
          <CardDescription>
            Convert dense paragraphs into memorable chunks with cues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.sections.map((section) => (
            <div key={section.heading} className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base font-semibold">{section.heading}</h4>
                <Badge variant="outline">Recall cue set</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {section.summary}
              </p>
              {section.keyQuotes?.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Anchor quotes / evidence
                  </p>
                  <ul className="space-y-1 text-sm italic">
                    {section.keyQuotes.map((quote) => (
                      <li key={quote}>&ldquo;{quote}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recall cues
                </p>
                <ul className="space-y-1 text-sm">
                  {section.recallCues.map((cue) => (
                    <li key={cue} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {section.checkUnderstanding?.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Self-check prompts
                  </p>
                  <ul className="space-y-1 text-sm">
                    {section.checkUnderstanding.map((prompt) => (
                      <li key={prompt} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{prompt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-4 w-4" />
            Rehearsal schedule
          </CardTitle>
          <CardDescription>
            Follow a spaced plan to commit your essay to long-term memory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {result.rehearsalPlan.map((item) => (
              <div key={item.day} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold">{item.day}</h4>
                  <Badge variant="outline">{item.focus}</Badge>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {item.activities.map((activity) => (
                    <li key={activity} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {(result.activeRecallPrompts?.length || result.examTips?.length) && <Separator />}
          <div className="grid gap-4 md:grid-cols-2">
            {result.activeRecallPrompts?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Active recall prompts</h4>
                <ul className="space-y-1 text-sm">
                  {result.activeRecallPrompts.map((prompt) => (
                    <li key={prompt} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{prompt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.examTips?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Exam execution tips</h4>
                <ul className="space-y-1 text-sm">
                  {result.examTips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecallDrillResultView({ result }: { result: RecallDrillResponse }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-4 w-4" />
            Active recall drills
          </CardTitle>
          <CardDescription>
            Work through each prompt, then check hints and follow-up reflections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.drills.map((drill, index) => (
            <div key={`${drill.prompt}-${index}`} className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Prompt {index + 1}</h4>
                {drill.difficulty ? <Badge variant="outline">{drill.difficulty}</Badge> : null}
              </div>
              <p className="mt-2 text-sm font-medium">{drill.prompt}</p>
              <div className="mt-3 rounded-md bg-background p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ideal answer
                </p>
                <p className="text-sm leading-relaxed">{drill.idealAnswer}</p>
              </div>
              {drill.hint ? (
                <p className="mt-2 text-sm text-muted-foreground">Hint: {drill.hint}</p>
              ) : null}
              {drill.followUp ? (
                <p className="mt-2 text-sm text-muted-foreground">Reflection: {drill.followUp}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {(result.confidenceChecks?.length || result.spacingReminders?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookMarked className="h-4 w-4" />
              Consolidation tips
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {result.confidenceChecks?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Confidence checks</h4>
                <ul className="space-y-1 text-sm">
                  {result.confidenceChecks.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.spacingReminders?.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Spacing reminders</h4>
                <ul className="space-y-1 text-sm">
                  {result.spacingReminders.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MemorisationViewer({ data }: { data: MemorisationResult }) {
  switch (data.tool) {
    case "mnemonic":
      return <MnemonicResultView result={data.result} />;
    case "essay-coach":
      return <EssayCoachResultView result={data.result} />;
    case "recall-drills":
      return <RecallDrillResultView result={data.result} />;
    default:
      return null;
  }
}
