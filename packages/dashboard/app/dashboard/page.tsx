import { getDashboardRootUser } from "@/lib/session"
import { EmptyPage } from "@/components/empty-page"

export default async function Page() {
  const rootUser = await getDashboardRootUser()

  return (
    <EmptyPage username={rootUser?.username ?? "root user"} />
  )
}
