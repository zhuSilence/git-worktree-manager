import * as React from 'react'
import { cn } from '@/utils/format'

export type MainProps = React.HTMLAttributes<HTMLElement>

export const Main: React.FC<MainProps> = ({ className, children, ...props }) => {
  return (
    <main className={cn('flex-1 overflow-auto', className)} {...props}>
      {children}
    </main>
  )
}
