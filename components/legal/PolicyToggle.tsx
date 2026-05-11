
import { FC, useState } from 'react';

interface PolicyToggleProps {
  plainText: string;
  legalText: string;
}

const PolicyToggle: FC<PolicyToggleProps> = ({ plainText, legalText }) => {
  const [isLegal, setIsLegal] = useState(false);

  return (
    <div>
      <div className="flex items-center mb-4">
        <span className="mr-2">Plain English</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isLegal}
            onChange={() => setIsLegal(!isLegal)}
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
        <span className="ml-2">Legalese</span>
      </div>
      <div>{isLegal ? legalText : plainText}</div>
    </div>
  );
};

export default PolicyToggle;
