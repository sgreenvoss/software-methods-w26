import React, { useState, useEffect, useRef } from 'react';

export default function ResizableSidebar({ 
    side = 'left', 
    defaultWidth = 320, 
    minWidth = 250, 
    maxWidth = 600, 
    children,
    className = ''
}) {
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef(null);
    const dragData = useRef({ startX: 0, startWidth: 0 });
    
    // NEW: We use this to throttle the browser repaints
    const requestRef = useRef();

    const handleMouseDown = (e) => {
        setIsResizing(true);
        dragData.current = {
            startX: e.clientX,
            startWidth: sidebarRef.current.getBoundingClientRect().width
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            // Cancel any pending animations to prevent traffic jams
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            
            // Request a synchronized frame paint from the browser
            requestRef.current = requestAnimationFrame(() => {
                const deltaX = e.clientX - dragData.current.startX;
                let newWidth = side === 'left' 
                    ? dragData.current.startWidth + deltaX 
                    : dragData.current.startWidth - deltaX;

                newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

                if (sidebarRef.current) {
                    sidebarRef.current.style.width = `${newWidth}px`;
                }
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            // Force the cursor to stay the same even if the mouse moves faster than the frame
            document.body.style.cursor = 'col-resize'; 
        } else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isResizing, side, minWidth, maxWidth]);

    return (
        <aside 
            ref={sidebarRef}
            className={`resizable-sidebar ${className}`}
            style={{ 
                width: `${defaultWidth}px`, 
                flexShrink: 0, 
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }} 
        >
            {side === 'right' && (
                <div 
                    className="resize-handle resize-handle-left" 
                    onMouseDown={handleMouseDown} 
                />
            )}
            
            {/* FIX: Changed overflowX back to 'auto' so it restores your horizontal scroll! */}
            <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
                {children}
            </div>

            {side === 'left' && (
                <div 
                    className="resize-handle resize-handle-right" 
                    onMouseDown={handleMouseDown} 
                />
            )}
        </aside>
    );
}