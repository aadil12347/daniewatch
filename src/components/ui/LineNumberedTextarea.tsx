import { useEffect, useRef } from "react";
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
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const lines = value.split("\n");
    const lineCount = lines.length;

    // Sync scroll between line numbers and textarea
    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
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
            {/* WhatsApp-style chat container */}
            <div
                className="relative flex rounded-lg overflow-hidden shadow-md"
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
                {/* Line Numbers - Scrolls with content */}
                <div
                    ref={lineNumbersRef}
                    className="flex-shrink-0 w-10 overflow-hidden select-none"
                    style={{
                        overflowY: "hidden",
                        lineHeight: "1.5rem",
                        paddingTop: "0.625rem",
                        paddingBottom: "0.625rem",
                        background: "rgba(0, 0, 0, 0.3)",
                        borderRight: "1px solid rgba(52, 211, 153, 0.2)",
                    }}
                >
                    {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
                        <div
                            key={i + 1}
                            className="text-xs text-center font-mono h-6"
                            style={{
                                lineHeight: "1.5rem",
                                color: "rgba(52, 211, 153, 0.6)",
                                fontWeight: "500",
                            }}
                        >
                            {i + 1}
                        </div>
                    ))}
                </div>

                {/* Textarea */}
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 border-0 resize-none font-mono text-sm min-h-[200px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none pl-3",
                        "text-gray-100 placeholder:text-gray-500",
                        "bg-transparent",
                        className
                    )}
                    style={{
                        lineHeight: "1.5rem",
                        background: "transparent",
                    }}
                />
            </div>
            {lines.length > 0 && lines.some(line => line.trim()) && (
                <p className="text-xs font-medium" style={{ color: "rgba(52, 211, 153, 0.7)" }}>
                    {lines.filter(line => line.trim()).length} link{lines.filter(line => line.trim()).length !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}
