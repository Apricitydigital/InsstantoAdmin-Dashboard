"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type MultiSelectOption = {
  value: string
  label: string
}

type MultiSelectFilterProps = {
  "aria-label": string
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  allLabel?: string
  className?: string
  disabled?: boolean
}

export function MultiSelectFilter({
  options,
  value,
  onValueChange,
  allLabel = "All",
  className,
  disabled,
  ...props
}: MultiSelectFilterProps) {
  const selected = new Set(value)
  const selectedLabels = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)

  const summary =
    selectedLabels.length === 0
      ? allLabel
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`

  const toggle = (optionValue: string) => {
    onValueChange(
      selected.has(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={props["aria-label"]}
          disabled={disabled}
          className={cn(
            "h-9 min-w-0 w-full shrink justify-between overflow-hidden rounded-md bg-white px-3 text-left font-normal",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate leading-none">{summary}</span>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-[var(--radix-popover-trigger-width)] min-w-52 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => onValueChange([])}
            className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm leading-5 hover:bg-accent"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded border border-input">
              {value.length === 0 && <Check className="size-3" />}
            </span>
            {allLabel}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm leading-5 hover:bg-accent"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded border border-input">
                {selected.has(option.value) && <Check className="size-3" />}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
      </PopoverContent>
    </Popover>
  )
}
