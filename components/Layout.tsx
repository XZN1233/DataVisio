import React from 'react';

interface LayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ sidebar, children }) => {
  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
        {sidebar}
      </div>
      <main className="flex-1 overflow-hidden flex flex-col h-full relative">
        {children}
      </main>
    </div>
  );
};
