"use client";

import { useState, useRef } from "react";
import { ReactSketchCanvas, type ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Eraser,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

interface DiagramCanvasProps {
  diagramType?: string;
  expectedOutput?: string;
  onDiagramChange?: (imageData: string) => void;
}

export function DiagramCanvas({
  diagramType = "Structure Chart",
  expectedOutput,
  onDiagramChange,
}: DiagramCanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [eraserWidth, setEraserWidth] = useState(10);

  const handleUndo = () => {
    canvasRef.current?.undo();
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
  };

  const handleClear = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleEraserToggle = () => {
    canvasRef.current?.eraseMode(true);
  };

  const handlePenToggle = () => {
    canvasRef.current?.eraseMode(false);
  };

  const handleExportPNG = async () => {
    try {
      const imageData = await canvasRef.current?.exportImage("png");
      if (imageData) {
        const link = document.createElement("a");
        link.href = imageData;
        link.download = `${diagramType.replace(/\s+/g, "_")}_diagram.png`;
        link.click();
        toast.success("Diagram exported as PNG");
        onDiagramChange?.(imageData);
      }
    } catch (error) {
      toast.error("Failed to export diagram");
    }
  };

  const handleExportSVG = async () => {
    try {
      const svgData = await canvasRef.current?.exportSvg();
      if (svgData) {
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${diagramType.replace(/\s+/g, "_")}_diagram.svg`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Diagram exported as SVG");
      }
    } catch (error) {
      toast.error("Failed to export diagram");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Draw {diagramType}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePenToggle}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Pen
              </Button>
              <Button size="sm" variant="outline" onClick={handleEraserToggle}>
                <Eraser className="h-3.5 w-3.5 mr-1" />
                Eraser
              </Button>
              <Button size="sm" variant="outline" onClick={handleUndo}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleRedo}>
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stroke Width: {strokeWidth}px</Label>
              <Slider
                value={[strokeWidth]}
                onValueChange={(val) => setStrokeWidth(val[0])}
                min={1}
                max={20}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Stroke Color</Label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-10 w-full rounded-md border cursor-pointer"
              />
            </div>
          </div>

          <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
            <ReactSketchCanvas
              ref={canvasRef}
              strokeWidth={strokeWidth}
              strokeColor={strokeColor}
              eraserWidth={eraserWidth}
              canvasColor="#ffffff"
              style={{
                border: "none",
                width: "100%",
                height: "500px",
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExportPNG} variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export PNG
            </Button>
            <Button onClick={handleExportSVG} variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export SVG
            </Button>
          </div>
        </CardContent>
      </Card>

      {expectedOutput && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
              {expectedOutput}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Diagram Guidelines for {diagramType}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {diagramType.toLowerCase().includes("structure") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Use rectangles for modules/functions</li>
              <li>Draw lines with arrows to show hierarchy (parent to child)</li>
              <li>Label data flow with parameter names</li>
              <li>Show control flow with dashed lines</li>
              <li>Main module at the top, subordinates below</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("data flow") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Use circles for processes</li>
              <li>Use rectangles for external entities</li>
              <li>Use parallel lines for data stores</li>
              <li>Use arrows to show data flow direction</li>
              <li>Label all flows with data names</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("class") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Draw rectangles divided into three sections</li>
              <li>Top: Class name</li>
              <li>Middle: Attributes/properties</li>
              <li>Bottom: Methods/operations</li>
              <li>Use arrows to show relationships</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("decision") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Use rectangles for actions</li>
              <li>Use diamonds for decision points</li>
              <li>Draw branches from decisions (Yes/No)</li>
              <li>Show the flow from top to bottom</li>
              <li>Label all paths clearly</li>
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
