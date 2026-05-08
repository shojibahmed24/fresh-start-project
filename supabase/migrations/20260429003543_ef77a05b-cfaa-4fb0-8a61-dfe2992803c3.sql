
UPDATE public.project_files
SET content = $APP$import React, { useState } from 'react';
import CalculatorDisplay from './components/CalculatorDisplay';
import CalculatorButton from './components/CalculatorButton';
import { calculate, formatResult } from './utils/calculator';

const App: React.FC = () => {
  const [currentInput, setCurrentInput] = useState<string>('');
  const [previousInput, setPreviousInput] = useState<string>('');
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);

  const handleNumberClick = (num: string) => {
    if (waitingForOperand) {
      setCurrentInput(num);
      setWaitingForOperand(false);
    } else {
      setCurrentInput(prev => prev === '0' ? num : prev + num);
    }
  };

  const handleOperatorClick = (op: string) => {
    if (currentInput === '') return;
    if (previousInput !== '' && operator && !waitingForOperand) {
      const result = calculate(parseFloat(previousInput), parseFloat(currentInput), operator);
      const formatted = formatResult(result);
      setPreviousInput(formatted);
      setCurrentInput('');
    } else {
      setPreviousInput(currentInput);
    }
    setOperator(op);
    setWaitingForOperand(true);
  };

  const handleEqualsClick = () => {
    if (previousInput === '' || operator === null || currentInput === '') return;
    const result = calculate(parseFloat(previousInput), parseFloat(currentInput), operator);
    const formatted = formatResult(result);
    setCurrentInput(formatted);
    setPreviousInput('');
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleClearClick = () => {
    setCurrentInput('');
    setPreviousInput('');
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleDecimalClick = () => {
    if (waitingForOperand) {
      setCurrentInput('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!currentInput.includes('.')) {
      setCurrentInput(prev => prev + '.');
    }
  };

  return (
    <div
      className="h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="w-full flex-1 flex flex-col p-4 gap-4">
        <CalculatorDisplay
          currentInput={currentInput}
          previousInput={previousInput}
          operator={operator}
        />

        <div className="grid grid-cols-4 grid-rows-5 gap-3 flex-1 min-h-0">
          <CalculatorButton label="C" onClick={handleClearClick} variant="clear" className="col-span-2" />
          <CalculatorButton label="/" onClick={() => handleOperatorClick('/')} variant="operator" />
          <CalculatorButton label="*" onClick={() => handleOperatorClick('*')} variant="operator" />

          <CalculatorButton label="7" onClick={() => handleNumberClick('7')} />
          <CalculatorButton label="8" onClick={() => handleNumberClick('8')} />
          <CalculatorButton label="9" onClick={() => handleNumberClick('9')} />
          <CalculatorButton label="-" onClick={() => handleOperatorClick('-')} variant="operator" />

          <CalculatorButton label="4" onClick={() => handleNumberClick('4')} />
          <CalculatorButton label="5" onClick={() => handleNumberClick('5')} />
          <CalculatorButton label="6" onClick={() => handleNumberClick('6')} />
          <CalculatorButton label="+" onClick={() => handleOperatorClick('+')} variant="operator" />

          <CalculatorButton label="1" onClick={() => handleNumberClick('1')} />
          <CalculatorButton label="2" onClick={() => handleNumberClick('2')} />
          <CalculatorButton label="3" onClick={() => handleNumberClick('3')} />
          <CalculatorButton label="=" onClick={handleEqualsClick} variant="equals" className="row-span-2" />

          <CalculatorButton label="0" onClick={() => handleNumberClick('0')} className="col-span-2" />
          <CalculatorButton label="." onClick={handleDecimalClick} />
        </div>
      </div>
    </div>
  );
};

export default App;
$APP$
WHERE project_id = '7d02e2dd-7913-4f08-b280-8ab5ba1dd94e' AND path = '/src/App.tsx';

UPDATE public.project_files
SET content = $BTN$import React from 'react';
import { motion } from 'framer-motion';

interface CalculatorButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'number' | 'operator' | 'equals' | 'clear';
  className?: string;
}

const CalculatorButton: React.FC<CalculatorButtonProps> = ({ label, onClick, variant = 'number', className = '' }) => {
  const baseClasses = 'w-full h-full min-h-[56px] rounded-2xl font-medium text-2xl flex items-center justify-center transition-colors select-none active:brightness-110';
  const variantClasses = {
    number: 'bg-gray-800 text-white hover:bg-gray-700',
    operator: 'bg-orange-500 text-white hover:bg-orange-600',
    equals: 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/40',
    clear: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {label}
    </motion.button>
  );
};

export default CalculatorButton;
$BTN$
WHERE project_id = '7d02e2dd-7913-4f08-b280-8ab5ba1dd94e' AND path = '/src/components/CalculatorButton.tsx';

UPDATE public.project_files
SET content = $DISP$import React from 'react';

interface CalculatorDisplayProps {
  currentInput: string;
  previousInput: string;
  operator: string | null;
}

const CalculatorDisplay: React.FC<CalculatorDisplayProps> = ({ currentInput, previousInput, operator }) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur p-6 rounded-2xl border border-gray-800 shrink-0">
      <div className="text-gray-400 text-sm font-light mb-1 min-h-[20px] text-right">
        {previousInput} {operator}
      </div>
      <div className="text-white text-5xl font-light tracking-wide text-right min-h-[56px] overflow-x-auto">
        {currentInput || '0'}
      </div>
    </div>
  );
};

export default CalculatorDisplay;
$DISP$
WHERE project_id = '7d02e2dd-7913-4f08-b280-8ab5ba1dd94e' AND path = '/src/components/CalculatorDisplay.tsx';
