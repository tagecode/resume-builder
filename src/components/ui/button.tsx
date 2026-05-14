import * as React from 'react'
import { type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

import { buttonVariants } from '@/components/ui/button-variants'

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? 'span' : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
