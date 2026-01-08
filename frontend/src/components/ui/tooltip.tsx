"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
    return <div className="relative inline-block">{children}</div>
}

const Tooltip = ({ children }: { children: React.ReactNode }) => {
    return <div className="group relative flex items-center justify-center">{children}</div>
}

const TooltipTrigger = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("cursor-pointer", className)}
        {...props}
    />
))
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" | "left" | "right" }
>(({ className, side = "top", ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200",
            side === "top" && "bottom-full mb-2",
            side === "bottom" && "top-full mt-2",
            side === "left" && "right-full mr-2",
            side === "right" && "left-full ml-2",
            className
        )}
        {...props}
    />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
