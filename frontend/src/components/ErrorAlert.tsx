import React from "react";
import { AlertCircle, X } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  fieldErrors?: Record<string, string>;
  traceId?: string;
  onDismiss?: () => void;
  onClose?: () => void;
}

export function ErrorAlert({ message, fieldErrors, traceId, onDismiss, onClose }: ErrorAlertProps) {
  if (!message) return null;
  const handleClose = onClose || onDismiss;

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4 text-sm text-red-800">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{message}</p>
            {fieldErrors && Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-red-700">
                {Object.entries(fieldErrors).map(([field, err]) => (
                  <li key={field}>
                    <span className="font-semibold capitalize">{field}</span>: {err}
                  </li>
                ))}
              </ul>
            )}
            {traceId && (
              <p className="mt-2 text-xs text-red-500 font-mono">
                Trace ID: {traceId}
              </p>
            )}
          </div>
        </div>
        {handleClose && (
          <button
            onClick={handleClose}
            className="text-red-400 hover:text-red-600 focus:outline-none"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorAlert;

