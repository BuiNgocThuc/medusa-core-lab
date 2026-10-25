import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { sdk } from "../lib/sdk"

const FlashSaleCampaignWidget = ({ data }: DetailWidgetProps<HttpTypes.AdminCampaign>) => {
  const navigate = useNavigate(); const client = useQueryClient()
  const { data: result } = useQuery({ queryKey: ["flash-sales", "campaign", data.id], queryFn: () => sdk.client.fetch<any>("/admin/flash-sales", { method: "GET" }) })
  const sale = result?.flash_sales?.find((entry: any) => entry.campaign?.id === data.id)
  const toggle = useMutation({ mutationFn: () => sdk.client.fetch(`/admin/flash-sales/${sale.id}/toggle`, { method: "POST" }), onSuccess: () => { client.invalidateQueries({ queryKey: ["flash-sales"] }); toast.success("Flash Sale updated") } })
  if (!sale) return null
  return <Container className="p-0"><div className="flex items-center justify-between px-6 py-4"><Heading level="h2">Flash Sale schedule</Heading><Badge color={sale.status === "inactive" ? "grey" : "green"}>{sale.runtime_status}</Badge></div><div className="space-y-1 px-6 pb-4"><Text>{sale.promotion?.code} · {sale.start_time}–{sale.end_time}</Text><Text className="text-ui-fg-subtle">Cap {Number(sale.max_discount_amount).toLocaleString("vi-VN")} VND</Text></div><div className="flex justify-end gap-2 border-t px-6 py-3"><Button size="small" variant="secondary" onClick={() => toggle.mutate()}>{sale.status === "inactive" ? "Enable" : "Disable"}</Button><Button size="small" variant="secondary" onClick={() => navigate(`/flash-sales/${sale.id}`)}>Open Flash Sale</Button></div></Container>
}
export const config = defineWidgetConfig({ zone: "campaign.details.side.after" })
export default FlashSaleCampaignWidget
