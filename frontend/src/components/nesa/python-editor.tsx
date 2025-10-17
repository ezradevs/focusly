"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<string>;
}

interface PythonEditorProps {
  initialCode?: string;
  expectedOutput?: string;
  readOnly?: boolean;
  onCodeChange?: (code: string) => void;
}

export function PythonEditor({
  initialCode = "",
  expectedOutput,
  readOnly = false,
  onCodeChange,
}: PythonEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);

  useEffect(() => {
    async function loadPyodide() {
      try {
        // @ts-expect-error - loadPyodide is loaded from CDN script
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
        });
        pyodideRef.current = pyodide;
        setPyodideReady(true);
      } catch (error) {
        toast.error("Failed to initialize Python environment");
      }
    }

    loadPyodide();
  }, []);

  const runCode = async () => {
    if (!pyodideReady || !pyodideRef.current) {
      toast.error("Python environment not ready");
      return;
    }

    setIsRunning(true);
    setOutput("");

    try {
      // Redirect stdout to capture print statements
      await pyodideRef.current.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
      `);

      // Run the user's code
      await pyodideRef.current.runPythonAsync(code);

      // Get the captured output
      const result = await pyodideRef.current.runPythonAsync(`
sys.stdout.getvalue()
      `);

      setOutput(result || "Code executed successfully (no output)");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOutput(`Error: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    setCode(initialCode);
    setOutput("");
    onCodeChange?.(initialCode);
  };

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Python Code Editor</span>
            <div className="flex items-center gap-2">
              {!pyodideReady && (
                <span className="text-sm font-normal text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  Loading Python...
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={resetCode}
                disabled={readOnly || isRunning}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={runCode}
                disabled={!pyodideReady || isRunning || readOnly}
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1" />
                )}
                Run Code
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Editor
              height="300px"
              language="python"
              value={code}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                readOnly,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm font-mono whitespace-pre-wrap">
              {output}
            </pre>
          </CardContent>
        </Card>
      )}

      {expectedOutput && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
              Expected Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
              {expectedOutput}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
