"use client";

import UMLDiagramApp from '../components/UMLDiagramApp';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { UserHeader } from '../components/UserHeader';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#fff7fa]">
        <UserHeader />
        <div className="flex-1 overflow-hidden">
          <UMLDiagramApp />
        </div>
      </div>
    </ProtectedRoute>
  );
}
