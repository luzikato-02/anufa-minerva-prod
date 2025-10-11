
import * as React from "react"
import { cn } from "@/lib/utils"

type TypingTextProps = {
  words: string[]
  typingSpeed?: number // ms per character when typing
  deletingSpeed?: number // ms per character when deleting
  pauseBeforeDelete?: number // ms pause after finishing a word
  pauseBeforeType?: number // ms pause before starting next word
  loop?: boolean
  className?: string
  caretClassName?: string
  ariaLabelPrefix?: string
}

export function TypingText({
  words,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseBeforeDelete = 1000,
  pauseBeforeType = 400,
  loop = true,
  className,
  caretClassName,
  ariaLabelPrefix = "",
}: TypingTextProps) {
  const [displayText, setDisplayText] = React.useState("")
  const [wordIndex, setWordIndex] = React.useState(0)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const safeWords = Array.isArray(words) ? words.filter(Boolean) : []
  const currentWord = safeWords.length ? safeWords[wordIndex % safeWords.length] : ""

  React.useEffect(() => {
    if (!safeWords.length) return

    let timeout = typingSpeed
    let next = () => {}

    if (isDeleting) {
      if (displayText.length > 0) {
        next = () => setDisplayText(currentWord.slice(0, displayText.length - 1))
        timeout = deletingSpeed
      } else {
        next = () => {
          setIsDeleting(false)
          setWordIndex((i) => (i + 1) % safeWords.length)
        }
        timeout = pauseBeforeType
      }
    } else {
      if (displayText.length < currentWord.length) {
        next = () => setDisplayText(currentWord.slice(0, displayText.length + 1))
        timeout = typingSpeed
      } else {
        // Finished typing the current word
        if (!loop && wordIndex === safeWords.length - 1) {
          // stop on last word if not looping
          return
        }
        next = () => setIsDeleting(true)
        timeout = pauseBeforeDelete
      }
    }

    const timer = setTimeout(next, timeout)
    return () => clearTimeout(timer)
  }, [
    currentWord,
    deletingSpeed,
    displayText,
    isDeleting,
    loop,
    pauseBeforeDelete,
    pauseBeforeType,
    safeWords.length,
    typingSpeed,
    wordIndex,
  ])

  // Build an aria-friendly label that reads the current output
  const ariaLabel = `${ariaLabelPrefix}${displayText}`.trim()

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn("inline-flex items-baseline whitespace-pre text-foreground", className)}
    >
      {/* Visible text for sighted users */}
      <span aria-hidden="true">{displayText}</span>

      {/* Blinking caret. Uses tokens: bg-primary for proper theming */}
      <span
        aria-hidden="true"
        className={cn("ml-[1px] inline-block h-[1em] w-[10px] bg-primary animate-pulse", caretClassName)}
      />
    </span>
  )
}
