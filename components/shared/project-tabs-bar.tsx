"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { BrandMark } from "@/components/shared/brand-mark"
import { useSidebarMobile } from "@/components/shared/sidebar-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ProjectTab = {
  id: string
  label: string
}

export function ProjectTabsBar({
  tabs,
  defaultTabId,
  onTabChange,
}: {
  tabs: ProjectTab[]
  defaultTabId?: string
  onTabChange?: (id: string) => void
}) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id)
  const { abrirMenu } = useSidebarMobile()

  function seleccionar(id: string) {
    setActive(id)
    onTabChange?.(id)
  }

  return (
    <div className="bg-card border-border flex items-center gap-4 border-b px-4 py-3.5 lg:px-6.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 lg:hidden"
        aria-label="Abrir menu"
        onClick={abrirMenu}
      >
        <Menu className="size-5" />
      </Button>
      <div className="border-border flex items-center gap-2.5 border-r pr-4">
        <div className="bg-brand-gradient flex size-8 items-center justify-center rounded-md">
          <BrandMark className="size-4 text-white" />
        </div>
        <span className="text-[13px] font-extrabold">Grupo Ancon</span>
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => seleccionar(tab.id)}
            className={cn(
              "rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
              active === tab.id
                ? "bg-brand-gradient text-white"
                : "border-border text-muted-foreground hover:bg-muted border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
