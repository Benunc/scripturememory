import React, { useEffect, useRef, useState } from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';

interface VerseOverlayProps {
  activeVerseRef: React.RefObject<HTMLElement> | null;
  onOverlayClick: () => void;
  isVisible: boolean;
}

export const VerseOverlay: React.FC<VerseOverlayProps> = ({
  activeVerseRef,
  onOverlayClick,
  isVisible
}) => {
  const [holePosition, setHolePosition] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Get color mode specific overlay color
  const overlayBg = useColorModeValue('blackAlpha.400', 'blackAlpha.600');

  // Update hole position when active verse changes or window resizes
  useEffect(() => {
    if (!isVisible || !activeVerseRef?.current) return;

    const updateHolePosition = () => {
      const verseElement = activeVerseRef.current;
      if (!verseElement) return;

      const rect = verseElement.getBoundingClientRect();
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      
      if (!overlayRect) return;

      // Calculate position relative to overlay
      setHolePosition({
        top: rect.top - overlayRect.top,
        left: rect.left - overlayRect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right - overlayRect.left,
        bottom: rect.bottom - overlayRect.top,
        x: rect.x - overlayRect.left,
        y: rect.y - overlayRect.top,
        toJSON: rect.toJSON
      });
    };

    updateHolePosition();
    window.addEventListener('resize', updateHolePosition);
    window.addEventListener('scroll', updateHolePosition);

    return () => {
      window.removeEventListener('resize', updateHolePosition);
      window.removeEventListener('scroll', updateHolePosition);
    };
  }, [activeVerseRef, isVisible]);

  if (!isVisible) return null;

  return (
    <Box
      ref={overlayRef}
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg={overlayBg}
      zIndex={100}
      onClick={onOverlayClick}
      transition="background-color 0.1s ease-in-out"
      sx={{
        '&::before': holePosition ? {
          content: '""',
          position: 'absolute',
          top: holePosition.top,
          left: holePosition.left,
          width: holePosition.width,
          height: holePosition.height,
          backgroundColor: 'transparent',
          pointerEvents: 'none',
          borderRadius: 'lg',
          boxShadow: `0 0 0 9999px var(--chakra-colors-${overlayBg.replace('.', '-')})`,
          transition: 'box-shadow 0.3s ease-in-out'
        } : {}
      }}
    />
  );
}; 