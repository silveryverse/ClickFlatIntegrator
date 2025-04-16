import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import WorkflowStepper, { Step } from '@/components/WorkflowStepper';
import SourceSelectionStep from '@/pages/steps/SourceSelectionStep';
import ConnectionConfigStep from '@/pages/steps/ConnectionConfigStep';
import SchemaSelectionStep from '@/pages/steps/SchemaSelectionStep';
import IngestionExecutionStep from '@/pages/steps/IngestionExecutionStep';
import { useToast } from '@/hooks/use-toast';

const DataIngestionTool: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('sourceSelection');
  const { toast } = useToast();

  const handleStepClick = (step: Step) => {
    // Only allow navigating to steps that make sense based on current progress
    if (step === 'sourceSelection') {
      setCurrentStep(step);
    } else if (step === 'connectionConfig' && currentStep !== 'sourceSelection') {
      setCurrentStep(step);
    } else if (step === 'schemaSelection' && 
              (currentStep === 'connectionConfig' || currentStep === 'ingestionExecution')) {
      setCurrentStep(step);
    } else if (step === 'ingestionExecution' && currentStep === 'schemaSelection') {
      setCurrentStep(step);
    } else {
      toast({
        title: "Navigation blocked",
        description: "Please complete the current step first",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <WorkflowStepper currentStep={currentStep} onStepClick={handleStepClick} />
        
        <div className="bg-white shadow rounded-lg">
          {currentStep === 'sourceSelection' && (
            <SourceSelectionStep onNext={() => setCurrentStep('connectionConfig')} />
          )}
          
          {currentStep === 'connectionConfig' && (
            <ConnectionConfigStep 
              onBack={() => setCurrentStep('sourceSelection')}
              onNext={() => setCurrentStep('schemaSelection')} 
            />
          )}
          
          {currentStep === 'schemaSelection' && (
            <SchemaSelectionStep 
              onBack={() => setCurrentStep('connectionConfig')}
              onNext={() => setCurrentStep('ingestionExecution')} 
            />
          )}
          
          {currentStep === 'ingestionExecution' && (
            <IngestionExecutionStep 
              onBack={() => setCurrentStep('schemaSelection')}
              onReset={() => setCurrentStep('sourceSelection')} 
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default DataIngestionTool;
