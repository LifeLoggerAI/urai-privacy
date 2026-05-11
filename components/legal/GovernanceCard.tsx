
import { FC } from 'react';

interface GovernanceCardProps {
  name: string;
  title: string;
  avatarUrl: string;
}

const GovernanceCard: FC<GovernanceCardProps> = ({ name, title, avatarUrl }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 flex items-center">
      <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full mr-6" />
      <div>
        <h3 className="text-xl font-semibold">{name}</h3>
        <p className="text-gray-600">{title}</p>
      </div>
    </div>
  );
};

export default GovernanceCard;
