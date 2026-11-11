"use client";

import React from 'react';
import type { RelationType } from '../types/uml';

interface RelationIconProps {
  type: RelationType;
  className?: string;
}

export const RelationIcon: React.FC<RelationIconProps> = ({ type, className = "w-10 h-5" }) => {
  switch (type) {
    case 'association':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="4"
            y1="10"
            x2="40"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="39" cy="10" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'aggregation':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="4,10 12,5 20,10 12,15"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="20"
            y1="10"
            x2="40"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="39" cy="10" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'composition':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="4,10 12,5 20,10 12,15"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="20"
            y1="10"
            x2="40"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="39" cy="10" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'inheritance':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="4"
            y1="10"
            x2="28"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="5" cy="10" r="1.5" fill="currentColor" />
          <polygon
            points="28,4 40,10 28,16"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'implementation':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="4"
            y1="10"
            x2="28"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="3,3"
            strokeLinecap="round"
          />
          <circle cx="5" cy="10" r="1.5" fill="currentColor" />
          <polygon
            points="28,4 40,10 28,16"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'dependency':
      return (
        <svg
          viewBox="0 0 44 20"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="4"
            y1="10"
            x2="33"
            y2="10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="3,3"
            strokeLinecap="round"
          />
          <circle cx="5" cy="10" r="1.5" fill="currentColor" />
          <path
            d="M 28 5 L 38 10 L 28 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return null;
  }
};

export default RelationIcon;

