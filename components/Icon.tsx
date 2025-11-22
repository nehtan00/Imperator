
import React from 'react';
import { SpecialAbility } from '../types';
import { ABILITY_ICON_PATHS } from '../gameConstants';

export type IconName = SpecialAbility | 'warp' | 'go-again' | 'start';

interface IconProps {
  name: IconName | null;
  className?: string;
  style?: React.CSSProperties;
}

const customIcons: Record<string, string> = {
  // Concentric circles for a "Time Warp" / Tunnel effect
  'warp': "M12 2.25A9.75 9.75 0 1021.75 12 9.75 9.75 0 0012 2.25zm0 3.75a6 6 0 11-6 6 6 6 0 016-6zm0 3.75a2.25 2.25 0 11-2.25 2.25 2.25 2.25 0 012.25-2.25z",
  'go-again': "M15 15l6-6m0 0-6-6m6 6H9a6 6 0 000 12h3",
  'start': "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3 0-3-3m0 0l3 3m-3-3H3"
};

export const Icon: React.FC<IconProps> = ({ name, className, style }) => {
  if (!name) return null;

  let iconPath = "";
  
  // Type guard to check if name is a SpecialAbility and exists in paths
  if (typeof name === 'string' && ABILITY_ICON_PATHS && Object.prototype.hasOwnProperty.call(ABILITY_ICON_PATHS, name)) {
      iconPath = ABILITY_ICON_PATHS[name as SpecialAbility];
  } else if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(customIcons, name)) {
      iconPath = customIcons[name];
  }

  if (!iconPath) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className || "w-6 h-6"}
      style={style}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
    </svg>
  );
};
