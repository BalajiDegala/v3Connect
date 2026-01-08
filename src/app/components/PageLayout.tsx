import { ReactNode } from 'react';
import { DataCenterBackground } from './DataCenterBackground';

interface PageLayoutProps {
  children: ReactNode;
  leftBanner?: ReactNode;
  rightBanner?: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-background">
      {/* Left sidebar with 3D scene - starts below navbar */}
      <div className="hidden xl:block w-64 fixed left-0 top-16 bottom-0 overflow-hidden z-0">
        <DataCenterBackground />
      </div>
      
      {/* Main content */}
      <main className="flex-1 xl:ml-64 xl:mr-64 relative z-10">
        {children}
      </main>
      
      {/* Right sidebar with 3D scene - starts below navbar */}
      <div className="hidden xl:block w-64 fixed right-0 top-16 bottom-0 overflow-hidden z-0">
        <DataCenterBackground />
      </div>
    </div>
  );
}
