import React, {
  useRef,
  useState,
  useEffect,
  MouseEvent,
  TouchEvent,
} from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import * as mutex from "lib0/mutex";

interface CanvasProps {
  width?: number;
  height?: number;
  initialBrushColor?: string;
  initialBrushSize?: number;
  roomName?: string;
}
interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  size: number;
}

const Canvas: React.FC<CanvasProps> = ({
  width = 800,
  height = 600,
  initialBrushColor = "#000000",
  initialBrushSize = 5,
  roomName = "default-room",
}) => {
  // 캔버스 참조 생성
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 그리기 상태 관리
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  // 브러쉬 설정
  const [brushColor, setBrushColor] = useState<string>(initialBrushColor);
  const [brushSize, setBrushSize] = useState<number>(initialBrushSize);

  // yjs 관련 참조 생성
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const yDrawingsRef = useRef<Y.Array<Stroke> | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // mutex 참조 생성
  const mutexRef = useRef<mutex.mutex | null>(null);
  const [isMutexLocked, setIsMutexLocked] = useState<boolean>(false);

  //yjs 초기화
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: ["ws://localhost:4444"],
    });

    providerRef.current = provider;
    const yDrawings = ydoc.getArray<Stroke>("drawings");
    yDrawingsRef.current = yDrawings;

    // mutex 초기화
    mutexRef.current = mutex.createMutex();

    yDrawings.observe(() => {
      redrawCanvas();
    });

    return () => {
      provider.disconnect();
      ydoc.destroy();
    };
  }, [roomName]);

  // 컴포넌트 마운트 시 캔버스 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // 캔버스 크기 설정
    canvas.width = width;
    canvas.height = height;

    // 캔버스 초기화
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 선 스타일 설정
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;

    // 캔버스 초기화 후 데이터가 있다면 그리기
    redrawCanvas();
  }, [width, height]);

  // 브러쉬 색상이나 크기가 변경될 때마다 컨텍스트 업데이트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;
  }, [brushColor, brushSize]);

  // 좌표 인터페이스 정의
  interface Coordinates {
    offsetX: number;
    offsetY: number;
  }

  const redrawCanvas = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const yDrawings = yDrawingsRef.current;
    if (!yDrawings) return;

    // 캔버스 초기화
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 모든 그림 데이터 다시 그리기
    yDrawings.forEach((stroke) => {
      if (stroke.points.length < 1) return;

      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size;

      // 첫 점으로 이동
      context.moveTo(stroke.points[0].x, stroke.points[0].y);

      // 나머지 점을 연결
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      context.stroke();
      context.closePath();
    });
  };

  // 그리기 시작 - mutex 잠금 획득
  const startDrawing = async (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): Promise<void> => {
    const mx = mutexRef.current;
    if (!mx) return;

    // 이미 그리기 중이거나 mutex가 잠겨있으면 무시
    if (isDrawing || isMutexLocked) return;

    // mutex 잠금 시도
    try {
      // mutex를 획득하고 잠금 상태 업데이트
      mx(() => {
        setIsMutexLocked(true);

        const coordinates = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.beginPath();
        context.moveTo(coordinates.offsetX, coordinates.offsetY);
        setIsDrawing(true);

        // 새 스트로크 생성
        currentStrokeRef.current = {
          points: [{ x: coordinates.offsetX, y: coordinates.offsetY }],
          color: brushColor,
          size: brushSize,
        };
      });
    } catch (error) {
      console.error("Failed to acquire mutex lock:", error);
    }
  };

  // 그리기 중
  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): void => {
    if (!isDrawing || !isMutexLocked) return;

    const coordinates = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineTo(coordinates.offsetX, coordinates.offsetY);
    context.stroke();

    // 현재 스트로크에 점 추가
    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({
        x: coordinates.offsetX,
        y: coordinates.offsetY,
      });
    }
  };

  // 그리기 종료 - mutex 잠금 해제
  const stopDrawing = (): void => {
    if (!isDrawing || !isMutexLocked) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.closePath();
    setIsDrawing(false);

    // 완성된 스트로크를 y-array에 추가
    if (currentStrokeRef.current && yDrawingsRef.current) {
      // 충분한 점이 있는 경우에만 추가 (1점만 있는 경우는 실제 선이 아님)
      if (currentStrokeRef.current.points.length > 1) {
        yDrawingsRef.current.push([currentStrokeRef.current]);
      }
      currentStrokeRef.current = null;
    }

    // mutex 잠금 해제
    setIsMutexLocked(false);
  };

  // 터치 이벤트 및 마우스 이벤트 좌표 처리
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): Coordinates => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { offsetX: 0, offsetY: 0 };
    }

    if ("touches" in e.nativeEvent) {
      // 터치 이벤트 처리
      const touch = e.nativeEvent.touches[0];
      const rect = canvas.getBoundingClientRect();
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top,
      };
    } else {
      // 마우스 이벤트 처리
      return {
        offsetX: e.nativeEvent.offsetX,
        offsetY: e.nativeEvent.offsetY,
      };
    }
  };

  // 캔버스 초기화 - mutex 잠금 사용
  const clearCanvas = async (): Promise<void> => {
    const mx = mutexRef.current;
    if (!mx) return;

    try {
      // mutex를 획득하고 캔버스 초기화
      mx(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Yjs 공유 배열 초기화
        if (yDrawingsRef.current) {
          yDrawingsRef.current.delete(0, yDrawingsRef.current.length);
        }
      });
    } catch (error) {
      console.error("Failed to acquire mutex lock for clearing canvas:", error);
    }
  };

  return (
    <div className="canvas-container">
      <div className="controls">
        <div className="color-picker">
          <label>브러쉬 색상: </label>
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
          />
        </div>
        <div className="size-slider">
          <label>브러쉬 크기: {brushSize}px</label>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
          />
        </div>
        <button onClick={clearCanvas}>초기화</button>
        {isMutexLocked && <span className="mutex-status">편집 중...</span>}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ border: "1px solid #000", cursor: "crosshair" }}
      />
    </div>
  );
};

export default Canvas;
