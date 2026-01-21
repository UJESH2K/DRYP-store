import React, { ReactNode } from 'react'

// Minimal stub provider to avoid external dependency and keep API shape.
// If you plan to use gluestack later, install:
//   npm i @gluestack-ui/themed @gluestack-ui/config
// and replace this with their real provider.
export function UIProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}