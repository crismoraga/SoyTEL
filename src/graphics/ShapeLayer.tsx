import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { Drawing, Gradient, Paint, Shape } from './shapes';

function paintProps(shape: Paint) {
  return {
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.sw,
    opacity: shape.op,
    fillOpacity: shape.fop,
    strokeOpacity: shape.sop,
    strokeLinecap: shape.cap,
    strokeLinejoin: shape.join,
    strokeDasharray: shape.dash,
    transform: shape.tf,
  };
}

function renderShape(shape: Shape, key: number | string): React.ReactElement {
  const paint = paintProps(shape);
  switch (shape.t) {
    case 'path':
      return <Path key={key} d={shape.d} {...paint} />;
    case 'circle':
      return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />;
    case 'ellipse':
      return <Ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...paint} />;
    case 'rect':
      return <Rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} ry={shape.rx} {...paint} />;
    case 'line':
      return <Line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...paint} />;
    case 'g':
      return (
        <G key={key} {...paint}>
          {shape.children.map((child, index) => renderShape(child, index))}
        </G>
      );
  }
}

export function ShapeLayer({ shapes }: { shapes: Shape[] }) {
  return <>{shapes.map((shape, index) => renderShape(shape, index))}</>;
}

export function GradientDefs({ gradients }: { gradients: Gradient[] }) {
  return (
    <Defs>
      {gradients.map((gradient) => {
        const stops = gradient.stops.map((stop) => (
          <Stop key={`${gradient.id}-${stop.offset}`} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
        ));
        return gradient.kind === 'linear' ? (
          <LinearGradient key={gradient.id} id={gradient.id} x1={gradient.x1} y1={gradient.y1} x2={gradient.x2} y2={gradient.y2}>
            {stops}
          </LinearGradient>
        ) : (
          <RadialGradient key={gradient.id} id={gradient.id} cx={gradient.cx} cy={gradient.cy} r={gradient.r}>
            {stops}
          </RadialGradient>
        );
      })}
    </Defs>
  );
}

interface SvgDrawingProps {
  drawing: Drawing;
  width: number | `${number}%`;
  height: number | `${number}%`;
  color?: string;
  style?: StyleProp<ViewStyle>;
  slice?: boolean;
}

export const SvgDrawing = memo(function SvgDrawing({ drawing, width, height, color, style, slice }: SvgDrawingProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${drawing.w} ${drawing.h}`}
      color={color}
      style={style}
      preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'}
    >
      {drawing.gradients && drawing.gradients.length > 0 && <GradientDefs gradients={drawing.gradients} />}
      <ShapeLayer shapes={drawing.shapes} />
    </Svg>
  );
});
