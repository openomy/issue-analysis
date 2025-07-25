import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedChild = React.Children.toArray(children).find((child) => {
    return React.isValidElement(child) && (child.props as {value?: string})?.value === value
  }) as React.ReactElement

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{(selectedChild?.props as {children?: React.ReactNode})?.children || "Select..."}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return React.cloneElement(child as React.ReactElement<any>, {
                onClick: () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange((child.props as any).value)
                  setIsOpen(false)
                }
              })
            }
            return child
          })}
        </div>
      )}
    </div>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  onClick?: () => void
}

export function SelectItem({ children, onClick }: SelectItemProps) {
  return (
    <div
      className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder}</span>
}