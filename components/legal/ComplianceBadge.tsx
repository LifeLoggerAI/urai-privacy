
import { FC } from 'react';

interface ComplianceBadgeProps {
  standard: string;
}

const ComplianceBadge: FC<ComplianceBadgeProps> = ({ standard }) => {
  return (
    <div className="inline-block bg-green-100 text-green-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
      {standard}
    </div>
  );
};

export default ComplianceBadge;
