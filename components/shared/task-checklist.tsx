"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type ChecklistTask = {
  id: number
  label: string
  done: boolean
  tag?: string
  tagVariant?: "danger" | "neutral"
}

export function TaskChecklist({
  tasks: initialTasks,
  onToggle,
  className,
}: {
  tasks: ChecklistTask[]
  onToggle?: (id: number) => void
  className?: string
}) {
  const [tasks, setTasks] = useState(initialTasks)

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  function toggle(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    )
    onToggle?.(id)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => toggle(task.id)}
          className="border-border hover:bg-muted flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors"
        >
          <span
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors",
              task.done
                ? "border-status-disponible bg-status-disponible-bg"
                : "border-input"
            )}
          >
            {task.done && (
              <Check className="text-status-disponible-fg size-2.5" strokeWidth={3} />
            )}
          </span>
          <span
            className={cn(
              "flex-1 text-[13px] font-medium",
              task.done ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {task.label}
          </span>
          {task.tag ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                task.tagVariant === "danger"
                  ? "bg-status-bloqueado-bg text-status-bloqueado-fg"
                  : "text-muted-foreground"
              )}
            >
              {task.tag}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
