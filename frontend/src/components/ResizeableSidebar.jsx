/*
File: ResizeableSidebar.jsx
Purpose: takes side ('left'|'right'), defaultWidth, minWidth, maxWidth, optional className, 
        and children, and outputs an <aside> container that renders those children 
        inside a vertically scrollable area with a draggable resize handle 
        that constrains width between min/max bounds on smaller screen size
Creation Date: 2026-03-10 
Initial Author(s): Garrett Caldwell

System Context: Used on sidebars to adjust their width.
*/

import React, { useState, useEffect, useRef } from 'react';

/**
 * Wraps sidebar content in a horizontally resizable container with drag handles.
 *
 * @param {object} props - Component props.
 * @param {'left'|'right'} [props.side='left'] - Side the sidebar is anchored to.
 * @param {number} [props.defaultWidth=320] - Initial sidebar width in pixels.
 * @param {number} [props.minWidth=250] - Minimum allowed width while dragging.
 * @param {number} [props.maxWidth=600] - Maximum allowed width while dragging.
 * @param {React.ReactNode} props.children - Sidebar content to render.
 * @param {string} [props.className=''] - Additional CSS classes applied to the aside.
 * @returns {JSX.Element} Resizable sidebar container with optional left/right drag handle.
 */
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

    /**
     * Starts resize mode and stores initial drag coordinates/width.
     *
     * @param {React.MouseEvent<HTMLDivElement>} e - Mouse down event from resize handle.
     * @returns {void}
     */
    const handleMouseDown = (e) => {
        setIsResizing(true);
        dragData.current = {
            startX: e.clientX,
            startWidth: sidebarRef.current.getBoundingClientRect().width
        };
    };

    /**
     * Attaches/removes global mouse listeners while resizing and applies width updates.
     *
     * @returns {void}
     */
    useEffect(() => {
        /**
         * Computes and applies new sidebar width during mouse drag.
         *
         * @param {MouseEvent} e - Global mouse move event.
         * @returns {void}
         */
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

        /**
         * Stops resize mode and cancels any pending animation frame.
         *
         * @returns {void}
         */
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