import { useEffect, ReactNode } from 'react';

interface GameModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

export const GameModal = ({ isOpen, onClose, title, children }: GameModalProps) => {
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-card border border-border text-card-foreground w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        ✕
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};
