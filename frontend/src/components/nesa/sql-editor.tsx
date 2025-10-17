"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, RotateCcw, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

interface Database {
  run: (sql: string) => void;
  exec: (sql: string) => Array<{
    columns: string[];
    values: unknown[][];
  }>;
  close: () => void;
}

interface SQLEditorProps {
  initialQuery?: string;
  sampleData?: {
    tableName: string;
    columns: string[];
    rows: string[][];
  }[];
  expectedOutput?: string;
  readOnly?: boolean;
  onQueryChange?: (query: string) => void;
}

export function SQLEditor({
  initialQuery = "",
  sampleData = [],
  expectedOutput,
  readOnly = false,
  onQueryChange,
}: SQLEditorProps) {
  const [query, setQuery] = useState(initialQuery);
  const [output, setOutput] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [sqlReady, setSqlReady] = useState(false);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    async function loadSQL() {
      try {
        // Check if sql.js is already loaded
        // @ts-expect-error - initSqlJs is loaded from CDN script
        if (!window.initSqlJs) {
          // Load sql.js from CDN to avoid Node.js module issues
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";
          script.crossOrigin = "anonymous";

          await new Promise<void>((resolve, reject) => {
            script.onload = () => {
              resolve();
            };
            script.onerror = () => {
              reject(new Error("Failed to load sql.js"));
            };
            document.head.appendChild(script);
          });

          // Give the script time to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // @ts-expect-error - initSqlJs is loaded from CDN script
        const initSqlJs = window.initSqlJs;
        if (!initSqlJs) {
          throw new Error("initSqlJs not available after loading script");
        }

        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
        });

        const db = new SQL.Database();

        // Create sample tables if provided
        if (sampleData.length > 0) {
          for (const table of sampleData) {
            const columnDefs = table.columns.map((col) => `${col} TEXT`).join(", ");
            db.run(`CREATE TABLE ${table.tableName} (${columnDefs})`);

            for (const row of table.rows) {
              const values = row.map((val) => `'${val}'`).join(", ");
              db.run(`INSERT INTO ${table.tableName} VALUES (${values})`);
            }
          }
        } else {
          // Default sample students table
          db.run(`
            CREATE TABLE students (
              student_id INTEGER PRIMARY KEY,
              name TEXT,
              grade INTEGER
            )
          `);
          db.run(`INSERT INTO students VALUES (1, 'Alice Johnson', 85)`);
          db.run(`INSERT INTO students VALUES (2, 'Bob Smith', 92)`);
          db.run(`INSERT INTO students VALUES (3, 'Carol Davis', 78)`);
          db.run(`INSERT INTO students VALUES (4, 'David Wilson', 95)`);
          db.run(`INSERT INTO students VALUES (5, 'Eve Martinez', 88)`);
        }

        dbRef.current = db;
        setSqlReady(true);
      } catch (error) {
        toast.error("Failed to initialize SQL environment");
      }
    }

    loadSQL();

    return () => {
      if (dbRef.current) {
        dbRef.current.close();
      }
    };
  }, [sampleData]);

  const runQuery = () => {
    if (!sqlReady || !dbRef.current) {
      toast.error("SQL environment not ready");
      return;
    }

    setIsRunning(true);
    setOutput(null);
    setError("");

    try {
      const results = dbRef.current.exec(query);

      if (results.length === 0) {
        setOutput([]);
        setError("Query executed successfully (no results returned)");
      } else {
        const formattedResults = results[0].values.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          results[0].columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
          });
          return obj;
        });
        setOutput(formattedResults);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`SQL Error: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetQuery = () => {
    setQuery(initialQuery);
    setOutput(null);
    setError("");
    onQueryChange?.(initialQuery);
  };

  const handleEditorChange = (value: string | undefined) => {
    const newQuery = value || "";
    setQuery(newQuery);
    onQueryChange?.(newQuery);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              SQL Query Editor
            </span>
            <div className="flex items-center gap-2">
              {!sqlReady && (
                <span className="text-sm font-normal text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  Loading SQL...
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={resetQuery}
                disabled={readOnly || isRunning}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={runQuery}
                disabled={!sqlReady || isRunning || readOnly}
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1" />
                )}
                Run Query
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Editor
              height="200px"
              language="sql"
              value={query}
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

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {output && output.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Query Results ({output.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    {Object.keys(output[0]).map((col) => (
                      <th key={col} className="px-4 py-2 text-left font-semibold bg-muted">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {output.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      {Object.values(row).map((val: unknown, colIdx) => (
                        <td key={colIdx} className="px-4 py-2">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
