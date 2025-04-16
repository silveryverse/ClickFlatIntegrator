import React from 'react';
import { cn } from '@/lib/utils';

export type Step = 'sourceSelection' | 'connectionConfig' | 'schemaSelection' | 'ingestionExecution';

interface WorkflowStepperProps {
  currentStep: Step;
  onStepClick: (step: Step) => void;
}

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ currentStep, onStepClick }) => {
  const steps: { id: Step; label: string }[] = [
    { id: 'sourceSelection', label: 'Source Selection' },
    { id: 'connectionConfig', label: 'Connection Configuration' },
    { id: 'schemaSelection', label: 'Schema Selection' },
    { id: 'ingestionExecution', label: 'Ingestion Execution' },
  ];

  return (
    <div className="mb-8">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {steps.map((step) => (
            <button
              key={step.id}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm",
                currentStep === step.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
              aria-current={currentStep === step.id ? 'page' : undefined}
              onClick={() => onStepClick(step.id)}
            >
              {step.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default WorkflowStepper;
