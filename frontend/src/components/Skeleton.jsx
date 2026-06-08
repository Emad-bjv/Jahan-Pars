import React from 'react';
import './Skeleton.css';

export const Skeleton = ({ width, height, borderRadius = 'var(--radius-md)', style }) => {
  return (
    <div 
      className="skeleton-loader" 
      style={{ width, height, borderRadius, ...style }} 
    />
  );
};

export const SkeletonText = ({ lines = 1, lineHeight = '20px', gap = '10px' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'} 
          height={lineHeight} 
        />
      ))}
    </div>
  );
};

export const SkeletonCard = () => (
  <div className="glass-panel" style={{ padding: '1.5rem', height: '100%' }}>
    <Skeleton width="40%" height="15px" style={{ marginBottom: '1rem' }} />
    <Skeleton width="80%" height="30px" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="table-container">
    <table className="table">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}><Skeleton width="60%" height="20px" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><Skeleton width="80%" height="20px" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
