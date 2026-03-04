import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../../lib/cn';

const getElementSize = (element) => {
  if (!element) {
    return { width: 0, height: 0 };
  }

  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
};

const ChartSurface = ({
  className,
  fallback = null,
  children,
}) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      setSize(getElementSize(element));
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const hasValidSize = size.width > 0 && size.height > 0;

  return (
    <div ref={containerRef} className={cn('w-full min-w-0', className)}>
      {hasValidSize ? children(size) : fallback}
    </div>
  );
};

export default ChartSurface;
