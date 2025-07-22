'use client'

import { Label } from '../../types'

interface LabelBadgeProps {
  label: Label
}

function getTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
}

export function LabelBadge({ label }: LabelBadgeProps) {
  const backgroundColor = `#${label.color}`
  const textColor = getTextColor(backgroundColor)
  
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor,
        color: textColor,
      }}
      title={label.description}
    >
      {label.name}
    </span>
  )
}