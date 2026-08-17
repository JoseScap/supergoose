import data from "@/app/dashboard/data.json"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

export function EmptyPage({
  username,
}: {
  username: string
}) {
  return (
    <>
      {/** page content */}
      <div className="flex flex-col gap-2 px-4 pt-4 md:px-6">
        <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{username}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={data} />
      </div>
      {/** page content */}
    </>
  )
}
