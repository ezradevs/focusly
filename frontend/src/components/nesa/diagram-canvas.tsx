"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Arrow, Transformer } from "react-konva";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  MousePointer2,
  Pencil,
  Square,
  CircleDot,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

interface DiagramCanvasProps {
  diagramType?: string;
  expectedOutput?: string;
  onDiagramChange?: (imageData: string) => void;
}

type ToolType = "select" | "pen" | "rectangle" | "circle" | "line" | "arrow" | "text";

interface Shape {
  id: string;
  type: "rectangle" | "circle" | "line" | "arrow" | "text" | "freehand";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  fontSize?: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

export function DiagramCanvas({
  diagramType = "Structure Chart",
  expectedOutput,
  onDiagramChange,
}: DiagramCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [tool, setTool] = useState<ToolType>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

  // Style controls
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState("transparent");
  const [fontSize, setFontSize] = useState(16);

  // Add to history
  const addToHistory = useCallback((newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newShapes);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

  // Update shapes and history
  const updateShapes = useCallback((newShapes: Shape[]) => {
    setShapes(newShapes);
    addToHistory(newShapes);
  }, [addToHistory]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setShapes(history[historyStep - 1]);
    }
  }, [history, historyStep]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setShapes(history[historyStep + 1]);
    }
  }, [history, historyStep]);

  // Clear canvas
  const handleClear = () => {
    updateShapes([]);
    setSelectedId(null);
  };

  // Delete selected shape
  const handleDelete = useCallback(() => {
    if (selectedId) {
      const newShapes = shapes.filter(s => s.id !== selectedId);
      updateShapes(newShapes);
      setSelectedId(null);
    }
  }, [selectedId, shapes, updateShapes]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleDelete, selectedId]);

  // Mouse down handler
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "select") return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);

    const id = `shape-${Date.now()}`;
    let newShape: Shape;

    if (tool === "pen") {
      newShape = {
        id,
        type: "freehand",
        x: 0,
        y: 0,
        points: [pos.x, pos.y],
        stroke: strokeColor,
        strokeWidth,
      };
    } else if (tool === "text") {
      const text = prompt("Enter text:");
      if (!text) {
        setIsDrawing(false);
        return;
      }
      newShape = {
        id,
        type: "text",
        x: pos.x,
        y: pos.y,
        text,
        fontSize,
        stroke: strokeColor,
        strokeWidth: 0,
        fill: strokeColor,
      };
      setShapes([...shapes, newShape]);
      updateShapes([...shapes, newShape]);
      setIsDrawing(false);
      setTool("select");
      return;
    } else {
      newShape = {
        id,
        type: tool as "rectangle" | "circle" | "line" | "arrow",
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        radius: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor !== "transparent" ? fillColor : undefined,
      };
    }

    setCurrentShape(newShape);
  };

  // Mouse move handler
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !currentShape) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (currentShape.type === "freehand") {
      const newPoints = currentShape.points!.concat([pos.x, pos.y]);
      setCurrentShape({
        ...currentShape,
        points: newPoints,
      });
    } else if (currentShape.type === "rectangle") {
      const width = pos.x - currentShape.x;
      const height = pos.y - currentShape.y;
      setCurrentShape({
        ...currentShape,
        width,
        height,
      });
    } else if (currentShape.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(pos.x - currentShape.x, 2) + Math.pow(pos.y - currentShape.y, 2)
      );
      setCurrentShape({
        ...currentShape,
        radius,
      });
    } else if (currentShape.type === "line" || currentShape.type === "arrow") {
      setCurrentShape({
        ...currentShape,
        points: [currentShape.x, currentShape.y, pos.x, pos.y],
      });
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    if (!isDrawing || !currentShape) return;

    setIsDrawing(false);

    // Only add shape if it has some size (except text which is already added)
    if (currentShape.type === "freehand" && currentShape.points && currentShape.points.length > 2) {
      updateShapes([...shapes, currentShape]);
    } else if (currentShape.type === "rectangle" && (currentShape.width || currentShape.height)) {
      updateShapes([...shapes, currentShape]);
    } else if (currentShape.type === "circle" && currentShape.radius && currentShape.radius > 5) {
      updateShapes([...shapes, currentShape]);
    } else if ((currentShape.type === "line" || currentShape.type === "arrow") && currentShape.points && currentShape.points.length === 4) {
      updateShapes([...shapes, currentShape]);
    }

    setCurrentShape(null);
  };

  // Handle shape selection
  const handleShapeClick = (id: string) => {
    if (tool === "select") {
      setSelectedId(id);
    }
  };

  // Handle stage click
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current) return;

    const stage = transformerRef.current.getStage();
    if (!stage) return;

    if (selectedId) {
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
      }
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedId]);

  // Handle shape drag
  const handleShapeDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const newShapes = shapes.map(shape => {
      if (shape.id === id) {
        return {
          ...shape,
          x: e.target.x(),
          y: e.target.y(),
        };
      }
      return shape;
    });
    updateShapes(newShapes);
  };

  // Handle shape transform
  const handleShapeTransform = (id: string, node: Konva.Shape) => {
    const newShapes = shapes.map(shape => {
      if (shape.id === id) {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        // Reset scale
        node.scaleX(1);
        node.scaleY(1);

        return {
          ...shape,
          x: node.x(),
          y: node.y(),
          width: shape.width ? shape.width * scaleX : shape.width,
          height: shape.height ? shape.height * scaleY : shape.height,
          radius: shape.radius ? shape.radius * scaleX : shape.radius,
        };
      }
      return shape;
    });
    setShapes(newShapes);
  };

  const handleTransformEnd = () => {
    updateShapes(shapes);
  };

  // Export as PNG
  const handleExportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    try {
      const dataURL = stage.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `${diagramType.replace(/\s+/g, "_")}_diagram.png`;
      link.click();
      toast.success("Diagram exported as PNG");
      onDiagramChange?.(dataURL);
    } catch (error) {
      toast.error("Failed to export diagram");
    }
  };

  // Render shapes
  const renderShape = (shape: Shape) => {
    const commonProps = {
      id: shape.id,
      key: shape.id,
      draggable: tool === "select",
      onClick: () => handleShapeClick(shape.id),
      onTap: () => handleShapeClick(shape.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleShapeDragEnd(shape.id, e),
      onTransformEnd: handleTransformEnd,
    };

    switch (shape.type) {
      case "rectangle":
        return (
          <Rect
            {...commonProps}
            x={shape.x}
            y={shape.y}
            width={shape.width || 0}
            height={shape.height || 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill}
          />
        );
      case "circle":
        return (
          <Circle
            {...commonProps}
            x={shape.x}
            y={shape.y}
            radius={shape.radius || 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill}
          />
        );
      case "line":
        return (
          <Line
            {...commonProps}
            points={shape.points || []}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
          />
        );
      case "arrow":
        return (
          <Arrow
            {...commonProps}
            points={shape.points || []}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.stroke}
            pointerLength={10}
            pointerWidth={10}
          />
        );
      case "freehand":
        return (
          <Line
            {...commonProps}
            points={shape.points || []}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        );
      case "text":
        return (
          <KonvaText
            {...commonProps}
            x={shape.x}
            y={shape.y}
            text={shape.text || ""}
            fontSize={shape.fontSize || 16}
            fill={shape.fill}
            onTransform={(e) => {
              const node = e.target as Konva.Shape;
              handleShapeTransform(shape.id, node);
            }}
          />
        );
      default:
        return null;
    }
  };

  const tools = [
    { type: "select" as ToolType, icon: MousePointer2, label: "Select" },
    { type: "pen" as ToolType, icon: Pencil, label: "Draw" },
    { type: "rectangle" as ToolType, icon: Square, label: "Rectangle" },
    { type: "circle" as ToolType, icon: CircleDot, label: "Circle" },
    { type: "line" as ToolType, icon: Minus, label: "Line" },
    { type: "arrow" as ToolType, icon: ArrowRight, label: "Arrow" },
    { type: "text" as ToolType, icon: Type, label: "Text" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Draw {diagramType}</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                disabled={historyStep === 0}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRedo}
                disabled={historyStep === history.length - 1}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
            {tools.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                size="sm"
                variant={tool === type ? "default" : "outline"}
                onClick={() => setTool(type)}
                className="flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          {/* Style Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Stroke Color</Label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-10 w-full rounded-md border cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <Label>Fill Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={fillColor === "transparent" ? "#ffffff" : fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="h-10 w-full rounded-md border cursor-pointer"
                  disabled={fillColor === "transparent"}
                />
                <Button
                  size="sm"
                  variant={fillColor === "transparent" ? "default" : "outline"}
                  onClick={() => setFillColor(fillColor === "transparent" ? "#ffffff" : "transparent")}
                >
                  None
                </Button>
              </div>
            </div>
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
              <Label>Font Size: {fontSize}px</Label>
              <Slider
                value={[fontSize]}
                onValueChange={(val) => setFontSize(val[0])}
                min={10}
                max={48}
                step={2}
              />
            </div>
          </div>

          {/* Canvas */}
          <div className="border-2 border-dashed rounded-lg overflow-hidden bg-background">
            <Stage
              ref={stageRef}
              width={800}
              height={500}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleStageClick}
              onTap={handleStageClick}
              className="cursor-crosshair"
            >
              <Layer>
                {/* Render all shapes */}
                {shapes.map(renderShape)}

                {/* Render current shape being drawn */}
                {currentShape && renderShape(currentShape)}

                {/* Transformer for selected shape */}
                {tool === "select" && <Transformer ref={transformerRef} />}
              </Layer>
            </Stage>
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <Button onClick={handleExportPNG} variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export PNG
            </Button>
            {selectedId && (
              <Button onClick={handleDelete} variant="outline" size="sm">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            )}
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
              <li>Draw arrows to show hierarchy (parent to child)</li>
              <li>Add text labels for module names and data flow</li>
              <li>Show control flow with lines</li>
              <li>Main module at the top, subordinates below</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("data flow") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Use circles for processes</li>
              <li>Use rectangles for external entities</li>
              <li>Use rectangles for data stores</li>
              <li>Use arrows to show data flow direction</li>
              <li>Add text to label all flows with data names</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("class") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Draw rectangles for classes</li>
              <li>Use lines to divide into sections (name, attributes, methods)</li>
              <li>Add text for class name, attributes, and methods</li>
              <li>Use arrows to show relationships</li>
              <li>Label relationships with multiplicity</li>
            </ul>
          )}
          {diagramType.toLowerCase().includes("decision") && (
            <ul className="list-disc list-inside space-y-1">
              <li>Use rectangles for actions</li>
              <li>Use circles or rectangles for decision points</li>
              <li>Draw arrows from decisions showing different paths</li>
              <li>Add text labels for conditions (Yes/No, True/False)</li>
              <li>Show the flow from top to bottom</li>
            </ul>
          )}
          <li className="mt-2 text-muted-foreground">
            <strong>Tip:</strong> Use the Select tool to move, resize, and delete shapes. Press Delete or Backspace to remove selected shapes.
          </li>
        </CardContent>
      </Card>
    </div>
  );
}
