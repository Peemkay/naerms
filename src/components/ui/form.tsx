import * as React from "react"
import { Form as FormPrimitive } from "@base-ui/react/form"

import { cn } from "@/lib/utils"

function Form<FormValues extends Record<string, unknown> = Record<string, unknown>>({
  className,
  ...props
}: FormPrimitive.Props<FormValues>) {
  return (
    <FormPrimitive
      data-slot="form"
      className={cn("grid gap-4", className)}
      {...props}
    />
  )
}

export { Form }
