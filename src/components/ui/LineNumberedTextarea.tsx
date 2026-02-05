import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface LineNumberedTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    label?: string;
}

export function LineNumberedTextarea({
    value,
    onChange,
    placeholder,
    className,
    label,
}: LineNumberedTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const lines = value.split("\n");

    // Sync scroll position
    const handleScroll = () => {
        if (textareaRef.current && overlayRef.current) {
            overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.addEventListener("scroll", handleScroll);
            return () => textarea.removeEventListener("scroll", handleScroll);
        }
    }, []);

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium text-gray-300">{label}</label>
            )}
            {/* WhatsApp-style container with overlay */}
            <div
                className="relative rounded-lg shadow-md overflow-hidden"
                style={{
                    background: "linear-gradient(to bottom, #0a3d2e 0%, #0f2027 100%)",
                    backgroundImage: `
                        linear-gradient(to bottom, rgba(10, 61, 46, 0.95) 0%, rgba(15, 32, 39, 0.95) 100%),
                        repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px),
                        repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.01) 10px, rgba(255,255,255,0.01) 20px)
                    `,
                    border: "1px solid rgba(52, 211, 153, 0.15)",
                }}
            >
                {/* Line numbers overlay - scrolls with textarea */}
                <div
                    ref={overlayRef}
                    className="absolute top-0 left-0 bottom-0 w-10 overflow-hidden pointer-events-none select-none z-10"
                    style={{
                        overflowY: "hidden",
                        paddingTop: "0.625rem",
                        paddingBottom: "0.625rem",
                        background: "rgba(0, 0, 0, 0.3)",
                        borderRight: "1px solid rgba(52, 211, 153, 0.2)",
                    }}
                >
                    {lines.map((_, i) => (
                        <div
                            key={i}
                            className="text-xs text-center font-mono"
                            style={{
                                height: "1.5rem",
                                lineHeight: "1.5rem",
                                color: "rgba(52, 211, 153, 0.6)",
                                fontWeight: "500",
                            }}
                        >
                            {i + 1}
                        </div>
                    ))}
                </div>

                {/* Textarea with left padding for line numbers */}
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                        "border-0 resize-none font-mono text-sm min-h-[200px] w-full",
                        "focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg",
                        "text-gray-100 placeholder:text-gray-500",
                        "bg-transparent",
                        className
                    )}
                    style={{
                        lineHeight: "1.5rem",
                        paddingLeft: "2.75rem", // Space for line numbers
                        paddingTop: "0.625rem",
                        paddingBottom: "0.625rem",
                        background: "transparent",
                    }}
                />
            </div>
        </div>
    );
}
