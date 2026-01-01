import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ConfirmModal from './ConfirmModal';

interface DialogOptions {
    title?: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

interface DialogContextType {
    confirm: (options: DialogOptions) => Promise<boolean>;
    alert: (message: ReactNode, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}

interface DialogState {
    isOpen: boolean;
    mode: 'confirm' | 'alert';
    options: DialogOptions;
    resolve: ((value: boolean) => void) | null;
}

export function DialogProvider({ children }: { children: ReactNode }) {
    const [dialogState, setDialogState] = useState<DialogState>({
        isOpen: false,
        mode: 'confirm',
        options: { message: '' },
        resolve: null,
    });

    const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                mode: 'confirm',
                options,
                resolve,
            });
        });
    }, []);

    const alert = useCallback((message: ReactNode, title?: string): Promise<void> => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                mode: 'alert',
                options: { message, title: title || 'Notice' },
                resolve: () => resolve(),
            });
        });
    }, []);

    const handleConfirm = () => {
        dialogState.resolve?.(true);
        setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    };

    const handleCancel = () => {
        dialogState.resolve?.(false);
        setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            <ConfirmModal
                isOpen={dialogState.isOpen}
                title={dialogState.options.title}
                message={dialogState.options.message}
                confirmLabel={dialogState.mode === 'alert' ? 'OK' : dialogState.options.confirmLabel}
                cancelLabel={dialogState.options.cancelLabel}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                isDestructive={dialogState.options.isDestructive}
                isAlert={dialogState.mode === 'alert'}
            />
        </DialogContext.Provider>
    );
}
