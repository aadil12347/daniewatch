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
            <div className="relative flex rounded-lg overflow-hidden bg-black/40 backdrop-blur-md border border-white/10">
                {/* Line Numbers */}
                <div
                    ref={lineNumbersRef}
                    className="flex-shrink-0 w-12 bg-black/60 border-r border-white/10 overflow-hidden select-none"
                    style={{
                        overflowY: "hidden",
                        lineHeight: "1.5rem",
                        paddingTop: "0.625rem",
                        paddingBottom: "0.625rem",
                    }}
                >
                    {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
                        <div
                            key={i + 1}
                            className="text-xs text-gray-500 text-right pr-2 font-mono h-6"
                            style={{ lineHeight: "1.5rem" }}
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
                        "flex-1 border-0 bg-transparent resize-none font-mono text-sm min-h-[200px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none pl-3",
                        className
                    )}
                    style={{
                        lineHeight: "1.5rem",
                    }}
                />
            </div>
            {lines.length > 0 && lines.some(line => line.trim()) && (
                <p className="text-xs text-gray-500">
                    {lines.filter(line => line.trim()).length} links
                </p>
            )}
        </div>
    );
}
